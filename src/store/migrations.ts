import type { SetKind } from '@/catalog';
import { DEFAULT_THEME, THEMES } from '@/ui/themes';
import type {
  Plan,
  PlanItem,
  Profile,
  Session,
  SessionEntry,
  SessionSet,
  SetTemplate,
  Settings,
  Weekday,
} from './types';

/**
 * Schema version of the persisted blob.
 *
 * THE RULE: a user upgrading from any previous release must keep every plan and every logged
 * set. The operating system already guarantees the storage survives - an App Store or Play
 * update replaces the binary and leaves the app sandbox untouched, and only an uninstall
 * clears it. What is *not* guaranteed is that old data still matches the shape the new code
 * expects. That is what this file is for.
 *
 * To change the shape:
 *   1. Bump SCHEMA_VERSION by one.
 *   2. Add a step to MIGRATIONS keyed by the NEW version, transforming the previous shape.
 *   3. Add the old payload to the fixtures in __tests__/migrations.test.ts.
 * Never edit an existing step - someone out there is still on that version.
 */
export const SCHEMA_VERSION = 7;

export const DEFAULT_SETTINGS: Settings = {
  /*
   * Pounds on a fresh install, everywhere.
   *
   * This used to be kilograms, overwritten once on first launch by whatever the phone's region
   * implied - which meant the unit depended on a setting most people have never looked at, and
   * a device reporting metric handed a pounds lifter kilograms. A fixed default is predictable,
   * and changing it is two taps in Profile. An existing install keeps whatever it has: the
   * stored settings are spread over these defaults, so this only ever decides a first launch.
   */
  unit: 'lb',
  /*
   * No migration step, and none needed: `coerce` spreads the stored settings over these
   * defaults, so an install from before themes existed picks this up on its next launch.
   */
  themeId: DEFAULT_THEME,
  defaultRestSec: 90,
  defaultSetCount: 3,
  bodyGender: 'male',
  showExercisePhotos: true,
};

export const DEFAULT_PROFILE: Profile = {
  displayName: '',
  birthDate: null,
  sex: 'unspecified',
  heightCm: null,
  weightKg: null,
  goal: 'hypertrophy',
  experience: 'beginner',
  equipment: [],
};

export type PersistedState = {
  plans: Plan[];
  sessions: Session[];
  settings: Settings;
  profile: Profile;
  activeSessionId: string | null;
  /** Milestone ids already shown to the user, so a celebration never repeats. */
  celebratedMilestones: string[];
  /**
   * Training groups whose week-balance advice the user has dismissed. Stored rather than
   * derived because it is a judgement about their own training - someone who does not train
   * biceps directly should not be told about it every time they open the app.
   */
  ignoredBalanceGroups: string[];
  /** When a backup was last taken, and how much training has happened since. */
  backup: BackupRecord;
  /** Every app version this install has run, oldest first. */
  versionHistory: VersionSeen[];
};

/**
 * A version this device has actually run, and when it first did.
 *
 * Recorded because there is no server and no crash reporting, so when something looks wrong on
 * a phone the first question - which build is this? - has no other answer. It also settles the
 * one that kept coming up during the icon saga: whether an update had reached the device at all.
 */
export type VersionSeen = { version: string; firstSeenAt: number };

/**
 * What the app remembers about backups.
 *
 * `lastExportedSets` is the interesting one: comparing it to the current count is how the app
 * knows how much training would be lost right now, which is the only honest basis for nagging
 * someone about it.
 */
export type BackupRecord = {
  lastExportedAt: number | null;
  lastExportedSets: number;
  /** Auto-export to a chosen file is armed. Web only, where the browser supports it. */
  autoExport: boolean;
};

export const DEFAULT_BACKUP: BackupRecord = {
  lastExportedAt: null,
  lastExportedSets: 0,
  autoExport: false,
};

/** A single forward step. Receives the previous version's shape, returns the next one. */
type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by the version each step produces. Applied in ascending order, so a user coming from
 * v0 runs every step in turn rather than jumping straight to the latest shape.
 */
const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: the profile tab, and a flag recording that the weight unit has been defaulted
  // from the phone's region once. Installs from before this have neither.
  2: (state) => ({
    ...state,
    profile: { ...DEFAULT_PROFILE, ...(asRecord(state.profile) ?? {}) },
    settings: {
      ...DEFAULT_SETTINGS,
      ...(asRecord(state.settings) ?? {}),
      // An existing user already had a unit they were happy with; treat it as their choice
      // so the region default cannot overwrite it on the first launch after upgrading.
      // Region seeding is gone as of 1.2.8 and nothing reads this key any more - it is written
      // exactly as it was because a shipped migration step is never edited.
      unitSeededFromDevice: true,
    },
  }),
  // v2 -> v3: the exercise-photo switch, and a record of which milestones have already been
  // celebrated. An existing user has earned their milestones quietly up to now, so they are
  // backfilled as already seen rather than firing a stack of popups on first launch - that is
  // handled where the state is first computed, not here.
  3: (state) => ({
    ...state,
    settings: { ...DEFAULT_SETTINGS, ...(asRecord(state.settings) ?? {}) },
    celebratedMilestones: Array.isArray(state.celebratedMilestones)
      ? state.celebratedMilestones
      : [],
  }),
  // v3 -> v4: the week-balance review on the Plans tab, and the list of groups whose advice the
  // user has dismissed. An upgrading user has dismissed nothing, so they see the full review -
  // which is right, because they have never been shown it before.
  4: (state) => ({
    ...state,
    ignoredBalanceGroups: Array.isArray(state.ignoredBalanceGroups)
      ? state.ignoredBalanceGroups
      : [],
  }),
  // v4 -> v5: backup bookkeeping. An upgrading user has never exported, which is exactly what
  // the defaults say, so they are prompted to - which is the point of the release.
  5: (state) => ({
    ...state,
    backup: { ...DEFAULT_BACKUP, ...(asRecord(state.backup) ?? {}) },
  }),
  // v5 -> v6: the version log behind Profile > About. An upgrading install has no history to
  // recover - nothing recorded it before now - so it starts empty and gains its first entry on
  // this launch, which is honest: that is the first version we can vouch for having run.
  6: (state) => ({
    ...state,
    versionHistory: Array.isArray(state.versionHistory) ? state.versionHistory : [],
  }),
  /*
   * v6 -> v7: a plan is a day of the week rather than a free-text name.
   *
   * Existing plans are dealt onto weekdays in the order they were created - the first becomes
   * Monday, the second Tuesday - because there is nothing in the old data that says which day
   * anyone actually trained. It is a starting point the user can change in two taps, and it
   * preserves their ordering, which is the only signal the old shape carried.
   *
   * A plan whose name already IS a weekday keeps that day; someone who called one "Wednesday"
   * meant it. Their old names are kept in `name` either way rather than discarded.
   */
  7: (state) => {
    const plans = Array.isArray(state.plans) ? [...(state.plans as Record<string, unknown>[])] : [];
    const taken = new Set<string>();

    const named = plans.map((plan) => {
      const raw = typeof plan.name === 'string' ? plan.name.trim().toLowerCase() : '';
      const match = WEEKDAY_VALUES.find((d) => d === raw);
      if (match && !taken.has(match)) {
        taken.add(match);
        return { plan, day: match };
      }
      return { plan, day: null as string | null };
    });

    let next = 0;
    for (const row of named) {
      if (row.day !== null) continue;
      while (next < WEEKDAY_VALUES.length && taken.has(WEEKDAY_VALUES[next])) next += 1;
      // More than seven plans is more than a week; the surplus doubles up on Sunday rather
      // than being dropped, and the user sorts it out.
      const day = WEEKDAY_VALUES[Math.min(next, WEEKDAY_VALUES.length - 1)];
      taken.add(day);
      row.day = day;
    }

    return { ...state, plans: named.map(({ plan, day }) => ({ ...plan, day })) };
  },
};

/** Duplicated from types.ts so a migration never changes meaning when that file is edited. */
const WEEKDAY_VALUES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * A number that can be used in arithmetic, or undefined.
 *
 * `Number.isFinite` and not `typeof === 'number'`, because NaN is a number and one NaN is all
 * it takes. A NaN weight makes a workout's tonnage NaN; a NaN timestamp makes an entire muscle
 * group NaN on the body map, which paints nothing and reports no error. JSON cannot carry
 * either, but a hand-edited file, a half-written export or a third-party tool can.
 */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

const SET_KINDS = new Set<string>(['weight_reps', 'reps', 'time', 'distance_time']);

function asKind(value: unknown): SetKind {
  return SET_KINDS.has(value as string) ? (value as SetKind) : 'weight_reps';
}

function asWeekday(value: unknown): Weekday {
  return (WEEKDAY_VALUES as readonly string[]).includes(value as string)
    ? (value as Weekday)
    : 'monday';
}

/** The four numbers a set or template can carry, keeping only the ones that are usable. */
function coerceValues(raw: Record<string, unknown>): {
  weightKg?: number;
  reps?: number;
  timeSec?: number;
  distanceM?: number;
} {
  const out: ReturnType<typeof coerceValues> = {};
  const weightKg = finite(raw.weightKg);
  const reps = finite(raw.reps);
  const timeSec = finite(raw.timeSec);
  const distanceM = finite(raw.distanceM);
  if (weightKg !== undefined) out.weightKg = weightKg;
  if (reps !== undefined) out.reps = reps;
  if (timeSec !== undefined) out.timeSec = timeSec;
  if (distanceM !== undefined) out.distanceM = distanceM;
  return out;
}

/**
 * One recorded or planned set.
 *
 * `fallbackLoggedAt` is what a set gets when it claims to be recorded at a moment that is not a
 * moment. Inside a finished workout that is the workout's own end time, which keeps the set
 * counted and puts it on the right day; inside a live one there is no honest answer, so it
 * becomes a planned set and the user can record it again.
 */
function coerceSet(raw: unknown, id: string, fallbackLoggedAt: number | null): SessionSet | null {
  const r = asRecord(raw);
  if (r === null) return null;
  const loggedAt =
    r.loggedAt === null || r.loggedAt === undefined
      ? null
      : (finite(r.loggedAt) ?? fallbackLoggedAt);
  return { ...coerceValues(r), id: text(r.id, id), loggedAt };
}

/**
 * One exercise within a workout.
 *
 * Dropped outright when it has no exercise id, and that is the one place this function throws
 * anything away. A set that cannot say which movement it belongs to cannot be shown, counted
 * or attributed to a muscle; there is nothing in it to preserve, and keeping it would only put
 * an unnameable row in the history editor forever.
 */
function coerceEntry(
  raw: unknown,
  id: string,
  fallbackLoggedAt: number | null,
): SessionEntry | null {
  const r = asRecord(raw);
  if (r === null || typeof r.exerciseId !== 'string') return null;
  return {
    id: text(r.id, id),
    exerciseId: r.exerciseId,
    kind: asKind(r.kind),
    restSec: finite(r.restSec) ?? DEFAULT_SETTINGS.defaultRestSec,
    sets: asArray<unknown>(r.sets)
      .map((s, i) => coerceSet(s, `${id}_s${i}`, fallbackLoggedAt))
      .filter((s): s is SessionSet => s !== null),
  };
}

/**
 * One workout.
 *
 * A garbled `endedAt` becomes null, which makes the workout live again rather than finished at
 * an unknown time. That is deliberate: `closeStaleSessions` already knows how to settle a live
 * workout from an earlier day, closing it at its last recorded set or dropping it if it has
 * none, and reusing that path beats inventing a second answer here.
 */
function coerceSession(raw: unknown, id: string): Session | null {
  const r = asRecord(raw);
  if (r === null) return null;

  const endedAt = r.endedAt === null || r.endedAt === undefined ? null : (finite(r.endedAt) ?? null);
  const entries = asArray<unknown>(r.entries)
    .map((e, i) => coerceEntry(e, `${id}_e${i}`, endedAt))
    .filter((e): e is SessionEntry => e !== null);

  // A workout with no start time is dated from its own earliest recorded set, which is the only
  // evidence left of when it happened. Reduced rather than spread: ten years of training is
  // tens of thousands of sets, and Math.min(...) on that overflows the call stack.
  let earliest: number | null = null;
  for (const entry of entries) {
    for (const set of entry.sets) {
      if (set.loggedAt !== null && (earliest === null || set.loggedAt < earliest)) {
        earliest = set.loggedAt;
      }
    }
  }

  return {
    id: text(r.id, id),
    planId: typeof r.planId === 'string' ? r.planId : null,
    planName: text(r.planName, 'Workout'),
    startedAt: finite(r.startedAt) ?? earliest ?? 0,
    endedAt,
    entries,
  };
}

function coercePlanItem(raw: unknown, id: string): PlanItem | null {
  const r = asRecord(raw);
  if (r === null || typeof r.exerciseId !== 'string') return null;
  const kind = asKind(r.kind);
  return {
    id: text(r.id, id),
    exerciseId: r.exerciseId,
    kind,
    restSec: finite(r.restSec) ?? DEFAULT_SETTINGS.defaultRestSec,
    ...(typeof r.note === 'string' ? { note: r.note } : {}),
    templates: asArray<unknown>(r.templates)
      .map((t, i): SetTemplate | null => {
        const tr = asRecord(t);
        return tr === null ? null : { ...coerceValues(tr), id: text(tr.id, `${id}_t${i}`) };
      })
      .filter((t): t is SetTemplate => t !== null),
  };
}

function coercePlan(raw: unknown, id: string): Plan | null {
  const r = asRecord(raw);
  if (r === null) return null;
  const createdAt = finite(r.createdAt) ?? finite(r.updatedAt) ?? 0;
  return {
    id: text(r.id, id),
    day: asWeekday(r.day),
    ...(typeof r.name === 'string' ? { name: r.name } : {}),
    ...(typeof r.note === 'string' ? { note: r.note } : {}),
    items: asArray<unknown>(r.items)
      .map((i, n) => coercePlanItem(i, `${id}_i${n}`))
      .filter((i): i is PlanItem => i !== null),
    createdAt,
    updatedAt: finite(r.updatedAt) ?? createdAt,
  };
}

function coerceProfile(stored: Record<string, unknown>): Profile {
  const merged = { ...DEFAULT_PROFILE, ...stored };
  return {
    ...merged,
    displayName: text(merged.displayName, ''),
    birthDate: typeof merged.birthDate === 'string' ? merged.birthDate : null,
    heightCm: finite(merged.heightCm) ?? null,
    weightKg: finite(merged.weightKg) ?? null,
    equipment: asArray<string>(merged.equipment).filter((x) => typeof x === 'string'),
  };
}

/**
 * Brings a persisted blob of any prior version up to SCHEMA_VERSION.
 *
 * Deliberately synchronous: zustand's persist middleware does not await an async migrate,
 * and returns the initial state instead - which for us would read as "all your data is gone".
 */
export function migratePersisted(persisted: unknown, fromVersion: number): PersistedState {
  let state = asRecord(persisted) ?? {};

  for (let v = fromVersion + 1; v <= SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) state = step(state);
  }

  return coerce(state);
}

/**
 * Last line of defence before the blob becomes live state.
 *
 * zustand casts whatever it read straight to the state type without checking it, so a truncated
 * write, a hand-edited backup or a payload from a future version would otherwise surface as a
 * crash on a screen that assumed an array. Not a caught error either: the store is read on
 * launch, so a bad row is a white screen on open with no way back short of clearing storage,
 * which is the data loss this whole file exists to prevent.
 *
 * WHY THIS GOES ALL THE WAY DOWN
 * It used to check only that `plans` and `sessions` were arrays, and trust everything inside
 * them. That is not enough by a long way. One session whose `entries` is missing takes out
 * History, the body map, the milestone strip and the backup summary, because every one of them
 * loops over every session on load. Same for an entry with no `sets`, or a null in either list.
 *
 * WHAT IT WILL AND WILL NOT DISCARD
 * The rule is that a set with a readable exercise, and a moment it happened, always survives.
 * Everything else is repaired towards a default rather than dropped. Exactly two things are
 * discarded, and only because there is provably nothing in them to keep: a row that is not an
 * object at all, and an entry with no exercise id, whose sets could never be shown, counted or
 * attributed to a muscle.
 */
/**
 * Settings over the defaults, with the theme checked against the palettes that exist.
 *
 * Themes get retired - Blueprint and Platinum went at 1.6 - and the id of a retired one is
 * still sitting in the settings of anyone who had it selected. Left alone it names nothing:
 * the picker shows no selection, and the launch cache quietly falls back while the stored
 * value stays wrong forever. Replacing it with the default is the honest repair, and it costs
 * that user a colour rather than anything they recorded.
 */
function coerceSettings(stored: Record<string, unknown>): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  const themeId =
    typeof merged.themeId === 'string' && merged.themeId in THEMES
      ? (merged.themeId as Settings['themeId'])
      : DEFAULT_THEME;
  return { ...merged, themeId };
}

export function coerce(state: Record<string, unknown>): PersistedState {
  const activeSessionId = state.activeSessionId;
  return {
    plans: asArray<unknown>(state.plans)
      .map((p, i) => coercePlan(p, `p_fixed${i}`))
      .filter((p): p is Plan => p !== null),
    sessions: asArray<unknown>(state.sessions)
      .map((s, i) => coerceSession(s, `s_fixed${i}`))
      .filter((s): s is Session => s !== null),
    settings: coerceSettings(asRecord(state.settings) ?? {}),
    profile: coerceProfile(asRecord(state.profile) ?? {}),
    activeSessionId: typeof activeSessionId === 'string' ? activeSessionId : null,
    celebratedMilestones: asArray<string>(state.celebratedMilestones).filter(
      (x) => typeof x === 'string',
    ),
    ignoredBalanceGroups: asArray<string>(state.ignoredBalanceGroups).filter(
      (x) => typeof x === 'string',
    ),
    backup: { ...DEFAULT_BACKUP, ...(asRecord(state.backup) ?? {}) },
    versionHistory: asArray<VersionSeen>(state.versionHistory).filter(
      (v) => asRecord(v) !== null && typeof (v as VersionSeen).version === 'string',
    ),
  };
}
