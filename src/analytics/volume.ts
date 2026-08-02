import { MUSCLES, getExercise, loadMultiplier, type Muscle } from '@/catalog';
import type { Session } from '@/store/types';

/**
 * Training load is measured in *effective sets*, not tonnage.
 *
 * Tonnage cannot compare 100kg x 5 against a 60s plank, and it over-weights the exercises
 * that happen to move the most absolute load. Counting sets - full credit to the muscles an
 * exercise targets, half credit to the ones assisting - is how the hypertrophy literature
 * counts weekly volume, and it is the unit the familiar "10-20 sets per muscle per week"
 * guidance is expressed in.
 */
export const PRIMARY_WEIGHT = 1;
export const SECONDARY_WEIGHT = 0.5;

/** Weekly effective sets that colour the heatmap at full intensity. */
export const WEEKLY_TARGET_SETS = 20;

/** Fatigue decay constant. At 48h a set retains e^-1 ~ 37% of its fatigue. */
const FATIGUE_TAU_HOURS = 48;

/** Effective sets of accumulated fatigue that drive a muscle to ~37% recovered. */
const FATIGUE_SATURATION_SETS = 6;

const HOUR_MS = 3600_000;
export const DAY_MS = 86_400_000;

export type MuscleTotals = Record<Muscle, number>;

export function emptyTotals(): MuscleTotals {
  const out = {} as MuscleTotals;
  for (const m of MUSCLES) out[m] = 0;
  return out;
}

export type LoggedSetRef = { exerciseId: string; loggedAt: number };

/** Every recorded set across all sessions, flattened. Planned-but-unlogged sets never count. */
export function loggedSets(sessions: Session[]): LoggedSetRef[] {
  const out: LoggedSetRef[] = [];
  for (const session of sessions) {
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (set.loggedAt !== null) {
          out.push({ exerciseId: entry.exerciseId, loggedAt: set.loggedAt });
        }
      }
    }
  }
  return out;
}

/**
 * Adds one set's contribution to the running totals, scaled by `weight`
 * (1 for a plain count, less for a time-decayed one).
 */
function addContribution(totals: MuscleTotals, exerciseId: string, weight: number): void {
  const exercise = getExercise(exerciseId);
  if (!exercise) return;
  for (const m of exercise.primaryMuscles) totals[m] += PRIMARY_WEIGHT * weight;
  for (const m of exercise.secondaryMuscles) totals[m] += SECONDARY_WEIGHT * weight;
}

/**
 * Effective sets per muscle over a trailing window - "what did I actually hit this week".
 * The window is half-open: a set exactly `windowDays` old is excluded.
 */
export function volumeInWindow(
  sessions: Session[],
  now: number,
  windowDays = 7,
): MuscleTotals {
  const totals = emptyTotals();
  const since = now - windowDays * DAY_MS;
  for (const set of loggedSets(sessions)) {
    if (set.loggedAt <= since || set.loggedAt > now) continue;
    addContribution(totals, set.exerciseId, 1);
  }
  return totals;
}

/**
 * Per-muscle recovery, 0-100%.
 *
 * Fatigue from each logged set decays exponentially, then recovery is the exponential
 * complement of accumulated fatigue. The resulting curve is roughly: a hard 12-set session
 * leaves the muscle ~14% recovered immediately, ~47% at 48h, ~64% at 72h and ~90% at 6 days,
 * which lines up with the 48-72h "trainable again" and ~6-day "fully recovered" heuristics.
 */
export function recovery(sessions: Session[], now: number): MuscleTotals {
  const fatigue = emptyTotals();
  for (const set of loggedSets(sessions)) {
    if (set.loggedAt > now) continue;
    const hoursAgo = (now - set.loggedAt) / HOUR_MS;
    const residual = Math.exp(-hoursAgo / FATIGUE_TAU_HOURS);
    if (residual < 0.001) continue;
    addContribution(fatigue, set.exerciseId, residual);
  }

  const out = emptyTotals();
  for (const m of MUSCLES) {
    out[m] = 100 * Math.exp(-fatigue[m] / FATIGUE_SATURATION_SETS);
  }
  return out;
}

/** Effective sets per muscle for a single session - used for the per-workout summary. */
export function sessionVolume(session: Session): MuscleTotals {
  const totals = emptyTotals();
  for (const entry of session.entries) {
    for (const set of entry.sets) {
      if (set.loggedAt !== null) addContribution(totals, entry.exerciseId, 1);
    }
  }
  return totals;
}

/**
 * Effective sets per muscle for every set in a session, recorded or not.
 *
 * The denominator of "shoulders 2/6" during a live workout: what the whole session comes to if
 * you finish it. Counting unrecorded sets is exactly what makes it a target rather than a
 * result, so this is deliberately the one place that looks at sets nothing has happened to yet.
 */
export function sessionPlannedVolume(session: Session): MuscleTotals {
  const totals = emptyTotals();
  for (const entry of session.entries) {
    for (const _set of entry.sets) addContribution(totals, entry.exerciseId, 1);
  }
  return totals;
}

/** Muscles with any load, heaviest first. */
export function rankMuscles(totals: MuscleTotals): { muscle: Muscle; value: number }[] {
  return MUSCLES.map((muscle) => ({ muscle, value: totals[muscle] }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function countLoggedSets(session: Session): number {
  let n = 0;
  for (const entry of session.entries) {
    for (const set of entry.sets) if (set.loggedAt !== null) n++;
  }
  return n;
}

/**
 * Total kg moved in a session. Sets without both weight and reps contribute nothing.
 *
 * A dumbbell exercise counts double, because the number written down is what one hand holds -
 * a dumbbell press with two 30s is 60kg moved, and nobody records it as 60. See
 * `src/catalog/perSide.ts` for exactly which exercises that applies to and why.
 */
export function sessionTonnage(session: Session): number {
  let kg = 0;
  for (const entry of session.entries) {
    const exercise = getExercise(entry.exerciseId);
    const perRep = exercise ? loadMultiplier(exercise) : 1;
    for (const set of entry.sets) {
      if (set.loggedAt !== null && set.weightKg && set.reps) {
        kg += set.weightKg * set.reps * perRep;
      }
    }
  }
  return kg;
}
