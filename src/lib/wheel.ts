/**
 * Sizing and value lookup for the wheel pickers.
 *
 * The gesture itself is a dependency's problem now - see ui/WheelPicker.tsx for why. What is
 * left here is what the app still decides for itself: how tall a row is, how many are visible,
 * what values a wheel offers, and which row a stored value corresponds to.
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
