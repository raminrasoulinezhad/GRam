import type { Profile } from '@/store/types';

/**
 * Which body the app draws, for someone who did not say which one they are.
 *
 * WHY THIS EXISTS
 * Sex is optional in the profile, and "Unspecified" is a real answer rather than a missing one.
 * It used to be treated as missing: choosing it silently set the body figure to male, because
 * the figure only ships two models and male was the fallback. So the one option a user picks in
 * order NOT to be assumed about produced exactly the assumption they were avoiding, and did it
 * quietly.
 *
 * The fix is not a third body model, which would be a drawing project. It is to stop treating
 * "did not say" as "male": where a figure illustrates an EXERCISE rather than the user, an
 * unspecified profile gets an even split across the catalog, deterministically assigned.
 *
 * WHY DETERMINISTIC AND NOT RANDOM
 * A figure that flips every time the page is opened reads as a bug. Hashing the exercise id
 * means the bench press is always drawn the same way, half the catalog comes out female, and
 * nothing has to be stored to remember it. Assignment is stable across reinstalls, across
 * devices, and across a restored backup, because it is a pure function of the id.
 *
 * WHAT THIS IS NOT USED FOR
 * The Body tab draws YOUR body, not an exercise, so it reads `settings.bodyGender` instead: an
 * explicit rendering choice you make and can change, and which says nothing about what you are.
 * Splitting that fifty-fifty would mean the app guessing about a person rather than balancing a
 * picture set, which is the opposite of the point.
 */
export type FigureGender = 'male' | 'female';

/**
 * FNV-1a, 32-bit. Small, dependency-free, and stable for ever, which is the only property that
 * matters here: change the hash and every exercise silently swaps figure.
 */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The figure to draw for one exercise.
 *
 * `sex` stated means the figure matches it, on every exercise, because someone who told the app
 * what they are should see it consistently. Unspecified splits the catalog evenly by id.
 */
export function figureFor(sex: Profile['sex'], seed: string | undefined): FigureGender {
  if (sex === 'male' || sex === 'female') return sex;
  // A route can arrive with no id at all - a bad deep link, or a back-navigation into a screen
  // whose params are gone. The empty string still hashes, so a missing id costs a figure rather
  // than the whole page. src/__tests__/hostileScreens.test.tsx caught exactly this.
  return hash(typeof seed === 'string' ? seed : '') % 2 === 0 ? 'female' : 'male';
}

/** The share of `seeds` that come out female. Exported so a test can hold the split honest. */
export function femaleShare(seeds: readonly string[]): number {
  if (seeds.length === 0) return 0;
  const female = seeds.filter((s) => figureFor('unspecified', s) === 'female').length;
  return female / seeds.length;
}
