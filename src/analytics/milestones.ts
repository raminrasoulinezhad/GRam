import { toDisplayWeight } from '@/lib/format';
import type { Profile, Session } from '@/store/types';
import { countLoggedSets, sessionTonnage } from './volume';

/**
 * Long-run achievements, so progress is visible over months rather than only per session.
 *
 * Three things are counted since the very first record: total weight moved, number of days
 * trained, and an estimate of calories burned. Each has a ladder of thresholds; where you sit
 * on that ladder is your level.
 */
export type MilestoneCategory = 'weight' | 'workouts' | 'calories';

export const CATEGORY_LABEL: Record<MilestoneCategory, string> = {
  weight: 'Total lifted',
  workouts: 'Days trained',
  calories: 'Calories burned',
};

/**
 * Thresholds per category. Each ladder starts at a value a committed beginner reaches in a
 * few months, then stretches out so it keeps meaning something years later.
 */
function ladder(explicit: number[], step: number, until: number): number[] {
  const out = [...explicit];
  const last = out[out.length - 1];
  // Continue on round multiples of the step rather than last + step, so 500K followed by a
  // 1M step gives 1M, 2M, 3M - not 1.5M, 2.5M.
  let next = (Math.floor(last / step) + 1) * step;
  while (next <= until) {
    out.push(next);
    next += step;
  }
  return out;
}

export const TIERS: Record<MilestoneCategory, number[]> = {
  // 100k, 200k, 500k, then every million.
  weight: ladder([100_000, 200_000, 500_000], 1_000_000, 50_000_000),
  // 10, 20, 50, then every hundred days.
  workouts: ladder([10, 20, 50], 100, 5_000),
  // 1k, 2k, 5k, 10k, 20k, 50k, then every hundred thousand.
  calories: ladder([1_000, 2_000, 5_000, 10_000, 20_000, 50_000], 100_000, 5_000_000),
};

/** Metabolic equivalent for resistance training - the Compendium puts it around 3.5-6.0. */
const MET_RESISTANCE = 5.0;

/** Used when the profile has no body weight yet; calories scale linearly with it. */
const ASSUMED_BODY_KG = 75;

/** A session left open overnight would otherwise contribute a fortnight of calories. */
const MAX_SESSION_HOURS = 3;

/** Sessions that were finished. Anything still running is not a result yet. */
function finished(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.endedAt !== null);
}

export function totalWeightKg(sessions: Session[]): number {
  return finished(sessions).reduce((sum, s) => sum + sessionTonnage(s), 0);
}

/**
 * Distinct calendar days on which something was recorded - not session count. Two workouts in
 * one day is one day of training, which is what the number is meant to convey.
 */
export function totalWorkoutDays(sessions: Session[]): number {
  const days = new Set<string>();
  for (const session of finished(sessions)) {
    if (countLoggedSets(session) === 0) continue;
    const d = new Date(session.startedAt);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

/**
 * Estimated calories, MET x body weight x hours.
 *
 * An estimate, and labelled as one in the UI. Without a heart-rate strap nothing better is
 * available, and the standard MET model at least scales sensibly with how long you trained and
 * how much you weigh.
 */
export function totalCalories(sessions: Session[], profile: Profile): number {
  const bodyKg = profile.weightKg ?? ASSUMED_BODY_KG;
  let kcal = 0;
  for (const session of finished(sessions)) {
    if (countLoggedSets(session) === 0) continue;
    const hours = Math.min(
      MAX_SESSION_HOURS,
      Math.max(0, ((session.endedAt ?? session.startedAt) - session.startedAt) / 3_600_000),
    );
    kcal += MET_RESISTANCE * bodyKg * hours;
  }
  return Math.round(kcal);
}

export type MilestoneProgress = {
  category: MilestoneCategory;
  value: number;
  /** 0 before the first threshold; otherwise the 1-based index of the highest one reached. */
  level: number;
  /** Threshold for the current level, or null before the first. */
  current: number | null;
  /** Threshold for the next level, or null once the ladder is exhausted. */
  next: number | null;
  /** 0-1 towards `next`, measured from `current`. */
  fraction: number;
  /** Every threshold, so the history view can show what is done and what is coming. */
  tiers: number[];
};

export function progressFor(category: MilestoneCategory, value: number): MilestoneProgress {
  const tiers = TIERS[category];
  let level = 0;
  for (const tier of tiers) {
    if (value >= tier) level += 1;
    else break;
  }

  const current = level > 0 ? tiers[level - 1] : null;
  const next = level < tiers.length ? tiers[level] : null;

  let fraction = 1;
  if (next !== null) {
    const from = current ?? 0;
    fraction = Math.max(0, Math.min(1, (value - from) / (next - from)));
  }

  return { category, value, level, current, next, fraction, tiers };
}

export function allProgress(sessions: Session[], profile: Profile): MilestoneProgress[] {
  return [
    progressFor('weight', totalWeightKg(sessions)),
    progressFor('workouts', totalWorkoutDays(sessions)),
    progressFor('calories', totalCalories(sessions, profile)),
  ];
}

/** Stable id for a reached threshold, so a celebration is only ever shown once. */
export function milestoneId(category: MilestoneCategory, tier: number): string {
  return `${category}:${tier}`;
}

/** Every threshold reached across all three ladders, oldest first. */
export function reachedMilestones(
  sessions: Session[],
  profile: Profile,
): { category: MilestoneCategory; tier: number; id: string }[] {
  const out: { category: MilestoneCategory; tier: number; id: string }[] = [];
  for (const p of allProgress(sessions, profile)) {
    for (let i = 0; i < p.level; i++) {
      out.push({ category: p.category, tier: p.tiers[i], id: milestoneId(p.category, p.tiers[i]) });
    }
  }
  return out;
}

/**
 * Compact display, e.g. 1.2M / 250K / 850.
 *
 * WHY THE LADDER STAYS IN KILOGRAMS AND ONLY THE LABEL CONVERTS
 * Every threshold in TIERS is a weight in kilograms and has to stay that way. A separate pound
 * ladder would make the level depend on a display setting: switching to lb would promote
 * someone for changing a preference, and switching back would demote them. A milestone has to
 * mean the same amount of work however it is written down.
 *
 * What was wrong before is the other half of that. The label said kg regardless of the setting,
 * so someone using pounds read "480 kg" in the milestone strip and "1,058 lb moved" on the
 * workout card directly beneath it. Same number, two units, one screen.
 */
export function formatMilestoneValue(
  category: MilestoneCategory,
  value: number,
  unit: 'kg' | 'lb' = 'kg',
): string {
  if (category === 'workouts') return `${Math.round(value)}`;

  const n = Math.round(category === 'weight' ? toDisplayWeight(value, unit) : value);
  const suffix = category === 'weight' ? ` ${unit}` : ' kcal';
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M${suffix}`;
  if (n >= 1_000) return `${trim(n / 1_000)}K${suffix}`;
  return `${n}${suffix}`;
}

function trim(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(/\.0$/, '');
}
