import type { Plan, Session } from '@/store/types';

/**
 * Whether a plan has gone stale, and - more usefully - whether it is still producing anything.
 *
 * The nag on its own is worth very little. "You have not changed this in two months" is true of
 * plenty of good programmes, and telling someone to change something that is working is bad
 * advice dressed up as a feature. So the age is only what makes the app look; what it actually
 * reports is per exercise, from the logged sets: which lifts have moved since the plan was last
 * edited and which have not.
 *
 * A lift that is still climbing is left alone and said so. A lift that has not moved across
 * several sessions is the one worth swapping - and that is a claim the data supports, rather
 * than a calendar reminder.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** How long a plan may sit untouched before the app suggests a look. */
export const PLAN_STALE_WEEKS = 4;

/** Whole weeks since a plan was last edited. */
export function weeksSince(at: number, now: number): number {
  return Math.max(0, Math.floor((now - at) / WEEK_MS));
}

export function isPlanStale(plan: Plan, now: number): boolean {
  return weeksSince(plan.updatedAt, now) >= PLAN_STALE_WEEKS;
}

export type ExerciseTrend = {
  exerciseId: string;
  /** Recorded sessions containing this exercise since the plan was last edited. */
  sessions: number;
  /** Heaviest recorded set in the earliest of those sessions, in kg. */
  from: number | null;
  /** Heaviest recorded set in the most recent of those sessions, in kg. */
  to: number | null;
  /**
   * What the numbers say. `climbing` and `slipping` speak for themselves; `flat` is the one
   * worth acting on. `untested` means too little has been recorded to have an opinion, which is
   * different from - and must never be reported as - no progress.
   */
  verdict: 'climbing' | 'flat' | 'slipping' | 'untested';
};

/** Fewer sessions than this and there is nothing to draw a line through. */
const MIN_SESSIONS = 3;

/**
 * Heaviest weight recorded for an exercise in one session, or null if it logged none.
 *
 * Top set rather than volume: volume moves when you add a set, which is a change to the plan
 * rather than evidence the plan is working. What is being asked here is "is this lift getting
 * heavier", and the heaviest set is the honest answer to it.
 */
function topSet(session: Session, exerciseId: string): number | null {
  let best: number | null = null;
  for (const entry of session.entries) {
    if (entry.exerciseId !== exerciseId) continue;
    for (const set of entry.sets) {
      if (set.loggedAt === null || set.weightKg === undefined) continue;
      if (best === null || set.weightKg > best) best = set.weightKg;
    }
  }
  return best;
}

/**
 * How each exercise in a plan has fared since the plan was last edited.
 *
 * Deliberately scoped to `plan.updatedAt` rather than all of history: the question is whether
 * *this* version of the plan is working. Weight moved under a version you have already replaced
 * says nothing about the one you are running now.
 */
export function reviewPlan(plan: Plan, sessions: readonly Session[], now: number) {
  const since = plan.updatedAt;
  const relevant = sessions
    .filter((s) => s.endedAt !== null && s.startedAt >= since && s.startedAt <= now)
    .sort((a, b) => a.startedAt - b.startedAt);

  const trends: ExerciseTrend[] = plan.items.map((item) => {
    const tops: number[] = [];
    for (const session of relevant) {
      const top = topSet(session, item.exerciseId);
      if (top !== null) tops.push(top);
    }

    if (tops.length < MIN_SESSIONS) {
      return {
        exerciseId: item.exerciseId,
        sessions: tops.length,
        from: tops.length > 0 ? tops[0] : null,
        to: tops.length > 0 ? tops[tops.length - 1] : null,
        verdict: 'untested',
      };
    }

    const from = tops[0];
    const to = tops[tops.length - 1];
    /*
     * A kilo of slack either way. Plates come in 1.25kg pairs and a bar loaded to 62.5 one week
     * and 61.25 the next has not changed direction - calling that "slipping" would be reading
     * noise as a trend.
     */
    const verdict = to > from + 1 ? 'climbing' : to < from - 1 ? 'slipping' : 'flat';
    return { exerciseId: item.exerciseId, sessions: tops.length, from, to, verdict };
  });

  return {
    weeks: weeksSince(plan.updatedAt, now),
    stale: isPlanStale(plan, now),
    workoutsSince: relevant.length,
    trends,
    /** The exercises worth swapping: enough evidence, and none of it moving. */
    stalled: trends.filter((t) => t.verdict === 'flat'),
  };
}
