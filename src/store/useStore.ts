import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getExercise, type SetKind } from '@/catalog';
import { uid } from '@/lib/id';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  migratePersisted,
} from './migrations';
import { STORAGE_KEY, createBackingStorage } from './storage';
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
} from './types';

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
};

type Actions = {
  // --- plans ---
  createPlan: (name: string) => string;
  renamePlan: (planId: string, name: string) => void;
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
  addSet: (sessionId: string, entryId: string) => void;
  removeSet: (sessionId: string, entryId: string, setId: string) => void;
  updateSet: (sessionId: string, entryId: string, setId: string, values: SetValues) => void;
  toggleSetLogged: (sessionId: string, entryId: string, setId: string) => void;
  endSession: (sessionId: string) => void;
  discardSession: (sessionId: string) => void;

  // --- profile & settings ---
  updateProfile: (patch: Partial<Profile>) => void;
  toggleEquipment: (equipment: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Applies the phone's region default for weight units, once, before the user has chosen. */
  seedUnitFromDevice: (unit: 'kg' | 'lb') => void;
  /** Records milestone ids as seen, so their celebration is not shown again. */
  markMilestonesSeen: (ids: string[]) => void;
  resetAll: () => void;
};

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

      // ---------------------------------------------------------------- plans
      createPlan: (name) => {
        const now = Date.now();
        const plan: Plan = {
          id: uid('p'),
          name: name.trim() || 'Untitled plan',
          items: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ plans: [plan, ...s.plans] }));
        return plan.id;
      },

      renamePlan: (planId, name) =>
        set((s) => ({
          plans: withPlan(s.plans, planId, (p) => ({ ...p, name: name.trim() || p.name })),
        })),

      deletePlan: (planId) => set((s) => ({ plans: s.plans.filter((p) => p.id !== planId) })),

      duplicatePlan: (planId) => {
        const source = get().plans.find((p) => p.id === planId);
        if (!source) return null;
        const now = Date.now();
        const copy: Plan = {
          ...source,
          id: uid('p'),
          name: `${source.name} copy`,
          createdAt: now,
          updatedAt: now,
          items: source.items.map((i) => ({
            ...i,
            id: uid('pi'),
            templates: i.templates.map((t) => ({ ...t, id: uid('t') })),
          })),
        };
        set((s) => ({ plans: [copy, ...s.plans] }));
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
      startSession: (planId) => {
        const plan = get().plans.find((p) => p.id === planId);
        if (!plan) return null;
        const session: Session = {
          id: uid('s'),
          planId: plan.id,
          planName: plan.name,
          startedAt: Date.now(),
          endedAt: null,
          entries: plan.items.map((item) => ({
            id: uid('se'),
            exerciseId: item.exerciseId,
            kind: item.kind,
            restSec: item.restSec,
            sets: item.templates.map((t) => ({
              id: uid('ss'),
              weightKg: t.weightKg,
              reps: t.reps,
              timeSec: t.timeSec,
              distanceM: t.distanceM,
              loggedAt: null,
            })),
          })),
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
        const entry: SessionEntry = {
          id: uid('se'),
          exerciseId,
          kind: exercise.kind,
          restSec: defaultRestSec,
          sets: Array.from({ length: defaultSetCount }, () => ({
            ...seedTemplate(exercise.kind),
            id: uid('ss'),
            loggedAt: null,
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

      addSet: (sessionId, entryId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => {
              const last = entry.sets[entry.sets.length - 1];
              const next: SessionSet = last
                ? { ...last, id: uid('ss'), loggedAt: null }
                : { ...seedTemplate(entry.kind), id: uid('ss'), loggedAt: null };
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

      updateSet: (sessionId, entryId, setId, values) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) =>
            withEntry(session, entryId, (entry) => ({
              ...entry,
              sets: entry.sets.map((x) => (x.id === setId ? { ...x, ...values } : x)),
            })),
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

      endSession: (sessionId) =>
        set((s) => ({
          sessions: withSession(s.sessions, sessionId, (session) => ({
            ...session,
            endedAt: Date.now(),
            // Drop sets that were never recorded so history reflects work done, not work planned.
            entries: session.entries
              .map((e) => ({ ...e, sets: e.sets.filter((x) => x.loggedAt !== null) }))
              .filter((e) => e.sets.length > 0),
          })),
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        })),

      discardSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== sessionId),
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
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

      seedUnitFromDevice: (unit) =>
        set((s) =>
          // Only ever fires once. After that the user's own choice is authoritative.
          s.settings.unitSeededFromDevice
            ? s
            : { settings: { ...s.settings, unit, unitSeededFromDevice: true } },
        ),

      markMilestonesSeen: (ids) =>
        set((s) => ({
          celebratedMilestones: [...new Set([...s.celebratedMilestones, ...ids])],
        })),

      resetAll: () =>
        set({
          plans: [],
          sessions: [],
          settings: DEFAULT_SETTINGS,
          profile: DEFAULT_PROFILE,
          activeSessionId: null,
          celebratedMilestones: [],
        }),
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
      }),
      version: SCHEMA_VERSION,
      // Synchronous by contract - see the note in migrations.ts. An async migrate silently
      // resets the store to its initial state, which would read as total data loss.
      migrate: (persisted, from) => migratePersisted(persisted, from),
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
