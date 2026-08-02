import { isKeyboardCovering } from '@/ui/useViewportHeight';

/**
 * The threshold is the whole judgement, and it is wrong in both directions.
 *
 * Too low and a scrollbar or a browser toolbar collapses the layout for no reason. Too high and
 * a short keyboard - a numeric pad on a large phone - is missed, which is exactly the case the
 * set fields run into.
 */
describe('isKeyboardCovering', () => {
  it('says no when the two viewports agree', () => {
    expect(isKeyboardCovering(844, 844)).toBe(false);
  });

  it('says no to a browser toolbar sliding in', () => {
    expect(isKeyboardCovering(844, 800)).toBe(false);
  });

  it('says yes to a keyboard taking a third of the screen', () => {
    expect(isKeyboardCovering(844, 508)).toBe(true);
  });

  it('says yes to the shallow numeric pad the set fields open', () => {
    // An iPhone decimal pad is around 220pt - well above the threshold, well below a full
    // keyboard with a suggestion bar.
    expect(isKeyboardCovering(844, 624)).toBe(true);
  });

  it('does not mistake a taller visual viewport for a keyboard', () => {
    // visualViewport can exceed innerHeight while a page is rubber-banding on iOS.
    expect(isKeyboardCovering(800, 844)).toBe(false);
  });
});
