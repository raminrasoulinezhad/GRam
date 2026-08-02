/**
 * The arithmetic behind pinch-to-zoom, kept apart from the gestures that drive it.
 *
 * Touch handling is close to untestable - it needs real fingers on real glass - but the sums
 * are not, and the sums are where a zoom viewer goes wrong: an image that will not come back
 * to fit, or that can be dragged off the screen and lost. Those are unit tests here rather
 * than something to notice in a gym.
 */

/** Fully zoomed out is the image fitted to the screen; there is no reason to go smaller. */
export const MIN_SCALE = 1;

/**
 * Four times fitted. The source photographs are around 1000px wide, so past this the pixels
 * are bigger than the detail they are meant to show.
 */
export const MAX_SCALE = 4;

/** What a double tap jumps to, and back from. */
export const DOUBLE_TAP_SCALE = 2.5;

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Distance between two fingers. The ratio of this to where it started is the pinch. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * How far the image can be dragged along one axis before its edge comes inside the frame.
 *
 * At 1x the image exactly fits, so the answer is zero and it cannot be dragged at all - which
 * is what stops a fitted photo from being flicked into the void.
 */
export function maxOffset(size: number, scale: number): number {
  return Math.max(0, (size * (clampScale(scale) - 1)) / 2);
}

/** Keeps a pan inside the bounds above, so an edge of the photo is always against the frame. */
export function clampOffset(offset: Point, size: Size, scale: number): Point {
  // The `+ 0` normalises -0, which a clamp against a zero bound produces and which then reads
  // back out of a transform as a different value from the 0 that means the same thing.
  const axis = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value)) + 0;
  return {
    x: axis(offset.x, maxOffset(size.width, scale)),
    y: axis(offset.y, maxOffset(size.height, scale)),
  };
}

/**
 * The scale a pinch has reached, from where it started.
 *
 * A zero starting distance means the gesture began with both fingers in one spot, which is not
 * a pinch and would divide by zero; the scale simply does not move.
 */
export function pinchScale(startScale: number, startDistance: number, now: number): number {
  if (startDistance <= 0) return clampScale(startScale);
  return clampScale((startScale * now) / startDistance);
}
