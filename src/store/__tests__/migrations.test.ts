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

  it('does not let the phone region overwrite an existing user unit', () => {
    // An upgrading user already had a unit; the v2 seed must treat it as deliberate.
    expect(migrated.settings.unitSeededFromDevice).toBe(true);
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
    expect(migrated.settings.unitSeededFromDevice).toBe(true);
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
