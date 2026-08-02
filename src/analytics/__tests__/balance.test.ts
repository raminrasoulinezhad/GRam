import {
  DAYS_PER_WEEK_TARGET,
  GROUP_MUSCLES,
  TRAINING_GROUPS,
  plansMissing,
  reviewWeek,
  suggestionFor,
  type TrainingGroup,
} from '@/analytics/balance';
import { RECOMMENDED, getExercise } from '@/catalog';
import type { Plan, Weekday } from '@/store/types';

let seq = 0;
function plan(day: Weekday, exerciseIds: string[]): Plan {
  seq += 1;
  return {
    id: `p${seq}`,
    day,
    createdAt: 0,
    updatedAt: 0,
    items: exerciseIds.map((exerciseId, i) => ({
      id: `pi${seq}_${i}`,
      exerciseId,
      kind: 'weight_reps',
      restSec: 90,
      templates: [{ id: `t${seq}_${i}`, weightKg: 40, reps: 8 }],
    })),
  };
}

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const INCLINE = 'Incline_Dumbbell_Press';
const SQUAT = 'Barbell_Squat';
const CURL = 'Barbell_Curl';

describe('what counts as covered', () => {
  it('needs the group on two different days', () => {
    const one = reviewWeek([plan('monday', [BENCH])]);
    expect(one.coverage.find((c) => c.group === 'chest')!.covered).toBe(false);

    const two = reviewWeek([plan('monday', [BENCH]), plan('tuesday', [INCLINE])]);
    expect(two.coverage.find((c) => c.group === 'chest')!.covered).toBe(true);
  });

  it('does not count two exercises in the same plan as two days', () => {
    // Frequency is the point. Two chest exercises on Monday is still one session.
    const review = reviewWeek([plan('monday', [BENCH, INCLINE])]);
    const chest = review.coverage.find((c) => c.group === 'chest')!;
    expect(chest.planIds).toHaveLength(1);
    expect(chest.covered).toBe(false);
  });

  it('counts only primary muscles', () => {
    // Bench press assists the triceps, but a week whose only triceps work is bench press is
    // not a week that trains triceps.
    const review = reviewWeek([plan('monday', [BENCH]), plan('tuesday', [INCLINE])]);
    expect(review.coverage.find((c) => c.group === 'chest')!.covered).toBe(true);
    expect(review.coverage.find((c) => c.group === 'triceps')!.planIds).toEqual([]);
  });

  it('treats lats and mid back as one group', () => {
    const review = reviewWeek([
      plan('monday', ['Pullups']), // lats
      plan('tuesday', ['Bent_Over_Barbell_Row']), // middle back
    ]);
    expect(review.coverage.find((c) => c.group === 'back')!.covered).toBe(true);
  });

  it('reports how many more days a group needs', () => {
    const review = reviewWeek([plan('monday', [BENCH])]);
    expect(review.coverage.find((c) => c.group === 'chest')!.shortBy).toBe(1);
    expect(review.coverage.find((c) => c.group === 'biceps')!.shortBy).toBe(
      DAYS_PER_WEEK_TARGET,
    );
  });

  it('names the days that do cover it, for the advice text', () => {
    const review = reviewWeek([plan('monday', [BENCH]), plan('friday', [SQUAT])]);
    expect(review.coverage.find((c) => c.group === 'chest')!.planNames).toEqual(['Monday']);
  });
});

describe('too few days', () => {
  it('is reported when there are no plans at all', () => {
    const review = reviewWeek([]);
    expect(review.tooFewDays).toEqual({ have: 0, need: 2 });
    expect(review.balanced).toBe(false);
  });

  it('is reported for a single plan, however good that plan is', () => {
    // "Twice, on different days" cannot be met by one day, whatever is in it.
    const everything = plan('monday', TRAINING_GROUPS.map(suggestionFor));
    const review = reviewWeek([everything]);
    expect(review.tooFewDays).toEqual({ have: 1, need: 2 });
    expect(review.balanced).toBe(false);
    expect(review.covered).toEqual([]);
  });

  it('clears as soon as there is a second plan', () => {
    const picks = TRAINING_GROUPS.map(suggestionFor);
    const review = reviewWeek([plan('monday', picks), plan('tuesday', picks)]);
    expect(review.tooFewDays).toBeNull();
    expect(review.balanced).toBe(true);
  });
});

describe('reviewing a whole week', () => {
  it('flags every group when there are no plans', () => {
    const review = reviewWeek([]);
    expect(review.issues).toHaveLength(TRAINING_GROUPS.length);
    expect(review.balanced).toBe(false);
  });

  it('is balanced when every group has two days', () => {
    // Two full-body days built from the recommended picks.
    const picks = TRAINING_GROUPS.map(suggestionFor);
    const review = reviewWeek([plan('monday', picks), plan('tuesday', picks)]);
    expect(review.issues).toEqual([]);
    expect(review.balanced).toBe(true);
    expect(review.covered).toHaveLength(TRAINING_GROUPS.length);
  });

  it('ignores an exercise id that is no longer in the catalog', () => {
    // A plan can outlive a catalog entry; that must not throw.
    expect(() => reviewWeek([plan('sunday', ['does_not_exist'])])).not.toThrow();
    expect(reviewWeek([plan('sunday', ['does_not_exist'])]).issues).toHaveLength(
      TRAINING_GROUPS.length,
    );
  });
});

describe('dismissing advice', () => {
  const plans = [plan('monday', [BENCH])];

  it('drops a dismissed group out of the issues', () => {
    const review = reviewWeek(plans, ['biceps']);
    expect(review.issues.map((i) => i.group)).not.toContain('biceps');
  });

  it('still reports it as dismissed rather than forgetting it', () => {
    const review = reviewWeek(plans, ['biceps']);
    expect(review.dismissed.map((d) => d.group)).toEqual(['biceps']);
    expect(review.coverage.find((c) => c.group === 'biceps')!.ignored).toBe(true);
  });

  it('can read as balanced once every outstanding group is dismissed', () => {
    // Two plans, so the structural rule is satisfied and only the muscle advice is left.
    const twoDays = [plan('monday', [BENCH]), plan('tuesday', ['Pullups'])];
    const review = reviewWeek(twoDays, [...TRAINING_GROUPS]);
    expect(review.balanced).toBe(true);
    expect(review.dismissed.length).toBeGreaterThan(0);
  });

  it('cannot be dismissed away while there are too few days', () => {
    // The structural gap is a precondition, not an opinion, so silencing every group does not
    // make a one-day week balanced.
    const review = reviewWeek([plan('monday', [BENCH])], [...TRAINING_GROUPS]);
    expect(review.tooFewDays).toEqual({ have: 1, need: 2 });
    expect(review.balanced).toBe(false);
  });

  it('does not mark a covered group as dismissed', () => {
    const covered = [plan('monday', [CURL]), plan('tuesday', [CURL])];
    const review = reviewWeek(covered, ['biceps']);
    expect(review.dismissed).toEqual([]);
    expect(review.covered.map((c) => c.group)).toContain('biceps');
  });
});

describe('fixing an issue', () => {
  it('suggests the recommended exercise for the group', () => {
    for (const group of TRAINING_GROUPS) {
      const suggestion = suggestionFor(group);
      expect(suggestion).toBe(RECOMMENDED[GROUP_MUSCLES[group][0]][0]);
      expect(getExercise(suggestion)).toBeDefined();
    }
  });

  it('suggests something that actually trains the group as a primary muscle', () => {
    // Otherwise the fix would not close the issue it was offered for.
    for (const group of TRAINING_GROUPS) {
      const e = getExercise(suggestionFor(group))!;
      const hits = e.primaryMuscles.some((m) => GROUP_MUSCLES[group].includes(m));
      expect([group, hits]).toEqual([group, true]);
    }
  });

  it('offers only the days that do not already train it', () => {
    const push = plan('monday', [BENCH]);
    const legs = plan('thursday', [SQUAT]);
    expect(plansMissing([push, legs], 'chest').map((p) => p.day)).toEqual(['thursday']);
  });

  it('offers nothing when every day already trains it', () => {
    const plans = [plan('monday', [BENCH]), plan('tuesday', [INCLINE])];
    expect(plansMissing(plans, 'chest')).toEqual([]);
  });

  it('closes the issue once applied', () => {
    // Simulates the Fix button: add the suggestion to the offered day and re-review.
    const before = [plan('monday', [BENCH]), plan('wednesday', [SQUAT])];
    expect(reviewWeek(before).issues.map((i) => i.group)).toContain('chest');

    const target = plansMissing(before, 'chest')[0];
    const after = before.map((p) =>
      p.id === target.id ? plan(p.day, [SQUAT, suggestionFor('chest')]) : p,
    );
    expect(reviewWeek(after).issues.map((i) => i.group)).not.toContain('chest');
  });
});

describe('the group definitions', () => {
  it('covers the eight groups a lifter plans around', () => {
    expect([...TRAINING_GROUPS].sort()).toEqual(
      (
        [
          'back',
          'biceps',
          'chest',
          'glutes',
          'hamstrings',
          'quadriceps',
          'shoulders',
          'triceps',
        ] as TrainingGroup[]
      ).sort(),
    );
  });

  it('maps every group onto at least one real catalog muscle', () => {
    for (const group of TRAINING_GROUPS) {
      expect(GROUP_MUSCLES[group].length).toBeGreaterThan(0);
    }
  });
});
