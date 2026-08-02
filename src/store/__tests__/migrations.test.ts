import { volumeInWindow } from '@/analytics/volume';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  coerce,
  migratePersisted,
} from '@/store/migrations';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const LOGGED_AT = Date.now() - 3600_000;

/**
 * A real v1 payload, as written by the first released build. Never edit this - it is the
 * evidence that a user who installed v1 can upgrade without losing anything. Add a new
 * fixture per schema version instead.
 */
const V1_PAYLOAD = {
  plans: [
    {
      id: 'p1',
      name: 'Push day',
      items: [
        {
          id: 'pi1',
          exerciseId: BENCH,
          kind: 'weight_reps',
          restSec: 90,
          templates: [{ id: 't1', weightKg: 60, reps: 8 }],
        },
      ],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
  ],
  sessions: [
    {
      id: 's1',
      planId: 'p1',
      planName: 'Push day',
      startedAt: LOGGED_AT,
      endedAt: LOGGED_AT + 1000,
      entries: [
        {
          id: 'e1',
          exerciseId: BENCH,
          kind: 'weight_reps',
          restSec: 90,
          sets: [
            { id: 'ss1', weightKg: 60, reps: 8, loggedAt: LOGGED_AT },
            { id: 'ss2', weightKg: 60, reps: 6, loggedAt: LOGGED_AT },
          ],
        },
      ],
    },
  ],
  settings: { unit: 'lb', defaultRestSec: 120, defaultSetCount: 4, bodyGender: 'female' },
  activeSessionId: null,
};

describe('upgrading from v1', () => {
  const migrated = migratePersisted(V1_PAYLOAD, 1);

  it('keeps every plan, exercise and template set', () => {
    expect(migrated.plans).toHaveLength(1);
    expect(migrated.plans[0].name).toBe('Push day');
    expect(migrated.plans[0].items[0].templates[0]).toMatchObject({ weightKg: 60, reps: 8 });
  });

  it('keeps every logged workout', () => {
    expect(migrated.sessions).toHaveLength(1);
    expect(migrated.sessions[0].entries[0].sets).toHaveLength(2);
    expect(migrated.sessions[0].entries[0].sets.every((s) => s.loggedAt !== null)).toBe(true);
  });

  it('keeps the training history readable by the analytics layer', () => {
    // The real test of a migration: the data still means the same thing afterwards.
    expect(volumeInWindow(migrated.sessions, Date.now()).chest).toBeCloseTo(2);
  });

  it('preserves settings the user had chosen', () => {
    expect(migrated.settings).toMatchObject({
      unit: 'lb',
      defaultRestSec: 120,
      defaultSetCount: 4,
      bodyGender: 'female',
    });
  });

  it('does not impose the new default unit on someone who already had one', () => {
    // The fresh-install default is pounds. A v1 user who was on kilograms stays on kilograms.
    const onKg = migratePersisted(
      { ...V1_PAYLOAD, settings: { ...V1_PAYLOAD.settings, unit: 'kg' } },
      1,
    );
    expect(onKg.settings.unit).toBe('kg');
  });

  it('adds the profile that v1 never had', () => {
    expect(migrated.profile).toEqual(DEFAULT_PROFILE);
  });
});

/** A v2 payload: profile and unit-seed flag present, no photo switch, no milestone record. */
const V2_PAYLOAD = {
  ...V1_PAYLOAD,
  settings: {
    unit: 'kg',
    defaultRestSec: 90,
    defaultSetCount: 3,
    bodyGender: 'male',
    unitSeededFromDevice: true,
  },
  profile: { ...DEFAULT_PROFILE, displayName: 'Existing user', weightKg: 82 },
};

describe('upgrading from v2', () => {
  const migrated = migratePersisted(V2_PAYLOAD, 2);

  it('keeps the training log and the profile the user filled in', () => {
    expect(migrated.sessions[0].entries[0].sets).toHaveLength(2);
    expect(migrated.profile.displayName).toBe('Existing user');
    expect(migrated.profile.weightKg).toBe(82);
  });

  it('turns exercise photos on by default, matching previous behaviour', () => {
    expect(migrated.settings.showExercisePhotos).toBe(true);
  });

  it('starts with no milestones recorded as seen', () => {
    expect(migrated.celebratedMilestones).toEqual([]);
  });

  it('does not disturb the unit the user had chosen', () => {
    expect(migrated.settings.unit).toBe('kg');
  });
});

/** A v3 payload: photo switch and milestone record present, no week-balance dismissals. */
const V3_PAYLOAD = {
  ...V2_PAYLOAD,
  settings: { ...V2_PAYLOAD.settings, showExercisePhotos: false },
  celebratedMilestones: ['workouts:10'],
};

describe('upgrading from v3', () => {
  const migrated = migratePersisted(V3_PAYLOAD, 3);

  it('keeps the training log, the profile and the milestones already celebrated', () => {
    expect(migrated.sessions[0].entries[0].sets).toHaveLength(2);
    expect(migrated.profile.displayName).toBe('Existing user');
    expect(migrated.celebratedMilestones).toEqual(['workouts:10']);
  });

  it('does not turn the photo switch back on behind the user', () => {
    expect(migrated.settings.showExercisePhotos).toBe(false);
  });

  it('starts with no week-balance advice dismissed', () => {
    // An upgrading user has never been shown the review, so they should see all of it.
    expect(migrated.ignoredBalanceGroups).toEqual([]);
  });
});

/** A v5 payload: backup bookkeeping present, no record of which versions have run. */
const V5_PAYLOAD = {
  ...V3_PAYLOAD,
  ignoredBalanceGroups: ['biceps'],
  backup: { lastExportedAt: 1_800_000_000_000, lastExportedSets: 42, autoExport: true },
};

describe('upgrading from v5', () => {
  const migrated = migratePersisted(V5_PAYLOAD, 5);

  it('keeps the training log and everything already recorded', () => {
    expect(migrated.sessions[0].entries[0].sets).toHaveLength(2);
    expect(migrated.celebratedMilestones).toEqual(['workouts:10']);
    expect(migrated.ignoredBalanceGroups).toEqual(['biceps']);
  });

  it('does not disturb the backup record, including an armed auto-export', () => {
    expect(migrated.backup).toEqual({
      lastExportedAt: 1_800_000_000_000,
      lastExportedSets: 42,
      autoExport: true,
    });
  });

  it('starts the version log empty rather than inventing history', () => {
    // Nothing recorded which builds ran before this one, so claiming any would be a guess.
    expect(migrated.versionHistory).toEqual([]);
  });
});

/** A v6 payload: plans still carry free-text names and no weekday. */
const V6_PAYLOAD = {
  ...V5_PAYLOAD,
  versionHistory: [{ version: '1.2.2', firstSeenAt: 1_800_000_000_000 }],
  plans: [
    { ...V1_PAYLOAD.plans[0], id: 'p1', name: 'Push day' },
    { ...V1_PAYLOAD.plans[0], id: 'p2', name: 'Pull day' },
    { ...V1_PAYLOAD.plans[0], id: 'p3', name: 'Legs' },
  ],
};

describe('upgrading from v6, when plans became weekdays', () => {
  const migrated = migratePersisted(V6_PAYLOAD, 6);

  it('deals existing plans onto weekdays in the order they were created', () => {
    // Nothing in the old data says which day anyone trained, so creation order is the only
    // signal there is. It is a starting point the user can change in two taps.
    expect(migrated.plans.map((p) => p.day)).toEqual(['monday', 'tuesday', 'wednesday']);
  });

  it('keeps the names people typed rather than discarding them', () => {
    expect(migrated.plans.map((p) => p.name)).toEqual(['Push day', 'Pull day', 'Legs']);
  });

  it('keeps every exercise in every plan', () => {
    for (const plan of migrated.plans) expect(plan.items).toHaveLength(1);
  });

  it('honours a plan already named after a day', () => {
    const named = {
      ...V6_PAYLOAD,
      plans: [
        { ...V1_PAYLOAD.plans[0], id: 'a', name: 'Push' },
        { ...V1_PAYLOAD.plans[0], id: 'b', name: 'Wednesday' },
      ],
    };
    const result = migratePersisted(named, 6);
    // Wednesday keeps the day it was called; Push takes the first day left.
    expect(result.plans.find((p) => p.id === 'b')!.day).toBe('wednesday');
    expect(result.plans.find((p) => p.id === 'a')!.day).toBe('monday');
  });

  it('does not lose a plan when there are more than seven', () => {
    const crowded = {
      ...V6_PAYLOAD,
      plans: Array.from({ length: 9 }, (_, i) => ({
        ...V1_PAYLOAD.plans[0],
        id: `p${i}`,
        name: `Day ${i}`,
      })),
    };
    const result = migratePersisted(crowded, 6);
    expect(result.plans).toHaveLength(9);
    for (const plan of result.plans) expect(plan.day).toBeDefined();
  });

  it('keeps the training log untouched', () => {
    expect(migrated.sessions[0].entries[0].sets).toHaveLength(2);
  });
});

describe('upgrading from an unversioned install', () => {
  it('runs every step in order from v0', () => {
    const migrated = migratePersisted(V1_PAYLOAD, 0);
    expect(migrated.plans).toHaveLength(1);
    expect(migrated.sessions).toHaveLength(1);
    expect(migrated.profile).toEqual(DEFAULT_PROFILE);
  });
});

describe('a payload already at the current version', () => {
  it('passes through unchanged', () => {
    const current = migratePersisted(V1_PAYLOAD, 1);
    expect(migratePersisted(current, SCHEMA_VERSION)).toEqual(current);
  });

  it('is idempotent when migrated twice', () => {
    const once = migratePersisted(V1_PAYLOAD, 1);
    const twice = migratePersisted(once, SCHEMA_VERSION);
    expect(twice).toEqual(once);
  });
});

describe('corrupt or hostile payloads', () => {
  it('never throws, whatever it is handed', () => {
    for (const junk of [null, undefined, 0, 'nonsense', [], true]) {
      expect(() => migratePersisted(junk, 1)).not.toThrow();
    }
  });

  it('falls back to empty rather than crashing a screen that expects arrays', () => {
    const result = migratePersisted({ plans: 'not-an-array', sessions: null }, 1);
    expect(result.plans).toEqual([]);
    expect(result.sessions).toEqual([]);
  });

  it('replaces unusable settings with defaults but keeps usable ones', () => {
    const result = coerce({ settings: { unit: 'lb' } });
    expect(result.settings.unit).toBe('lb');
    expect(result.settings.defaultRestSec).toBe(DEFAULT_SETTINGS.defaultRestSec);
  });

  it('nulls a non-string activeSessionId rather than passing it through', () => {
    expect(coerce({ activeSessionId: 42 }).activeSessionId).toBeNull();
    expect(coerce({ activeSessionId: 'sess-1' }).activeSessionId).toBe('sess-1');
  });

  it('keeps plans and sessions whenever they are arrays at all', () => {
    // Deliberately permissive: dropping a user's training log because one field looks odd
    // would be far worse than carrying a slightly malformed row.
    const result = coerce({ plans: [{ id: 'weird' }], sessions: [{ id: 'odd' }] });
    expect(result.plans).toHaveLength(1);
    expect(result.sessions).toHaveLength(1);
  });
});

describe('the migration chain itself', () => {
  it('has a step for every version up to the current one', () => {
    // Guards the most likely mistake: bumping SCHEMA_VERSION without writing the step.
    const fromScratch = migratePersisted({}, 0);
    expect(fromScratch.profile).toEqual(DEFAULT_PROFILE);
    expect(fromScratch.settings).toMatchObject({ unit: DEFAULT_SETTINGS.unit });
  });

  it('is reachable from every prior version', () => {
    for (let from = 0; from < SCHEMA_VERSION; from++) {
      const result = migratePersisted(V1_PAYLOAD, from);
      expect(result.sessions).toHaveLength(1);
      expect(result.profile).toBeDefined();
    }
  });
});

describe('a payload at the current version is still validated', () => {
  /*
   * zustand only calls migrate() when the stored version differs from the current one, so a
   * blob already at SCHEMA_VERSION skips the migration chain entirely. Everything below is
   * what reaches live state through that path - it has to be safe on its own, which is why the
   * store runs coerce() in merge() rather than relying on migrate().
   *
   * This is not hypothetical: it was found by seeding a partial v4 blob into the running app,
   * which rendered a blank screen because a screen read `.length` of a field that was not there.
   */
  it('fills in fields a partial write left out', () => {
    const partial = { plans: [], sessions: [], settings: { unit: 'lb' }, profile: { displayName: 'R' } };
    const result = coerce(partial);

    expect(result.profile.equipment).toEqual([]);
    expect(result.profile.displayName).toBe('R');
    expect(result.settings.unit).toBe('lb');
    expect(result.settings.defaultSetCount).toBe(DEFAULT_SETTINGS.defaultSetCount);
    expect(result.celebratedMilestones).toEqual([]);
    expect(result.ignoredBalanceGroups).toEqual([]);
  });

  it('gives every field the screens read, from an empty object', () => {
    const result = coerce({});
    for (const key of [
      'plans',
      'sessions',
      'settings',
      'profile',
      'activeSessionId',
      'celebratedMilestones',
      'ignoredBalanceGroups',
    ]) {
      expect([key, result[key as keyof typeof result] !== undefined]).toEqual([key, true]);
    }
  });
});
