import type { SessionEntry } from '@/store/types';

/**
 * The order exercises appear in during a live workout.
 *
 * Three bands, top to bottom: finished, under way, not started. The run of work still to do
 * stays together at the bottom instead of being interrupted by exercises already ticked off,
 * and the thing you are most likely to touch next sits at the boundary between the two.
 *
 * Within a band the order is *when it got there*, not the plan's order. Finishing an exercise
 * moves it to the bottom of the finished band; recording the first set of an exercise moves it
 * to the bottom of the under-way band. So the list reads as a history: the further up something
 * is, the longer ago you were doing it, and what you just touched is always immediately above
 * the work remaining.
 *
 * Untouched exercises have no such timestamp, so they keep the plan's order - which is the
 * order you chose to do them in, and the only meaningful one available.
 */

/**
 * Finished, under way, or untouched. Lower sorts higher up the screen.
 *
 * A plain object rather than an enum: `expo/tsconfig.base` turns on `isolatedModules`, under
 * which a `const enum` cannot be compiled file-by-file and is an error.
 */
export const BAND = { done: 0, started: 1, untouched: 2 } as const;
export type Band = (typeof BAND)[keyof typeof BAND];

export function band(entry: SessionEntry): Band {
  const logged = entry.sets.filter((x) => x.loggedAt !== null).length;
  if (logged === 0) return BAND.untouched;
  return logged === entry.sets.length ? BAND.done : BAND.started;
}

/**
 * When this exercise entered its band, as a timestamp - the moment that decides where it sits
 * among its neighbours.
 *
 * A finished exercise is placed by its *last* recorded set, which is when it finished. One under
 * way is placed by its *first*, which is when it started; using the latest set there would make
 * a half-done exercise jump to the bottom of the band on every single tap, and the row you are
 * working in should hold still.
 *
 * Untouched entries return 0 so they all tie and the caller's stable sort keeps the plan order.
 */
export function enteredBandAt(entry: SessionEntry): number {
  const times: number[] = [];
  for (const set of entry.sets) if (set.loggedAt !== null) times.push(set.loggedAt);
  if (times.length === 0) return 0;
  return band(entry) === BAND.done ? Math.max(...times) : Math.min(...times);
}

/**
 * Compares two entries for display. Feed it to a stable sort - untouched entries all compare
 * equal, and rely on that stability to keep the order the plan gave them.
 */
export function compareEntries(a: SessionEntry, b: SessionEntry): number {
  const byBand = band(a) - band(b);
  if (byBand !== 0) return byBand;
  return enteredBandAt(a) - enteredBandAt(b);
}

/** The entries of a live session, in display order. Does not mutate the input. */
export function orderEntries(entries: readonly SessionEntry[]): SessionEntry[] {
  return [...entries].sort(compareEntries);
}
