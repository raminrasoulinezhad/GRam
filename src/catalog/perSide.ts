import type { Exercise } from './types';

/**
 * Whether the weight written down for an exercise is what *one* hand is holding.
 *
 * THE PROBLEM
 * A dumbbell bench press with two 30kg dumbbells is 60kg moved, but 30 is the number anyone
 * writes down - nobody records a dumbbell press as 60. Counting the written number as the total
 * halves every dumbbell session in the "total lifted" milestone, and the more dumbbell work
 * someone does the further out the figure drifts. It also leaves the set row ambiguous: is 30
 * one dumbbell or the pair?
 *
 * WHAT COUNTS
 * One implement per hand, both loaded at once. That is dumbbells by default - a dumbbell
 * exercise means one in each hand unless it says otherwise - and kettlebells only when the name
 * says two of them.
 *
 * WHAT DOES NOT, AND WHY
 * - **One-arm work.** Only one side is loaded at a time, so the written weight *is* the whole
 *   load. Someone who trains both arms and logs it as one set is undercounted by half; the
 *   honest fix there is two sets, one per side, which is what the set list is for.
 * - **Anything held in both hands** - a goblet squat, a pullover, a two-handed swing. One
 *   implement, one load.
 * - **Two-stack cable machines**, notably crossovers, where each side genuinely carries the
 *   selected weight. They are left out because the dataset has no field that distinguishes them
 *   and the naming gives no reliable signal; the override list below is where they would go if
 *   that judgement is ever made exercise by exercise.
 */

/** One implement per hand, whatever the name suggests. */
const ALWAYS: ReadonlySet<string> = new Set<string>([]);

/**
 * One implement in total, despite the equipment saying dumbbell or the name saying "two".
 * Each of these was read individually; the reason is with it.
 */
const NEVER: ReadonlySet<string> = new Set([
  'Calf_Raise_On_A_Dumbbell', // the dumbbell is the step, not the load
  'Concentration_Curls', // one arm at a time, braced on the thigh
  'Standing_Concentration_Curl',
  'Dumbbell_Side_Bend', // one bell, one side at a time - the other hand is the counterweight
  'External_Rotation', // rotator-cuff work, one arm at a time
  'Seated_Triceps_Press', // one bell, both hands, behind the head
  'Single_Dumbbell_Raise',
  'Spell_Caster', // one bell passed across the body
  'Vertical_Swing', // one bell, both hands
  'Goblet_Squat', // one bell held at the chest
  'Kettlebell_Figure_8', // one bell, passed between the legs
]);

/** Names that say, in so many words, that one limb is working. */
const SINGLE_SIDED = /\b(one[-\s]?arm|single[-\s]?arm|one[-\s]?leg|one[-\s]?legged|one[-\s]?hand|goblet|pullover|concentration)\b/i;

/** Names that say there are two implements. The default for a kettlebell is one. */
const PAIRED = /\b(double|two[-\s]?arm|two[-\s]?dumbbell|two kettlebells|alternating|alternate|seesaw|see[-\s]?saw)\b/i;

/**
 * True when the recorded weight is one hand's share and both hands are loaded.
 *
 * Consulted for the total-lifted milestone, which doubles it, and for the note on the set row
 * telling you which number to write down.
 */
export function isPerSideLoad(exercise: Exercise): boolean {
  if (ALWAYS.has(exercise.id)) return true;
  if (NEVER.has(exercise.id)) return false;
  if (SINGLE_SIDED.test(exercise.name)) return false;
  if (exercise.equipment === 'dumbbell') return true;
  if (exercise.equipment === 'kettlebells') return PAIRED.test(exercise.name);
  return false;
}

/** How many of the recorded weight a set actually moves: two implements, or one load. */
export function loadMultiplier(exercise: Exercise): 1 | 2 {
  return isPerSideLoad(exercise) ? 2 : 1;
}

/** What the user is holding, for the note on the set row. */
export function implementWord(exercise: Exercise): string {
  return exercise.equipment === 'kettlebells' ? 'kettlebell' : 'dumbbell';
}
