/**
 * The arithmetic behind a scroll wheel, kept apart from the scrolling.
 *
 * A wheel is a list that snaps, plus a rule for turning a scroll offset back into "which item is
 * under the line". That rule is easy to get subtly wrong - off by half an item, or unbounded at
 * the ends so an overscroll picks something that does not exist - and it is impossible to test
 * by flinging a real one. So it lives here.
 */

/** Height of one row. Everything below is in multiples of it. */
export const ITEM_HEIGHT = 40;

/** How many rows are visible. Odd, so there is a middle one to sit under the marker. */
export const VISIBLE_ITEMS = 5;

export const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

/**
 * Blank space above and below the list, so the first and last values can reach the middle.
 * Without it a wheel can select everything except its own ends.
 */
export const WHEEL_PADDING = ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT;

/** Which index sits under the marker at this scroll offset. Clamped, so overscroll is harmless. */
export function indexAt(offsetY: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
}

/** Where to scroll to put `index` under the marker. */
export function offsetFor(index: number): number {
  return Math.max(0, index) * ITEM_HEIGHT;
}

/**
 * Builds an inclusive range of values.
 *
 * Rounded to the step's own precision on the way out: 30 + 0.5 * 41 in floating point is
 * 50.500000000000004, and a wheel that offers that as a body weight is not a wheel anyone
 * trusts.
 */
export function range(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const dp = decimals(step);
  for (let i = 0; min + i * step <= max + 1e-9; i++) {
    out.push(Number((min + i * step).toFixed(dp)));
  }
  return out;
}

function decimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * The entry in `values` closest to `value`, as an index.
 *
 * Nearest rather than exact because the stored number does not have to be on the wheel: body
 * weight is kept in kilograms and shown in pounds, so 80 kg becomes 176.37 lb, which is not one
 * of the whole-pound rows. Snapping to the nearest is right; refusing to show anything is not.
 */
export function nearestIndex(values: readonly number[], value: number | null): number {
  if (values.length === 0 || value === null) return 0;
  let best = 0;
  let bestGap = Math.abs(values[0] - value);
  for (let i = 1; i < values.length; i++) {
    const gap = Math.abs(values[i] - value);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  }
  return best;
}

/** Offset in pixels for the whole list, clamped to the ends. */
export function clampOffset(y: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min((count - 1) * ITEM_HEIGHT, Math.max(0, y));
}

/**
 * How far a flick carries, in pixels.
 *
 * A plain snap-to-nearest on release makes a wheel feel stuck: flicking hard should travel,
 * the way a physical one does. This is a crude constant-deceleration model rather than a
 * simulation - what matters is that a fast flick moves many rows and a slow drag moves none.
 */
export const FLING_MS = 220;

/**
 * Where a gesture ends up, as an index.
 *
 * `velocity` is in pixels per millisecond, positive when the finger is moving *down* - which
 * scrolls the list *up*, towards earlier values, hence the subtraction.
 */
export function flingIndex(offset: number, velocity: number, count: number): number {
  return indexAt(clampOffset(offset - velocity * FLING_MS, count), count);
}

/**
 * Which rows are worth drawing at this offset.
 *
 * The weight wheel has 441 values and the height wheel 111. Mounting all of them costs a tree
 * far larger than five visible rows justify, and it is re-laid-out on every frame of a drag.
 * Only the window around the offset is rendered, plus a couple of rows of slack so a fast flick
 * does not show gaps at the edges.
 */
export function visibleRange(offset: number, count: number, buffer = 2) {
  const middle = Math.round(offset / ITEM_HEIGHT);
  const half = (VISIBLE_ITEMS - 1) / 2 + buffer;
  return {
    from: Math.max(0, middle - half),
    to: Math.min(count - 1, middle + half),
  };
}
