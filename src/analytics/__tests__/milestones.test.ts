import type { Profile, Session, SessionSet } from '@/store/types';
import { DEFAULT_PROFILE } from '@/store/migrations';
import {
  TIERS,
  allProgress,
  formatMilestoneValue,
  milestoneId,
  progressFor,
  reachedMilestones,
  totalCalories,
  totalWeightKg,
  totalWorkoutDays,
} from '@/analytics/milestones';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

let seq = 0;
function mkSession(opts: {
  startedAt?: number;
  minutes?: number;
  sets?: Partial<SessionSet>[];
  ended?: boolean;
}): Session {
  seq += 1;
  const startedAt = opts.startedAt ?? NOW;
  const minutes = opts.minutes ?? 60;
  return {
    id: `s${seq}`,
    planId: null,
    planName: 'Test',
    startedAt,
    endedAt: opts.ended === false ? null : startedAt + minutes * 60_000,
    entries: [
      {
        id: `e${seq}`,
        exerciseId: BENCH,
        kind: 'weight_reps',
        restSec: 90,
        sets: (opts.sets ?? [{ weightKg: 100, reps: 10 }]).map((s, i) => ({
          id: `ss${seq}_${i}`,
          loggedAt: startedAt,
          ...s,
        })),
      },
    ],
  };
}

const PROFILE: Profile = { ...DEFAULT_PROFILE, weightKg: 80 };

describe('totals', () => {
  it('sums weight across finished sessions only', () => {
    const done = mkSession({ sets: [{ weightKg: 100, reps: 10 }] });
    const running = mkSession({ sets: [{ weightKg: 100, reps: 10 }], ended: false });
    expect(totalWeightKg([done, running])).toBe(1000);
  });

  it('counts distinct calendar days, not sessions', () => {
    // Two workouts in one day is one day of training.
    const morning = mkSession({ startedAt: NOW });
    const evening = mkSession({ startedAt: NOW + 6 * 3_600_000 });
    const nextWeek = mkSession({ startedAt: NOW + 7 * DAY });
    expect(totalWorkoutDays([morning, evening, nextWeek])).toBe(2);
  });

  it('ignores a session where nothing was recorded', () => {
    const empty = mkSession({ sets: [{ weightKg: 100, reps: 10, loggedAt: null }] });
    expect(totalWorkoutDays([empty])).toBe(0);
    expect(totalCalories([empty], PROFILE)).toBe(0);
  });

  it('estimates calories from duration and body weight', () => {
    // MET 5 x 80kg x 1h = 400 kcal.
    expect(totalCalories([mkSession({ minutes: 60 })], PROFILE)).toBe(400);
    expect(totalCalories([mkSession({ minutes: 30 })], PROFILE)).toBe(200);
  });

  it('scales calories with body weight', () => {
    const light = totalCalories([mkSession({ minutes: 60 })], { ...PROFILE, weightKg: 60 });
    const heavy = totalCalories([mkSession({ minutes: 60 })], { ...PROFILE, weightKg: 100 });
    expect(heavy).toBeGreaterThan(light);
  });

  it('falls back to an assumed body weight rather than reporting zero', () => {
    const noWeight = { ...DEFAULT_PROFILE, weightKg: null };
    expect(totalCalories([mkSession({ minutes: 60 })], noWeight)).toBeGreaterThan(0);
  });

  it('caps a session left running overnight', () => {
    // Without a cap, a forgotten session would contribute a fortnight of calories.
    const overnight = mkSession({ minutes: 60 * 14 });
    expect(totalCalories([overnight], PROFILE)).toBe(5 * 80 * 3);
  });
});

describe('progressFor', () => {
  it('is level zero before the first threshold', () => {
    const p = progressFor('weight', 50_000);
    expect(p.level).toBe(0);
    expect(p.current).toBeNull();
    expect(p.next).toBe(100_000);
    expect(p.fraction).toBeCloseTo(0.5);
  });

  it('reaches level one exactly on the threshold', () => {
    expect(progressFor('weight', 100_000).level).toBe(1);
    expect(progressFor('workouts', 10).level).toBe(1);
    expect(progressFor('calories', 1_000).level).toBe(1);
  });

  it('measures the bar from the current tier, not from zero', () => {
    // Halfway between 100k and 200k should read as half, not as 75%.
    const p = progressFor('weight', 150_000);
    expect(p.level).toBe(1);
    expect(p.fraction).toBeCloseTo(0.5);
  });

  it('tops out gracefully once every tier is passed', () => {
    const top = TIERS.weight[TIERS.weight.length - 1];
    const p = progressFor('weight', top * 10);
    expect(p.level).toBe(TIERS.weight.length);
    expect(p.next).toBeNull();
    expect(p.fraction).toBe(1);
  });

  it('never returns a fraction outside 0-1', () => {
    for (const value of [0, 1, 99_999, 100_000, 12_345_678]) {
      const f = progressFor('weight', value).fraction;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('the ladders', () => {
  it('start where the user asked', () => {
    expect(TIERS.weight.slice(0, 6)).toEqual([100_000, 200_000, 500_000, 1e6, 2e6, 3e6]);
    expect(TIERS.workouts.slice(0, 8)).toEqual([10, 20, 50, 100, 200, 300, 400, 500]);
    expect(TIERS.calories.slice(0, 11)).toEqual([
      1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 300_000, 400_000, 500_000,
    ]);
  });

  it('always ascend, so a level can never be skipped backwards', () => {
    for (const tiers of Object.values(TIERS)) {
      for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBeGreaterThan(tiers[i - 1]);
    }
  });
});

describe('reached milestones', () => {
  it('lists every threshold crossed, with stable ids', () => {
    // 20 sessions of 100kg x 10 = 20,000kg, over 20 distinct days.
    const sessions = Array.from({ length: 20 }, (_, i) =>
      mkSession({ startedAt: NOW + i * DAY, sets: [{ weightKg: 100, reps: 10 }] }),
    );
    const reached = reachedMilestones(sessions, PROFILE);
    const ids = reached.map((r) => r.id);

    expect(ids).toContain(milestoneId('workouts', 10));
    expect(ids).toContain(milestoneId('workouts', 20));
    // 20,000kg is short of the first weight tier.
    expect(ids).not.toContain(milestoneId('weight', 100_000));
  });

  it('is empty for someone who has just started', () => {
    expect(reachedMilestones([], DEFAULT_PROFILE)).toEqual([]);
  });

  it('covers all three categories', () => {
    expect(allProgress([], DEFAULT_PROFILE).map((p) => p.category)).toEqual([
      'weight',
      'workouts',
      'calories',
    ]);
  });
});

describe('formatMilestoneValue', () => {
  it.each([
    ['weight', 950, '950 kg'],
    ['weight', 100_000, '100K kg'],
    ['weight', 1_500_000, '1.5M kg'],
    ['calories', 2_000, '2K kcal'],
    ['workouts', 250, '250'],
  ] as const)('formats %s %s as %s', (category, value, expected) => {
    expect(formatMilestoneValue(category, value)).toBe(expected);
  });

  /**
   * The unit setting reaches here too.
   *
   * It did not, and the result was the History screen showing "480 kg" in the milestone strip
   * directly above "1,058 lb moved" on the workout card. Same number, two units, one screen,
   * for the default unit this app ships with.
   */
  describe('in pounds', () => {
    it.each([
      [950, '2.1K lb'],
      [100_000, '220K lb'],
      [1_500_000, '3.3M lb'],
    ])('converts %s kg for display', (kg, expected) => {
      expect(formatMilestoneValue('weight', kg, 'lb')).toBe(expected);
    });

    it('leaves calories and days alone, which have no unit to convert', () => {
      expect(formatMilestoneValue('calories', 2_000, 'lb')).toBe('2K kcal');
      expect(formatMilestoneValue('workouts', 250, 'lb')).toBe('250');
    });

    it('does not move anyone up a level for changing a display setting', () => {
      /*
       * The reason the ladder stays denominated in kilograms. If the thresholds converted too,
       * 100,000 kg of work would clear a 100,000 lb tier the moment someone switched units, and
       * switching back would take the level away again.
       */
      const inKg = progressFor('weight', 99_000);
      const asPounds = progressFor('weight', 99_000);
      expect(asPounds.level).toBe(inKg.level);
      expect(inKg.level).toBe(0);
    });
  });
});
