import { getExercise, RECOMMENDED, type Muscle } from '@/catalog';
import type { Plan } from '@/store/types';

/**
 * Does this week's set of plans train the whole body?
 *
 * A lifter writes three or four plans and runs them as their week. Nothing stops those plans
 * from being three chest days, and nothing in the app would have said so. This is the check
 * that does.
 *
 * WHAT BALANCED MEANS HERE
 * Eight groups have to be trained at least twice a week, on different days, as the *primary*
 * muscle of an exercise. Three deliberate narrowings:
 *
 *   - Only these eight. Forearms, calves, abs, neck and the rest are trained plenty as
 *     assistance and flagging them would bury the advice that matters in noise.
 *   - Only primary muscles. Bench press assists the triceps, but a week whose only triceps work
 *     is bench press is not a week that trains triceps, and counting it would say otherwise.
 *   - Twice, on different days. Two chest exercises in one plan is one session's worth of
 *     stimulus; the frequency is the point, not the exercise count.
 *
 * ONE PLAN IS ONE DAY
 * Plans carry no day-of-week, so "different days" is read as "different plans". That is how
 * people write them - Push, Pull, Legs is three days - and it means the check needs no new
 * state and no assumption about which weekday anything falls on. A plan run twice a week is
 * counted once, which errs towards advising more work rather than less.
 */
export type TrainingGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes';

/** Display order: push, pull, then legs, which is how most people think about a week. */
export const TRAINING_GROUPS: TrainingGroup[] = [
  'chest',
  'shoulders',
  'triceps',
  'back',
  'biceps',
  'quadriceps',
  'hamstrings',
  'glutes',
];

/**
 * Which catalog muscles count as each group. Only "back" is a merge: the dataset splits it into
 * lats and middle back, and no one writes a plan thinking about those separately. Lower back is
 * left out - it is trained by every hinge and squat, and asking for two dedicated days of it
 * would be bad advice.
 */
export const GROUP_MUSCLES: Record<TrainingGroup, Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quadriceps: ['quadriceps'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
};

export const GROUP_LABEL: Record<TrainingGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
};

/** Days per week each group needs to be trained as a primary muscle. */
export const DAYS_PER_WEEK_TARGET = 2;

export type GroupCoverage = {
  group: TrainingGroup;
  /** Ids of the plans that train it as a primary muscle - one entry per day. */
  planIds: string[];
  /** Names of those plans, for the advice text. */
  planNames: string[];
  /** How many more days it needs. 0 when the target is met. */
  shortBy: number;
  covered: boolean;
  /** True when the user has dismissed advice about this group. */
  ignored: boolean;
};

/**
 * The week cannot be balanced yet, whatever exercises are in it.
 *
 * Two different days is part of the definition, so a week with fewer than two plans fails every
 * group by construction - no exercise choice can fix it. Reported separately because it is a
 * different kind of problem with a different answer: write another day.
 */
export type StructuralIssue = { have: number; need: number };

export type WeekReview = {
  coverage: GroupCoverage[];
  /** Non-null while there are too few plans for any muscle to reach two days. */
  tooFewDays: StructuralIssue | null;
  /** Groups short of the target that the user has not dismissed. */
  issues: GroupCoverage[];
  /** Groups short of the target that the user has dismissed. */
  dismissed: GroupCoverage[];
  covered: GroupCoverage[];
  /** True when every group not dismissed is covered. */
  balanced: boolean;
};

function trainsAsPrimary(plan: Plan, group: TrainingGroup): boolean {
  const muscles = GROUP_MUSCLES[group];
  for (const item of plan.items) {
    const exercise = getExercise(item.exerciseId);
    if (!exercise) continue;
    for (const m of exercise.primaryMuscles) {
      if (muscles.includes(m)) return true;
    }
  }
  return false;
}

export function reviewWeek(plans: Plan[], ignored: readonly string[] = []): WeekReview {
  const dismissedSet = new Set(ignored);

  const coverage = TRAINING_GROUPS.map<GroupCoverage>((group) => {
    const hits = plans.filter((plan) => trainsAsPrimary(plan, group));
    return {
      group,
      planIds: hits.map((p) => p.id),
      planNames: hits.map((p) => p.name),
      shortBy: Math.max(0, DAYS_PER_WEEK_TARGET - hits.length),
      covered: hits.length >= DAYS_PER_WEEK_TARGET,
      ignored: dismissedSet.has(group),
    };
  });

  const short = coverage.filter((c) => !c.covered);
  const issues = short.filter((c) => !c.ignored);
  const tooFewDays =
    plans.length < DAYS_PER_WEEK_TARGET
      ? { have: plans.length, need: DAYS_PER_WEEK_TARGET }
      : null;

  return {
    coverage,
    tooFewDays,
    issues,
    dismissed: short.filter((c) => c.ignored),
    covered: coverage.filter((c) => c.covered),
    // A structural gap cannot be dismissed, so it keeps the week unbalanced on its own.
    balanced: tooFewDays === null && issues.length === 0,
  };
}

/**
 * The exercise to offer when fixing a gap: the top recommendation for the group's first muscle.
 *
 * Reusing the recommendation list rather than keeping a second one means the fix button and the
 * search agree about what the best chest exercise is, and both get revisited on the same
 * schedule - see src/catalog/recommended.ts.
 */
export function suggestionFor(group: TrainingGroup): string {
  return RECOMMENDED[GROUP_MUSCLES[group][0]][0];
}

/** Plans that do not yet train this group - the ones where adding the fix actually helps. */
export function plansMissing(plans: Plan[], group: TrainingGroup): Plan[] {
  return plans.filter((plan) => !trainsAsPrimary(plan, group));
}
