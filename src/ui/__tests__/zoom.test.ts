import {
  clampOffset,
  clampScale,
  distance,
  maxOffset,
  MAX_SCALE,
  MIN_SCALE,
  pinchScale,
  swipeFrom,
  SWIPE_MIN_PX,
} from '@/ui/zoom';

describe('clampScale', () => {
  it('will not shrink an image below fitted', () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(-4)).toBe(MIN_SCALE);
  });

  it('stops at the point the pixels outgrow the detail', () => {
    expect(clampScale(50)).toBe(MAX_SCALE);
  });

  it('passes anything sensible through untouched', () => {
    expect(clampScale(2.5)).toBe(2.5);
  });

  it('falls back to fitted rather than propagating a number that is not one', () => {
    // A pinch dividing by a zero distance would otherwise poison every frame after it. Fitted
    // is the safe landing: the whole photo, visible, however the gesture went wrong.
    expect(clampScale(NaN)).toBe(MIN_SCALE);
    expect(clampScale(Infinity)).toBe(MIN_SCALE);
  });
});

describe('distance', () => {
  it('measures between two fingers', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is zero for two fingers in one place', () => {
    expect(distance({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
  });
});

describe('maxOffset', () => {
  it('is zero at fitted, so a fitted photo cannot be dragged away', () => {
    expect(maxOffset(400, MIN_SCALE)).toBe(0);
  });

  it('grows with the part of the image hanging outside the frame', () => {
    // At 2x the image is twice the frame, so half of it - 200px - hides either side.
    expect(maxOffset(400, 2)).toBe(200);
  });

  it('never goes negative, whatever it is handed', () => {
    expect(maxOffset(400, 0.1)).toBe(0);
    expect(maxOffset(0, 3)).toBe(0);
  });
});

describe('clampOffset', () => {
  const frame = { width: 400, height: 800 };

  it('pins a fitted image dead centre', () => {
    expect(clampOffset({ x: 999, y: -999 }, frame, MIN_SCALE)).toEqual({ x: 0, y: 0 });
  });

  it('allows a pan within the hidden part of the image', () => {
    expect(clampOffset({ x: 100, y: -300 }, frame, 2)).toEqual({ x: 100, y: -300 });
  });

  it('stops the pan at the edge of the photo rather than past it', () => {
    expect(clampOffset({ x: 5000, y: 5000 }, frame, 2)).toEqual({ x: 200, y: 400 });
    expect(clampOffset({ x: -5000, y: -5000 }, frame, 2)).toEqual({ x: -200, y: -400 });
  });

  it('reels a pan back in when the image is zoomed out under it', () => {
    // Panned to the far edge at 3x, then pinched back to 1.5x: the old offset would leave a
    // band of black against one side.
    const panned = clampOffset({ x: 9999, y: 0 }, frame, 3);
    expect(clampOffset(panned, frame, 1.5).x).toBe(100);
  });
});

describe('pinchScale', () => {
  it('doubles when the fingers move twice as far apart', () => {
    expect(pinchScale(1, 100, 200)).toBe(2);
  });

  it('halves when they come together', () => {
    expect(pinchScale(2, 200, 100)).toBe(1);
  });

  it('carries on from where the last pinch left off', () => {
    expect(pinchScale(2, 100, 150)).toBe(3);
  });

  it('respects the limits', () => {
    expect(pinchScale(1, 10, 10_000)).toBe(MAX_SCALE);
    expect(pinchScale(1, 10_000, 10)).toBe(MIN_SCALE);
  });

  it('does not move on a gesture that began with both fingers together', () => {
    // Dividing by that zero would be an Infinity scale and a blank screen.
    expect(pinchScale(1.5, 0, 300)).toBe(1.5);
  });
});

describe('swipeFrom', () => {
  it('pages forward when the finger goes left, back when it goes right', () => {
    expect(swipeFrom(-120, 0, false)).toBe('next');
    expect(swipeFrom(120, 0, false)).toBe('prev');
  });

  it('closes on a swipe either way vertically', () => {
    // Both directions mean the same thing. A viewer that only closed downwards would feel
    // broken the half of the time you flicked the other way.
    expect(swipeFrom(0, -120, false)).toBe('dismiss');
    expect(swipeFrom(0, 120, false)).toBe('dismiss');
  });

  it('ignores a drag too short to have been meant', () => {
    expect(swipeFrom(SWIPE_MIN_PX - 1, 0, false)).toBeNull();
    expect(swipeFrom(0, SWIPE_MIN_PX - 1, false)).toBeNull();
    expect(swipeFrom(0, 0, false)).toBeNull();
  });

  it('ignores a diagonal drag rather than guessing', () => {
    // 45 degrees is genuinely ambiguous, and the two readings do very different things.
    expect(swipeFrom(100, 100, false)).toBeNull();
    expect(swipeFrom(-100, 95, false)).toBeNull();
  });

  it('takes a clear winner even when the other axis moved', () => {
    expect(swipeFrom(-200, 40, false)).toBe('next');
    expect(swipeFrom(30, 200, false)).toBe('dismiss');
  });

  it('does nothing at all once the image is zoomed', () => {
    // The whole point: dragging a zoomed photo moves it. Paging or closing instead would make
    // a zoomed image impossible to look at.
    for (const [dx, dy] of [[-300, 0], [300, 0], [0, -300], [0, 300]]) {
      expect(swipeFrom(dx, dy, true)).toBeNull();
    }
  });

  it('needs a real distance, not just a dominant axis', () => {
    // 10px sideways is dominant over 0px vertical, and is still a tap with a shaky hand.
    expect(swipeFrom(-10, 0, false)).toBeNull();
  });
});
