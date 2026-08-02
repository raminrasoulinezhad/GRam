import type { Plan, Profile, Session, Settings } from './types';

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
export const SCHEMA_VERSION = 4;

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  defaultRestSec: 90,
  defaultSetCount: 3,
  bodyGender: 'male',
  unitSeededFromDevice: false,
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
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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
 * zustand casts whatever it read straight to the state type without checking it, so a
 * truncated write, a hand-edited backup or a payload from a future version would otherwise
 * surface as a crash on a screen that assumed an array. Anything unrecognisable falls back to
 * a default; anything recognisable is kept. Losing a malformed *setting* is acceptable, losing
 * plans or sessions is not, so those are only ever replaced when they are not arrays at all.
 */
export function coerce(state: Record<string, unknown>): PersistedState {
  const activeSessionId = state.activeSessionId;
  return {
    plans: asArray<Plan>(state.plans),
    sessions: asArray<Session>(state.sessions),
    settings: { ...DEFAULT_SETTINGS, ...(asRecord(state.settings) ?? {}) },
    profile: { ...DEFAULT_PROFILE, ...(asRecord(state.profile) ?? {}) },
    activeSessionId: typeof activeSessionId === 'string' ? activeSessionId : null,
    celebratedMilestones: asArray<string>(state.celebratedMilestones).filter(
      (x) => typeof x === 'string',
    ),
    ignoredBalanceGroups: asArray<string>(state.ignoredBalanceGroups).filter(
      (x) => typeof x === 'string',
    ),
  };
}
