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
export const SCHEMA_VERSION = 7;

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
    backup: { ...DEFAULT_BACKUP, ...(asRecord(state.backup) ?? {}) },
    versionHistory: asArray<VersionSeen>(state.versionHistory).filter(
      (v) => asRecord(v) !== null && typeof (v as VersionSeen).version === 'string',
    ),
  };
}
