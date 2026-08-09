import {
  clampOffset,
  flingIndex,
  indexAt,
  ITEM_HEIGHT,
  nearestIndex,
  offsetFor,
  range,
  visibleRange,
  VISIBLE_ITEMS,
  WHEEL_PADDING,
} from '@/lib/wheel';

describe('turning a scroll offset into a selection', () => {
  it('reads the row under the marker', () => {
    expect(indexAt(0, 10)).toBe(0);
    expect(indexAt(ITEM_HEIGHT * 3, 10)).toBe(3);
  });

  it('rounds to the nearest row rather than truncating', () => {
    // Truncation would make the wheel feel like it lags a row behind the one under the line.
    expect(indexAt(ITEM_HEIGHT * 2.6, 10)).toBe(3);
    expect(indexAt(ITEM_HEIGHT * 2.4, 10)).toBe(2);
  });

  it('cannot be pushed past either end by an overscroll', () => {
    // A rubber-band fling reports offsets outside the list, and an unclamped read would select
    // an index that does not exist.
    expect(indexAt(-500, 10)).toBe(0);
    expect(indexAt(ITEM_HEIGHT * 999, 10)).toBe(9);
  });

  it('survives an empty list', () => {
    expect(indexAt(120, 0)).toBe(0);
  });

  it('round-trips with the offset it came from', () => {
    for (const i of [0, 1, 7, 40]) expect(indexAt(offsetFor(i), 100)).toBe(i);
  });
});

describe('the padding that lets the ends be chosen', () => {
  it('is half the wheel, so the first and last rows can reach the middle', () => {
    // Without it a wheel can select everything except its own two ends.
    expect(WHEEL_PADDING).toBe(((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT);
  });

  it('shows an odd number of rows, so one of them is the middle', () => {
    expect(VISIBLE_ITEMS % 2).toBe(1);
  });
});

describe('building the values', () => {
  it('is inclusive of both ends', () => {
    expect(range(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not leak floating point into a body weight', () => {
    // 30 + 0.5 * 41 is 50.500000000000004 in binary floating point, and a wheel offering that
    // as a weight is not one anyone trusts.
    const kg = range(30, 250, 0.5);
    expect(kg).toContain(50.5);
    expect(kg.every((v) => Number.isFinite(v) && String(v).length <= 5)).toBe(true);
  });

  it('covers the ranges the profile actually offers', () => {
    expect(range(120, 230, 1)).toHaveLength(111);
    expect(range(30, 250, 0.5)).toHaveLength(441);
    expect(range(66, 550, 1)).toHaveLength(485);
  });

  it('returns nothing when the range is backwards', () => {
    expect(range(10, 5, 1)).toEqual([]);
  });
});

describe('finding where a stored value sits', () => {
  const kg = range(30, 250, 0.5);

  it('lands on an exact match', () => {
    expect(kg[nearestIndex(kg, 80)]).toBe(80);
  });

  it('snaps to the nearest row when the value is between two', () => {
    // Weight is stored in kilograms and shown in pounds, so 80 kg is 176.37 lb - not a whole
    // pound, and not on the wheel. Showing the nearest is right; showing nothing is not.
    const lb = range(66, 550, 1);
    expect(lb[nearestIndex(lb, 176.37)]).toBe(176);
  });

  it('clamps to an end rather than failing when the value is off the scale', () => {
    expect(kg[nearestIndex(kg, 5)]).toBe(30);
    expect(kg[nearestIndex(kg, 900)]).toBe(250);
  });

  it('starts at the top when nothing is set', () => {
    expect(nearestIndex(kg, null)).toBe(0);
  });

  it('survives an empty list', () => {
    expect(nearestIndex([], 50)).toBe(0);
  });
});

describe('dragging the list', () => {
  it('cannot be dragged past either end', () => {
    expect(clampOffset(-9999, 10)).toBe(0);
    expect(clampOffset(9999, 10)).toBe(9 * ITEM_HEIGHT);
  });

  it('pins a single-value wheel', () => {
    expect(clampOffset(500, 1)).toBe(0);
  });

  it('carries further the harder it is flicked', () => {
    // A wheel that only ever snapped to the nearest row would feel stuck.
    const gentle = flingIndex(offsetFor(20), -0.2, 100);
    const hard = flingIndex(offsetFor(20), -2, 100);
    expect(hard).toBeGreaterThan(gentle);
    expect(gentle).toBeGreaterThan(20);
  });

  it('goes the way the finger went', () => {
    // vy is positive downward, and dragging down reveals earlier values.
    expect(flingIndex(offsetFor(50), 1, 100)).toBeLessThan(50);
    expect(flingIndex(offsetFor(50), -1, 100)).toBeGreaterThan(50);
  });

  it('stops at the end however hard it is thrown', () => {
    expect(flingIndex(offsetFor(95), -50, 100)).toBe(99);
    expect(flingIndex(offsetFor(5), 50, 100)).toBe(0);
  });

  it('does not move when released without a flick', () => {
    expect(flingIndex(offsetFor(30), 0, 100)).toBe(30);
  });
});

describe('which rows to draw', () => {
  it('draws only a window, not all 441 weights', () => {
    const { from, to } = visibleRange(offsetFor(200), 441);
    expect(to - from).toBeLessThanOrEqual(VISIBLE_ITEMS + 4);
  });

  it('centres the window on what is under the marker', () => {
    const { from, to } = visibleRange(offsetFor(200), 441);
    expect(from).toBeLessThan(200);
    expect(to).toBeGreaterThan(200);
  });

  it('does not run off either end of the list', () => {
    expect(visibleRange(offsetFor(0), 441).from).toBe(0);
    expect(visibleRange(offsetFor(440), 441).to).toBe(440);
  });

  it('covers what is on screen plus slack for a fast flick', () => {
    const { from, to } = visibleRange(offsetFor(200), 441, 2);
    expect(to - from + 1).toBeGreaterThanOrEqual(VISIBLE_ITEMS);
  });
});
