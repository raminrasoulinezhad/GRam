import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getExercise, type SetKind } from '@/catalog';
// Types only flow the other way, so this is not a cycle - see the note on the export itself.
import { startOfDayBefore } from '@/analytics/volume';
import { uid } from '@/lib/id';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  DEFAULT_BACKUP,
  SCHEMA_VERSION,
  coerce,
  migratePersisted,
  type BackupRecord,
  type PersistedState,
  type VersionSeen,
} from './migrations';
import { STORAGE_KEY, clearPreMigrationBackups, createBackingStorage } from './storage';
import { WEEKDAYS, WEEKDAY_LABEL } from './types';
import type {
  Plan,
  PlanItem,
  Profile,
  Session,
  SessionEntry,
  SessionSet,
  SetTemplate,
  SetValues,
  Settings,
  Weekday,
} from './types';

/** Ten minutes. Longer than any strength protocol asks for, and it stops a typo becoming a hang. */
export const MAX_REST_SEC = 600;

/** Sensible starting numbers so a freshly added exercise is editable rather than blank. */
function seedTemplate(kind: SetKind): SetTemplate {
  switch (kind) {
    case 'weight_reps':
      return { id: uid('t'), weightKg: 20, reps: 8 };
    case 'reps':
      return { id: uid('t'), reps: 10 };
    case 'time':
      return { id: uid('t'), timeSec: 30 };
    case 'distance_time':
      return { id: uid('t'), distanceM: 1000, timeSec: 300 };
  }
}

type State = {
  plans: Plan[];
  sessions: Session[];
  settings: Settings;
  profile: Profile;
  /** At most one session is live at a time; the tab bar surfaces it. */
  activeSessionId: string | null;
  celebratedMilestones: string[];
  /** Training groups whose week-balance advice has been dismissed. */
  ignoredBalanceGroups: string[];
  backup: BackupRecord;
  versionHistory: VersionSeen[];
};

type Actions = {
  // --- plans ---
  /** Creates a training day. Omit the day to take the first free one. */
  createPlan: (day?: Weekday) => string;
  /** Moves a plan to another weekday, swapping with whatever is already there. */
  setPlanDay: (planId: string, day: Weekday) => void;
  deletePlan: (planId: string) => void;
  duplicatePlan: (planId: string) => string | null;
  addPlanItem: (planId: string, exerciseId: string) => void;
  removePlanItem: (planId: string, itemId: string) => void;
  movePlanItem: (planId: string, itemId: string, delta: number) => void;
  setPlanItemKind: (planId: string, itemId: string, kind: SetKind) => void;
  setPlanItemRest: (planId: string, itemId: string, restSec: number) => void;
  addPlanTemplate: (planId: string, itemId: string) => void;
  removePlanTemplate: (planId: string, itemId: string, templateId: string) => void;
  updatePlanTemplate: (
    planId: string,
    itemId: string,
    templateId: string,
    values: SetValues,
  ) => void;

  // --- sessions ---
  startSession: (planId: string) => string | null;
  startEmptySession: () => string;
  addSessionExercise: (sessionId: string, exerciseId: string) => void;
  removeSessionEntry: (sessionId: string, entryId: string) => void;
  /** Swaps an exercise for another, keeping the set count. Refused once anything is recorded. */
  swapSessionExercise: (sessionId: string, entryId: string, exerciseId: string) => void;
  addSet: (sessionId: string, entryId: string) => void;
  removeSet: (sessionId: string, entryId: string, setId: string) => void;
  updateSet: (sessionId: string, entryId: string, setId: string, values: SetValues) => void;
  toggleSetLogged: (sessionId: string, entryId: string, setId: string) => void;
  endSession: (sessionId: string) => void;
  discardSession: (sessionId: string) => void;
  /**
   * Settles workouts left open on an earlier day. Run once per launch.
   *
   * A workout is yours to come back to all day - close the app between exercises, take a call,
   * let the phone die - but not forever. Left alone, a session nobody finished sits at the top
   * of the plans screen saying IN PROGRESS next week, and the sets in it never reach the log
   * that counts them.
   */
  closeStaleSessions: (now?: number) => void;
  /** Retitles a workout in the log. Blank falls back to "Workout" rather than an empty row. */
  renameSession: (sessionId: string, planName: string) => void;
  /** Moves a workout to another date and time, carrying everything inside it along. */
  setSessionStart: (sessionId: string, startedAt: number) => void;
  /** Corrects how long a finished workout took. Ignored for one still running. */
  setSessionDuration: (sessionId: string, seconds: number) => void;
  /** Drops exercises left with no sets. Run when an edit of a past workout finishes. */
  tidySession: (sessionId: string) => void;

  // --- profile & settings ---
  updateProfile: (patch: Partial<Profile>) => void;
  toggleEquipment: (equipment: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Sets how long the rest timer runs, retiming existing plans and any live workout with it. */
  setDefaultRest: (seconds: number) => void;
  /** Records milestone ids as seen, so their celebration is not shown again. */
  markMilestonesSeen: (ids: string[]) => void;
  // --- week balance ---
  /** Stops the week review from advising about a group. */
  ignoreBalanceGroup: (group: string) => void;
  /** Brings every dismissed group back, so a fresh review says everything it has to say. */
  clearIgnoredBalanceGroups: () => void;
  // --- backup ---
  /** Everything the app persists, as one object - what an export writes to a file. */
  exportState: () => PersistedState;
  /** Records that a backup was taken, so the app can tell how stale the next one is. */
  recordExport: (at: number, sets: number) => void;
  setAutoExport: (on: boolean) => void;
  /** Notes that this build has run. First call for a version stamps it; later calls do nothing. */
  recordVersion: (version: string, at: number) => void;
  /** Replaces every persisted field from an imported backup. See src/store/backup.ts. */
  replaceAll: (state: PersistedState) => void;
  resetAll: () => void;
};

/** Plans always read in weekday order, so the list is the week. */
function byWeekday(a: Plan, b: Plan): number {
  return WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
}

/** Applies `fn` to the plan with `planId`, bumping updatedAt. Returns the plans array unchanged if absent. */
function withPlan(plans: Plan[], planId: string, fn: (plan: Plan) => Plan): Plan[] {
  return plans.map((p) => (p.id === planId ? { ...fn(p), updatedAt: Date.now() } : p));
}

function withItem(plan: Plan, itemId: string, fn: (item: PlanItem) => PlanItem): Plan {
  return { ...plan, items: plan.items.map((i) => (i.id === itemId ? fn(i) : i)) };
}

function withSession(
  sessions: Session[],
  sessionId: string,
  fn: (session: Session) => Session,
): Session[] {
  return sessions.map((s) => (s.id === sessionId ? fn(s) : s));
}

function withEntry(
  session: Session,
  entryId: string,
  fn: (entry: SessionEntry) => SessionEntry,
): Session {
  return { ...session, entries: session.entries.map((e) => (e.id === entryId ? fn(e) : e)) };
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      plans: [],
      sessions: [],
      settings: DEFAULT_SETTINGS,
      profile: DEFAULT_PROFILE,
      activeSessionId: null,
      celebratedMilestones: [],
      ignoredBalanceGroups: [],
      backup: DEFAULT_BACKUP,
      versionHistory: [],

      // ---------------------------------------------------------------- plans
      /**
       * Creates the training day. Falls back to the first weekday not already taken, so the
       * common case - tapping Add with nothing chosen - still does something sensible.
       */
      createPlan: (day) => {
        const now = Date.now();
        const taken = new Set(get().plans.map((p) => p.day));
        const plan: Plan = {
          id: uid('p'),
          day: day ?? WEEKDAYS.find((d) => !taken.has(d)) ?? 'monday',
          items: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ plans: [...s.plans, plan].sort(byWeekday) }));
        return plan.id;
      },

      /**
       * Moves a plan to another weekday.
       *
       * If that day is already taken the two swap, rather than the move being refused. Refusing
       * would mean freeing the target day first, which is two operations to express one
       * intention; swapping is what someone reordering their week actually means.
       */
      setPlanDay: (planId, day) =>
        set((s) => {
          const moving = s.plans.find((p) => p.id === planId);
          if (!moving || moving.day === day) return s;
          const now = Date.now();
          const occupant = s.plans.find((p) => p.day === day);
          return {
            plans: s.plans
              .map((p) => {
                if (p.id === planId) return { ...p, day, updatedAt: now };
                if (occupant && p.id === occupant.id) {
                  return { ...p, day: moving.day, updatedAt: now };
                }
                return p;
              })
              .sort(byWeekday),
          };
        }),

      deletePlan: (planId) => set((s) => ({ plans: s.plans.filter((p) => p.id !== planId) })),

      /**
       * Copies a plan onto the next free weekday.
       *
       * Returns null when the week is full - seven plans is seven days, and an eighth would be
       * a second plan sharing a day, which is the ambiguity the weekday model exists to remove.
       */
      duplicatePlan: (planId) => {
        const source = get().plans.find((p) => p.id === planId);
        if (!source) return null;
        const taken = new Set(get().plans.map((p) => p.day));
        const free = WEEKDAYS.find((d) => !taken.has(d));
        if (!free) return null;
        const now = Date.now();
        const copy: Plan = {
          ...source,
          id: uid('p'),
          day: free,
          createdAt: now,
          updatedAt: now,
          items: source.items.map((i) => ({
            ...i,
            id: uid('pi'),
            templates: i.templates.map((t) => ({ ...t, id: uid('t') })),
          })),
        };
        set((s) => ({ plans: [...s.plans, copy].sort(byWeekday) }));
        return copy.id;
      },

      addPlanItem: (planId, exerciseId) => {
        const exercise = getExercise(exerciseId);
        if (!exercise) return;
        const { defaultRestSec, defaultSetCount } = get().settings;
        const item: PlanItem = {
          id: uid('pi'),
          exerciseId,
          kind: exercise.kind,
          restSec: defaultRestSec,
          templates: Array.from({ length: defaultSetCount }, () => seedTemplate(exercise.kind)),
        };
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) => ({ ...p, items: [...p.items, item] })),
        }));
      },

      removePlanItem: (planId, itemId) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) => ({
            ...p,
            items: p.items.filter((i) => i.id !== itemId),
          })),
        })),

      movePlanItem: (planId, itemId, delta) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) => {
            const from = p.items.findIndex((i) => i.id === itemId);
            const to = from + delta;
            if (from < 0 || to < 0 || to >= p.items.length) return p;
            const items = [...p.items];
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved);
            return { ...p, items };
          }),
        })),

      setPlanItemKind: (planId, itemId, kind) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) =>
            withItem(p, itemId, (i) => ({
              ...i,
              kind,
              // The old numbers are meaningless under a different kind, so reseed.
              templates: i.templates.map(() => seedTemplate(kind)),
            })),
          ),
        })),

      setPlanItemRest: (planId, itemId, restSec) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) =>
            withItem(p, itemId, (i) => ({ ...i, restSec: Math.max(0, restSec) })),
          ),
        })),

      addPlanTemplate: (planId, itemId) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) =>
            withItem(p, itemId, (i) => ({
              ...i,
              // Copy the last set - the usual intent is "one more like that".
              templates: [
                ...i.templates,
                i.templates.length > 0
                  ? { ...i.templates[i.templates.length - 1], id: uid('t') }
                  : seedTemplate(i.kind),
              ],
            })),
          ),
        })),

      removePlanTemplate: (planId, itemId, templateId) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) =>
            withItem(p, itemId, (i) => ({
              ...i,
              templates: i.templates.filter((t) => t.id !== templateId),
            })),
          ),
        })),

      updatePlanTemplate: (planId, itemId, templateId, values) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) =>
            withItem(p, itemId, (i) => ({
              ...i,
              templates: i.templates.map((t) => (t.id === templateId ? { ...t, ...values } : t)),
            })),
          ),
        })),

      // ------------------------------------------------------------- sessions
      /**
       * Turns a plan into a live workout, pre-filled with what you did last time.
       *
       * The plan's own numbers are only the starting point. Where an exercise has been recorded
       * before, its sets open on the weights and reps of the last time you trained it - so the
       * previous session is in front of you while you decide today's, instead of a plan template
       * you set months ago. Nothing is recorded by this: they are targets, editable as always.
       */
      startSession: (planId) => {
        const plan = get().plans.find((p) => p.id === planId);
        if (!plan) return null;
        const sessions = get().sessions;
        const session: Session = {
          id: uid('s'),
          planId: plan.id,
          planName: WEEKDAY_LABEL[plan.day],
          startedAt: Date.now(),
          endedAt: null,
          entries: plan.items.map((item) => {
            const previous = lastPerformance(sessions, item.exerciseId);
            return {
              id: uid('se'),
              exerciseId: item.exerciseId,
              kind: item.kind,
              restSec: item.restSec,
              sets: item.templates.map((t, i) => ({
                id: uid('ss'),
                ...seedFromLast(t, previous, i),
                loggedAt: null,
              })),
            };
          }),
        };
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: session.id }));
        return session.id;
      },

      startEmptySession: () => {
        const session: Session = {
          id: uid('s'),
          planId: null,
          planName: 'Quick workout',
          startedAt: Date.now(),
          endedAt: null,
          entries: [],
        };
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: session.id }));
        return session.id;
      },

      addSessionExercise: (sessionId, exerciseId) => {
        const exercise = getExercise(exerciseId);
        if (!exercise) return;
        const { defaultRestSec, defaultSetCount } = get().settings;
        const finished = get().sessions.find((x) => x.id === sessionId)?.endedAt ?? null;
        /*
         * A live workout is pre-filled with the usual number of sets to work through. A
         * finished one is a record of what happened, so it gets exactly one set, already
         * recorded and stamped with the workout's own time rather than today's - otherwise
         * correcting last Tuesday would show up on the body map as training done just now.
         */
        const count = finished === null ? defaultSetCount : 1;
        // Last time's numbers, as of the day of the workout - so an exercise added while
        // correcting last Tuesday opens on what came before Tuesday, not on this week's.
        const previous = lastPerformance(get().sessions, exerciseId, finished ?? Infinity);
        const entry: SessionEntry = {
          id: uid('se'),
          exerciseId,
          kind: exercise.kind,
          restSec: defaultRestSec,
          sets: Array.from({ length: count }, (_, i) => ({
            id: uid('ss'),
            ...seedFromLast(seedTemplate(exercise.kind), previous, i),
            loggedAt: finished,
          })),
        };
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) => ({
            ...session,
            entries: [...session.entries, entry],
          })),
        }));
      },

      removeSessionEntry: (sessionId, entryId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) => ({
            ...session,
            entries: session.entries.filter((e) => e.id !== entryId),
          })),
        })),

      /**
       * Puts a different exercise in this slot - what "try the easier one instead" does.
       *
       * Keeps the number of sets, because the plan said how much work this slot is worth and
       * changing the movement does not change that. The numbers are reseeded from whatever you
       * last lifted on the new exercise, so swapping to something you have done before opens on
       * your own weights rather than the stock twenty kilos.
       *
       * Refused outright once a set has been recorded. Those sets say you did *this* exercise;
       * relabelling them would put work in your history you never did, and that is the one
       * thing this app must never do.
       */
      swapSessionExercise: (sessionId, entryId, exerciseId) => {
        const exercise = getExercise(exerciseId);
        if (!exercise) return;
        const sessions = get().sessions;
        const previous = lastPerformance(sessions, exerciseId);
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => {
              if (entry.sets.some((x) => x.loggedAt !== null)) return entry;
              return {
                ...entry,
                exerciseId,
                kind: exercise.kind,
                sets: entry.sets.map((set, i) => ({
                  id: set.id,
                  ...seedFromLast(seedTemplate(exercise.kind), previous, i),
                  loggedAt: null,
                })),
              };
            }),
          ),
        }));
      },

      addSet: (sessionId, entryId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => {
              const last = entry.sets[entry.sets.length - 1];
              // A set added to a finished workout is recorded on the spot - there is no
              // workout left to record it during - and it borrows the timestamp of the set it
              // was copied from so it lands on the day the training actually happened.
              const loggedAt =
                session.endedAt === null ? null : (last?.loggedAt ?? session.endedAt);
              const next: SessionSet = last
                ? { ...last, id: uid('ss'), loggedAt }
                : { ...seedTemplate(entry.kind), id: uid('ss'), loggedAt };
              return { ...entry, sets: [...entry.sets, next] };
            }),
          ),
        })),

      removeSet: (sessionId, entryId, setId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => ({
              ...entry,
              sets: entry.sets.filter((x) => x.id !== setId),
            })),
          ),
        })),

      /**
       * Changes one set's numbers, and carries them into the sets after it.
       *
       * A set that has not been recorded is a target, not a result - it says what you intend to
       * lift next, and the intention for the rest of the exercise almost always follows the set
       * you just corrected. So finding the bar loaded differently from the plan is one edit
       * rather than one per remaining set.
       *
       * Only the fields actually being changed travel, so fixing a weight leaves the reps
       * alone, and only sets *after* this one are touched - the ones above have already
       * happened. A recorded set is never rewritten by an edit to another set, which is also
       * what keeps this quiet in the history editor: every set in a finished workout is
       * recorded, so correcting one there changes exactly the one you are looking at.
       */
      updateSet: (sessionId, entryId, setId, values) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => {
              const at = entry.sets.findIndex((x) => x.id === setId);
              if (at < 0) return entry;
              return {
                ...entry,
                sets: entry.sets.map((x, i) =>
                  i === at || (i > at && x.loggedAt === null) ? { ...x, ...values } : x,
                ),
              };
            }),
          ),
        })),

      toggleSetLogged: (sessionId, entryId, setId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => ({
              ...entry,
              sets: entry.sets.map((x) =>
                x.id === setId ? { ...x, loggedAt: x.loggedAt === null ? Date.now() : null } : x,
              ),
            })),
          ),
        })),

      /**
       * Closes a workout and puts it in the log.
       *
       * Unrecorded sets are stripped, so history reflects work done rather than work planned.
       * If that leaves nothing at all the workout is discarded instead of saved: a row in the
       * log reading "0 sets" claims you trained on a day you did not, and the log is the one
       * list in this app that has to be true. It is also what closeStaleSessions already does
       * with a workout nobody recorded anything in, and two paths that disagree about the same
       * question are a bug waiting to be found by whoever hits the other one.
       *
       * The finish button asks before reaching this, so a user sees the question rather than a
       * silent deletion. This is the floor under that, for the stale screen and the second tab.
       */
      endSession: (sessionId) =>
        set((s) => {
          const target = s.sessions.find((x) => x.id === sessionId);
          if (!target || target.endedAt !== null) return s;
          const entries = target.entries
            .map((e) => ({ ...e, sets: e.sets.filter((x) => x.loggedAt !== null) }))
            .filter((e) => e.sets.length > 0);
          const activeSessionId =
            s.activeSessionId === sessionId ? null : s.activeSessionId;

          if (entries.length === 0) {
            return { sessions: s.sessions.filter((x) => x.id !== sessionId), activeSessionId };
          }
          return {
            sessions: withSession(s.sessions, sessionId, (session) => ({
              ...session,
              endedAt: Date.now(),
              entries,
            })),
            activeSessionId,
          };
        }),

      discardSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== sessionId),
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        })),

      /**
       * Finishes yesterday's unfinished workouts, and drops the ones that never began.
       *
       * "Earlier day" is measured from the last set recorded, not from when the workout started,
       * so a session that runs past midnight is still today's until the day after. Its end time
       * is that same last set: a workout you did at 7pm and forgot to finish belongs in the log
       * at 7pm, not at whatever hour you next happened to open the app.
       *
       * WHAT IT WILL AND WILL NOT THROW AWAY
       * A stale session with recorded sets is kept and closed. A stale session with none is
       * dropped, and everything in it is by definition a target rather than a result - the same
       * line endSession already draws when it strips unrecorded sets out of a finished workout.
       * No recorded set is ever removed by this, on any path; sessionRecovery.test.ts exists to
       * keep it that way.
       */
      closeStaleSessions: (now = Date.now()) => {
        const today = startOfDayBefore(now, 0);
        const s = get();
        const kept: Session[] = [];
        let changed = false;

        for (const session of s.sessions) {
          if (session.endedAt !== null || lastActivityAt(session) >= today) {
            kept.push(session);
            continue;
          }
          changed = true;
          const recorded = session.entries
            .map((e) => ({ ...e, sets: e.sets.filter((x) => x.loggedAt !== null) }))
            .filter((e) => e.sets.length > 0);
          if (recorded.length === 0) continue;
          kept.push({ ...session, endedAt: lastActivityAt(session), entries: recorded });
        }

        if (!changed) return;
        const stillLive = kept.some((x) => x.id === s.activeSessionId && x.endedAt === null);
        set({ sessions: kept, activeSessionId: stillLive ? s.activeSessionId : null });
      },

      /*
       * The empty name is stored as typed and only defaulted on commit. Substituting a
       * fallback mid-edit would push text back into a field someone is halfway through
       * clearing - the round-trip that made a plan's last character undeletable twice.
       */
      renameSession: (sessionId, planName) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) => ({ ...session, planName })),
        })),

      /**
       * Moves a workout to another date and time.
       *
       * Everything inside shifts by the same amount - the end time and every set's timestamp -
       * so the workout keeps its length and the order its sets were recorded in. Shifting the
       * sets is not cosmetic: the body map, the weekly volume and the per-exercise history all
       * read `loggedAt`, so a workout moved without them would go on counting on the old day.
       */
      setSessionStart: (sessionId, startedAt) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) => {
            const delta = startedAt - session.startedAt;
            if (delta === 0) return session;
            return {
              ...session,
              startedAt,
              endedAt: session.endedAt === null ? null : session.endedAt + delta,
              entries: session.entries.map((e) => ({
                ...e,
                sets: e.sets.map((x) =>
                  x.loggedAt === null ? x : { ...x, loggedAt: x.loggedAt + delta },
                ),
              })),
            };
          }),
        })),

      /*
       * Length is stored as an end time, so correcting it moves endedAt and nothing else. A
       * workout still in progress has no length yet - it is however long it has been going -
       * so there is nothing to correct and the call is ignored.
       */
      setSessionDuration: (sessionId, seconds) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            session.endedAt === null
              ? session
              : { ...session, endedAt: session.startedAt + Math.max(0, Math.round(seconds)) * 1000 },
          ),
        })),

      /**
       * Settles a finished workout after it has been edited.
       *
       * Two jobs, and both are the same rule endSession applies: a set in the log is a set that
       * happened, and an exercise in the log has at least one of them.
       *
       * The un-recorded set is the one that is easy to miss. Tapping the tick in the history
       * editor is how you take back a set you logged by accident, and it leaves `loggedAt` null
       * inside a workout that has already ended. Nothing counts such a set - not the body map,
       * not the volume, not the per-exercise history, not the set count on its own History card
       * - but it stays in the editor forever, and the next Add set copies its null stamp and
       * makes another one. So on the way out they go, along with any exercise left empty.
       *
       * Deliberately not done by removeSet, and deliberately not done to a live workout: while
       * an edit is in progress an exercise you have just emptied has to stay on screen or there
       * is nowhere to put the corrected sets, and in a live workout an unrecorded set is the
       * whole point - it is the set you are about to do.
       */
      tidySession: (sessionId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) => {
            const entries = (
              session.endedAt === null
                ? session.entries
                : session.entries.map((e) => ({
                    ...e,
                    sets: e.sets.filter((x) => x.loggedAt !== null),
                  }))
            ).filter((e) => e.sets.length > 0);
            return { ...session, entries };
          }),
        })),

      // ------------------------------------------------------ profile & settings
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      toggleEquipment: (equipment) =>
        set((s) => ({
          profile: {
            ...s.profile,
            equipment: s.profile.equipment.includes(equipment)
              ? s.profile.equipment.filter((e) => e !== equipment)
              : [...s.profile.equipment, equipment],
          },
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      /**
       * Changes the rest timer, and retimes what is already planned.
       *
       * Rest is stored per exercise, but nothing has ever been able to set it per exercise -
       * every stored value is a copy of whatever this default was when that exercise was added.
       * So changing the setting alone would leave every existing plan resting for the old
       * duration, which reads as a switch that does nothing. A live workout is retimed too,
       * because that is where the change is usually wanted. Finished workouts are records of
       * what happened and are never touched.
       *
       * The day rest becomes settable per exercise, this stops being a blanket rewrite.
       */
      setDefaultRest: (seconds) => {
        const restSec = Math.max(0, Math.min(MAX_REST_SEC, Math.round(seconds)));
        set((s) => ({
          settings: { ...s.settings, defaultRestSec: restSec },
          plans: s.plans.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, restSec })) })),
          sessions: s.sessions.map((x) =>
            x.endedAt !== null ? x : { ...x, entries: x.entries.map((e) => ({ ...e, restSec })) },
          ),
        }));
      },

      markMilestonesSeen: (ids) =>
        set((s) => ({
          celebratedMilestones: [...new Set([...s.celebratedMilestones, ...ids])],
        })),

      ignoreBalanceGroup: (group) =>
        set((s) => ({ ignoredBalanceGroups: [...new Set([...s.ignoredBalanceGroups, group])] })),

      clearIgnoredBalanceGroups: () => set({ ignoredBalanceGroups: [] }),

      exportState: () => {
        const s = get();
        return {
          plans: s.plans,
          sessions: s.sessions,
          settings: s.settings,
          profile: s.profile,
          activeSessionId: s.activeSessionId,
          celebratedMilestones: s.celebratedMilestones,
          ignoredBalanceGroups: s.ignoredBalanceGroups,
          backup: s.backup,
          versionHistory: s.versionHistory,
        };
      },

      recordExport: (at, sets) =>
        set((s) => ({ backup: { ...s.backup, lastExportedAt: at, lastExportedSets: sets } })),

      setAutoExport: (on) => set((s) => ({ backup: { ...s.backup, autoExport: on } })),

      recordVersion: (version, at) =>
        set((s) =>
          s.versionHistory.some((v) => v.version === version)
            ? s
            : { versionHistory: [...s.versionHistory, { version, firstSeenAt: at }] },
        ),

      /*
       * Replaces the lot, field by field rather than with a spread of the argument, so a key
       * the file happens to carry cannot overwrite an action on the store.
       */
      replaceAll: (next) =>
        set({
          plans: next.plans,
          sessions: next.sessions,
          settings: next.settings,
          profile: next.profile,
          activeSessionId: next.activeSessionId,
          celebratedMilestones: next.celebratedMilestones,
          ignoredBalanceGroups: next.ignoredBalanceGroups,
          // Not next.backup: a restored file describes when *that* device last exported. This
          // device has a fresh copy in hand right now, which is what the import just proved.
          backup: { ...get().backup, lastExportedAt: Date.now(), lastExportedSets: 0 },
          // Kept from this device: the history describes which builds ran *here*, and importing
          // someone else's file does not change what this phone has run.
          versionHistory: get().versionHistory,
        }),

      /**
       * Erase all data, and mean it.
       *
       * Clearing the live state is only most of the job. Every upgrade that changed the schema
       * stashed a verbatim copy of the old blob under its own key, as insurance against a bad
       * migration, and those copies hold the same plans, workouts, name and body weight. Left
       * behind they make the button a lie.
       *
       * Fired and not awaited, because the action is synchronous by necessity - it is called
       * from a render-driven handler and the UI has to reflect the erase immediately - and
       * because the live data is gone regardless of how the storage call goes.
       */
      resetAll: () => {
        void clearPreMigrationBackups(SCHEMA_VERSION);
        set({
          plans: [],
          sessions: [],
          settings: DEFAULT_SETTINGS,
          profile: DEFAULT_PROFILE,
          activeSessionId: null,
          celebratedMilestones: [],
          ignoredBalanceGroups: [],
          backup: DEFAULT_BACKUP,
          versionHistory: [],
        });
      },
    }),
    {
      name: STORAGE_KEY,
      // Stashes a verbatim copy of the old blob before any migration rewrites it.
      storage: createJSONStorage(() => createBackingStorage(SCHEMA_VERSION)),
      partialize: (s) => ({
        plans: s.plans,
        sessions: s.sessions,
        settings: s.settings,
        profile: s.profile,
        activeSessionId: s.activeSessionId,
        celebratedMilestones: s.celebratedMilestones,
        ignoredBalanceGroups: s.ignoredBalanceGroups,
        backup: s.backup,
        versionHistory: s.versionHistory,
      }),
      version: SCHEMA_VERSION,
      // Synchronous by contract - see the note in migrations.ts. An async migrate silently
      // resets the store to its initial state, which would read as total data loss.
      migrate: (persisted, from) => migratePersisted(persisted, from),
      /*
       * Validation has to happen here, not only inside migrate().
       *
       * zustand calls migrate() only when the stored version differs from this one, so a blob
       * already at the current version goes straight into live state unchecked - and coerce()
       * is precisely the thing standing between a truncated write, a hand-edited file or a
       * restored backup and a screen that crashes on `undefined.length`. Running it in merge()
       * means every load is validated, whether or not a migration was involved.
       */
      merge: (persisted, current) => ({
        ...current,
        ...coerce((persisted ?? {}) as Record<string, unknown>),
      }),
    },
  ),
);

// ------------------------------------------------------------------ derivations
//
// These are plain functions over a Session[], NOT zustand selectors. Passing a selector
// that builds a new array to useStore() makes getSnapshot return a fresh reference every
// render, which zustand detects as a state change and re-renders forever. Components
// subscribe to the raw `sessions` array and wrap these in useMemo instead.

/** Finished sessions, newest first - what the History tab and the body map read. */
export function completedSessions(sessions: Session[]): Session[] {
  return sessions.filter((x) => x.endedAt !== null).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * When the last thing happened in a workout: its newest recorded set, or its start if nothing
 * has been recorded yet.
 *
 * Not `endedAt`, which is null for exactly the workouts this is asked about, and not
 * `startedAt`, which would make a session that ran from 11pm to 1am look like it stopped two
 * hours before it did.
 */
export function lastActivityAt(session: Session): number {
  let at = session.startedAt;
  for (const entry of session.entries) {
    for (const set of entry.sets) {
      if (set.loggedAt !== null && set.loggedAt > at) at = set.loggedAt;
    }
  }
  return at;
}

/** Workouts still running, newest first. Normally none or one. */
export function liveSessions(sessions: Session[]): Session[] {
  return sessions.filter((x) => x.endedAt === null).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * The workout to offer to resume, if there is one.
 *
 * `activeSessionId` is a convenience, NOT the record of what is running - the sessions
 * themselves are, and `endedAt === null` is what makes one live. Reading the pointer first and
 * falling back to the newest live session is what makes a workout survive losing it: a crash
 * between the two writes, a restored backup from a phone that was mid-session, an import that
 * brought sessions without the pointer. In every one of those the training is on disk and only
 * the bookmark is gone, and this hands it back rather than showing a plans screen that quietly
 * pretends nothing was in progress.
 */
export function resumableSession(
  sessions: Session[],
  activeSessionId: string | null,
): Session | null {
  const live = liveSessions(sessions);
  return live.find((x) => x.id === activeSessionId) ?? live[0] ?? null;
}

/** Only the numbers that are actually set, so a spread can never blank out what it lands on. */
function definedValues(set: SetValues): SetValues {
  const out: SetValues = {};
  if (set.weightKg !== undefined) out.weightKg = set.weightKg;
  if (set.reps !== undefined) out.reps = set.reps;
  if (set.timeSec !== undefined) out.timeSec = set.timeSec;
  if (set.distanceM !== undefined) out.distanceM = set.distanceM;
  return out;
}

/**
 * What was recorded the last time this exercise was trained, set by set, in the order it was
 * done. Empty if it has never been recorded.
 *
 * "Last time" is the entry holding the most recent recorded set of that exercise, which is not
 * necessarily the newest session - a workout can be moved to another date after the fact, and
 * the numbers that matter are the ones from the day you actually trained. Pass `before` to ask
 * the same question as of a moment in the past.
 */
function lastPerformance(
  sessions: Session[],
  exerciseId: string,
  before = Infinity,
): SetValues[] {
  let bestAt = -Infinity;
  let best: SetValues[] = [];
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      const done = entry.sets.filter((x) => x.loggedAt !== null && x.loggedAt < before);
      if (done.length === 0) continue;
      const at = Math.max(...done.map((x) => x.loggedAt as number));
      if (at > bestAt) {
        bestAt = at;
        best = done.map(definedValues);
      }
    }
  }
  return best;
}

/**
 * The numbers to start set `index` of an exercise on: last time's, falling back to the
 * template's. Past the end of last time's sets it repeats the final one, which is the right
 * guess for a fourth set when you did three.
 */
function seedFromLast(template: SetValues, previous: SetValues[], index: number): SetValues {
  if (previous.length === 0) return definedValues(template);
  return { ...definedValues(template), ...previous[Math.min(index, previous.length - 1)] };
}

export type HistoryRow = { session: Session; set: SessionSet; kind: SetKind };

/** Every recorded set of one exercise, newest first. Powers the per-exercise history list. */
export function exerciseHistory(sessions: Session[], exerciseId: string): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      for (const set of entry.sets) {
        if (set.loggedAt !== null) rows.push({ session, set, kind: entry.kind });
      }
    }
  }
  return rows.sort((a, b) => (b.set.loggedAt ?? 0) - (a.set.loggedAt ?? 0));
}

/**
 * exerciseId -> how many sets of it have ever been recorded.
 *
 * Feeds the ordering of a search by muscle: below the recommended picks, the exercises you
 * actually do come before the eight hundred you have never touched. Counting sets rather than
 * sessions means an exercise you do three sets of every week outranks one you tried once.
 */
export function setCountsByExercise(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const entry of session.entries) {
      let logged = 0;
      for (const set of entry.sets) if (set.loggedAt !== null) logged += 1;
      if (logged > 0) counts.set(entry.exerciseId, (counts.get(entry.exerciseId) ?? 0) + logged);
    }
  }
  return counts;
}

/** Stable-reference selector: the raw session list. Safe to pass to useStore(). */
export const selectSessions = (s: State) => s.sessions;
