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

/**
 * How far a finger must travel before a drag counts as a swipe rather than a sloppy tap.
 * Roughly a thumb's width; below this, small hand movements while double-tapping would page.
 */
export const SWIPE_MIN_PX = 60;

/**
 * How much the dominant axis must beat the other by.
 *
 * Without it a diagonal drag is a coin toss between paging and dismissing, and those two have
 * very different consequences - one of them shuts the photo you were reading.
 */
export const SWIPE_RATIO = 1.3;

export type Swipe = 'next' | 'prev' | 'dismiss' | null;

/**
 * What a finished one-finger drag meant.
 *
 * `zoomed` decides whether there is a question at all: once the image is bigger than the frame,
 * dragging is how you move around it, and stealing that to change photos would make a zoomed
 * image impossible to read. So a swipe is only a swipe at fit-to-screen.
 *
 * Sideways pages, either way vertically dismisses. Vertical is deliberately not split into up
 * and down - both mean "get this off my screen", and a viewer that only closed one way would
 * just feel broken half the time.
 */
export function swipeFrom(dx: number, dy: number, zoomed: boolean): Swipe {
  if (zoomed) return null;

  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (ax >= SWIPE_MIN_PX && ax >= ay * SWIPE_RATIO) {
    // Dragging left pulls the next photo in from the right, the way paging works everywhere.
    return dx < 0 ? 'next' : 'prev';
  }
  if (ay >= SWIPE_MIN_PX && ay >= ax * SWIPE_RATIO) return 'dismiss';
  return null;
}
