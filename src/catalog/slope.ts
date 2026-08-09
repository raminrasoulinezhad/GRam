import { getExercise } from './index';

/**
 * How steep the bench is, for the exercises whose name only says "incline" or "decline".
 *
 * WHY THIS EXISTS
 * Fifty-one exercises in the catalog are named for a bench angle and none of them says what the
 * angle is. "Incline Dumbbell Press" and "Incline Dumbbell Curl" are both inclines and they are
 * not the same bench: press at 30 degrees, curl at 45 to 60. Someone setting up in a gym has to
 * either already know or guess, and guessing the press at 45 turns a chest exercise into a
 * shoulder press - which is the specific mistake this is meant to stop.
 *
 * The dataset carries no angle field, so these are not data. They are the conventional setup
 * for each movement, stated as a range where the range is real, and they are advice rather than
 * a rule - hence "about".
 *
 * NOT EVERY "INCLINE" IS A BENCH
 * Three senses of the word live in this catalog and only one is an angle you set:
 *   - the bench angle, which is what this file is about;
 *   - hands on a raised surface, as in Incline Push-Up, where "incline" describes your body and
 *     there is no bench to tilt;
 *   - a cable or treadmill line, as in Cable Incline Pushdown and Incline Walk.
 * The second and third are listed in NO_ANGLE and deliberately say nothing, because a confident
 * "about 30 degrees" on a press-up would be worse than silence.
 */

export type Slope = {
  /** Short enough for a chip beside the name, e.g. "30°" or "15-30°". */
  degrees: string;
  /** One line on why that angle and not another. Shown on the exercise page. */
  why: string;
};

/**
 * Where the word does not mean a bench you can tilt. Listed by id rather than detected, because
 * the distinction is about the movement and no pattern in the name carries it reliably.
 */
const NO_ANGLE = new Set([
  // Hands elevated or feet elevated: "incline" describes the body, not a bench setting.
  'Incline_Push-Up',
  'Incline_Push-Up_Close-Grip',
  'Incline_Push-Up_Depth_Jump',
  'Incline_Push-Up_Medium',
  'Incline_Push-Up_Reverse_Grip',
  'Incline_Push-Up_Wide',
  'Decline_Push-Up',
  // The line of a cable, set by where the pulley is rather than by an angle you dial in.
  'Cable_Incline_Pushdown',
  // A treadmill gradient, which is a percentage and not a bench at all.
  'FitRam_Incline_Walk_Treadmill',
]);

/**
 * The bench angle by movement, keyed `slope:primary muscle`.
 *
 * Keyed on the primary muscle because that is what decides the angle: the same 45-degree bench
 * is wrong for a press and right for a curl, and the muscle is the thing that differs.
 */
const BY_MUSCLE: Record<string, Slope> = {
  'incline:chest': {
    degrees: '30°',
    why: 'Low enough to keep the load on the upper chest. Past about 45° the front delts take over and it becomes a shoulder press.',
  },
  'incline:biceps': {
    degrees: '45-60°',
    why: 'Steep on purpose: lying back lets the arm hang behind the body, which stretches the long head of the biceps. That stretch is the whole reason to use a bench.',
  },
  'incline:shoulders': {
    degrees: '30-45°',
    why: 'Chest against the bench so the raise cannot be swung. Shallower puts more on the rear delt, steeper more on the front.',
  },
  'incline:triceps': {
    degrees: '45°',
    why: 'Sitting back puts the upper arm slightly behind you, which lengthens the long head of the triceps before the set starts.',
  },
  'incline:middle back': {
    degrees: '30-45°',
    why: 'Chest supported, so the row is the back working rather than the lower back holding you up.',
  },
  'decline:chest': {
    degrees: '15-30°',
    why: 'A shallow decline is enough to shift the work to the lower chest. Steeper mostly adds blood to your head.',
  },
  'decline:triceps': {
    degrees: '15-30°',
    why: 'Head below the hips keeps tension on the triceps at the top, where a flat bench lets them rest.',
  },
  'decline:abdominals': {
    degrees: '15-30°',
    why: 'The angle is the resistance: steeper is harder. Start shallow and tilt it up as it gets easy.',
  },
};

/** The bench angle for an exercise, or null when it has none to state. */
export function slopeFor(exerciseId: string): Slope | null {
  if (NO_ANGLE.has(exerciseId)) return null;

  const exercise = getExercise(exerciseId);
  if (exercise === undefined) return null;

  const match = /\b(incline|decline)\b/i.exec(exercise.name);
  if (match === null) return null;

  const slope = match[1].toLowerCase();
  for (const muscle of exercise.primaryMuscles) {
    const found = BY_MUSCLE[`${slope}:${muscle}`];
    if (found !== undefined) return found;
  }
  return null;
}
