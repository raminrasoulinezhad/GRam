import {
  PLAN_STALE_WEEKS,
  isPlanStale,
  reviewPlan,
  weeksSince,
} from '@/analytics/planReview';
import type { Plan, Session, SessionSet } from '@/store/types';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';

function plan(updatedAt: number, exerciseIds: string[] = [BENCH]): Plan {
  return {
    id: 'p1',
    day: 'monday',
    items: exerciseIds.map((exerciseId, i) => ({
      id: `i${i}`,
      exerciseId,
      kind: 'weight_reps',
      restSec: 90,
      templates: [{ id: `t${i}`, weightKg: 60, reps: 5 }],
    })),
    createdAt: updatedAt,
    updatedAt,
  };
}

/** A finished workout at `at` recording one top set per exercise. */
function session(at: number, weights: Record<string, number>): Session {
  let n = 0;
  return {
    id: `s${at}`,
    planId: 'p1',
    planName: 'Monday',
    startedAt: at,
    endedAt: at + 3600_000,
    entries: Object.entries(weights).map(([exerciseId, weightKg]) => ({
      id: `e${(n += 1)}`,
      exerciseId,
      kind: 'weight_reps',
      restSec: 90,
      sets: [{ id: `st${n}`, weightKg, reps: 5, loggedAt: at } as SessionSet],
    })),
  };
}

describe('how old a plan is', () => {
  it('counts whole weeks since it was last edited', () => {
    expect(weeksSince(NOW - 3 * WEEK, NOW)).toBe(3);
    expect(weeksSince(NOW - 6 * DAY, NOW)).toBe(0);
  });

  it('never reports a negative age for a clock that moved backwards', () => {
    expect(weeksSince(NOW + 5 * WEEK, NOW)).toBe(0);
  });

  it('goes stale at four weeks, not before', () => {
    expect(isPlanStale(plan(NOW - (PLAN_STALE_WEEKS * WEEK - DAY)), NOW)).toBe(false);
    expect(isPlanStale(plan(NOW - PLAN_STALE_WEEKS * WEEK), NOW)).toBe(true);
  });
});

describe('whether the plan is still producing', () => {
  const edited = NOW - 8 * WEEK;

  it('calls a lift that is going up climbing', () => {
    const review = reviewPlan(
      plan(edited),
      [
        session(edited + WEEK, { [BENCH]: 60 }),
        session(edited + 2 * WEEK, { [BENCH]: 65 }),
        session(edited + 3 * WEEK, { [BENCH]: 70 }),
      ],
      NOW,
    );
    expect(review.trends[0]).toMatchObject({ verdict: 'climbing', from: 60, to: 70, sessions: 3 });
    expect(review.stalled).toHaveLength(0);
  });

  it('calls a lift stuck at the same weight flat', () => {
    const review = reviewPlan(
      plan(edited),
      [
        session(edited + WEEK, { [BENCH]: 60 }),
        session(edited + 2 * WEEK, { [BENCH]: 60 }),
        session(edited + 3 * WEEK, { [BENCH]: 60 }),
      ],
      NOW,
    );
    expect(review.trends[0].verdict).toBe('flat');
    expect(review.stalled.map((t) => t.exerciseId)).toEqual([BENCH]);
  });

  it('does not read plate noise as a direction', () => {
    // 61.25 to 60 is one small plate, not a decline. Calling that "slipping" would have someone
    // tearing up a working programme over rounding.
    const review = reviewPlan(
      plan(edited),
      [
        session(edited + WEEK, { [BENCH]: 61.25 }),
        session(edited + 2 * WEEK, { [BENCH]: 60 }),
        session(edited + 3 * WEEK, { [BENCH]: 60.5 }),
      ],
      NOW,
    );
    expect(review.trends[0].verdict).toBe('flat');
  });

  it('reports a real decline as slipping, and does not offer it as stalled', () => {
    const review = reviewPlan(
      plan(edited),
      [
        session(edited + WEEK, { [BENCH]: 80 }),
        session(edited + 2 * WEEK, { [BENCH]: 72.5 }),
        session(edited + 3 * WEEK, { [BENCH]: 70 }),
      ],
      NOW,
    );
    expect(review.trends[0].verdict).toBe('slipping');
    expect(review.stalled).toHaveLength(0);
  });

  it('refuses to judge a lift with too little recorded', () => {
    // Two sessions is a pair of points, not a trend - and reporting that as "no progress" would
    // be the page inventing evidence it does not have.
    const review = reviewPlan(
      plan(edited),
      [session(edited + WEEK, { [BENCH]: 60 }), session(edited + 2 * WEEK, { [BENCH]: 60 })],
      NOW,
    );
    expect(review.trends[0].verdict).toBe('untested');
    expect(review.stalled).toHaveLength(0);
  });

  it('ignores workouts recorded before the plan was last edited', () => {
    // The question is whether THIS version of the plan works. Weight moved under a version you
    // have already replaced says nothing about the one you are running.
    const review = reviewPlan(
      plan(edited),
      [
        session(edited - 5 * WEEK, { [BENCH]: 40 }),
        session(edited - 4 * WEEK, { [BENCH]: 50 }),
        session(edited + WEEK, { [BENCH]: 60 }),
        session(edited + 2 * WEEK, { [BENCH]: 60 }),
        session(edited + 3 * WEEK, { [BENCH]: 60 }),
      ],
      NOW,
    );
    expect(review.workoutsSince).toBe(3);
    expect(review.trends[0]).toMatchObject({ from: 60, to: 60, verdict: 'flat' });
  });

  it('ignores a workout still in progress', () => {
    const live: Session = { ...session(edited + 4 * WEEK, { [BENCH]: 100 }), endedAt: null };
    const review = reviewPlan(
      plan(edited),
      [
        session(edited + WEEK, { [BENCH]: 60 }),
        session(edited + 2 * WEEK, { [BENCH]: 60 }),
        session(edited + 3 * WEEK, { [BENCH]: 60 }),
        live,
      ],
      NOW,
    );
    expect(review.workoutsSince).toBe(3);
    expect(review.trends[0].to).toBe(60);
  });

  it('takes the heaviest set of a session, not the last one', () => {
    const heavyThenBackoff: Session = {
      ...session(edited + WEEK, { [BENCH]: 60 }),
      entries: [
        {
          id: 'e1',
          exerciseId: BENCH,
          kind: 'weight_reps',
          restSec: 90,
          sets: [
            { id: 'a', weightKg: 100, reps: 3, loggedAt: edited + WEEK },
            { id: 'b', weightKg: 60, reps: 10, loggedAt: edited + WEEK },
          ],
        },
      ],
    };
    const review = reviewPlan(plan(edited), [heavyThenBackoff], NOW);
    expect(review.trends[0].from).toBe(100);
  });

  it('ignores sets that were never recorded', () => {
    const planned: Session = {
      ...session(edited + WEEK, { [BENCH]: 60 }),
      entries: [
        {
          id: 'e1',
          exerciseId: BENCH,
          kind: 'weight_reps',
          restSec: 90,
          sets: [{ id: 'a', weightKg: 200, reps: 1, loggedAt: null }],
        },
      ],
    };
    const review = reviewPlan(plan(edited), [planned], NOW);
    expect(review.trends[0]).toMatchObject({ sessions: 0, from: null, verdict: 'untested' });
  });

  it('judges each exercise in the plan separately', () => {
    const review = reviewPlan(
      plan(edited, [BENCH, SQUAT]),
      [
        session(edited + WEEK, { [BENCH]: 60, [SQUAT]: 80 }),
        session(edited + 2 * WEEK, { [BENCH]: 60, [SQUAT]: 90 }),
        session(edited + 3 * WEEK, { [BENCH]: 60, [SQUAT]: 100 }),
      ],
      NOW,
    );
    expect(review.trends.map((t) => t.verdict)).toEqual(['flat', 'climbing']);
    expect(review.stalled.map((t) => t.exerciseId)).toEqual([BENCH]);
  });
});
