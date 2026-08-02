import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Shrinks the app to fit above the on-screen keyboard, and does nothing otherwise.
 *
 * THE PROBLEM
 * When the iOS keyboard opens it shrinks the *visual* viewport but leaves the *layout* viewport
 * at full height. A 100%-tall app therefore overflows, the page becomes scrollable, and tapping
 * the search box lets the header, the filter chips and the tab bar all slide around - when the
 * only thing that should ever scroll is the results list.
 *
 * WHY THIS ONLY ACTS WHEN THE KEYBOARD IS UP
 * The first version of this pinned the body to visualViewport.height at all times. That is
 * wrong on iOS: with `apple-mobile-web-app-status-bar-style: black-translucent` and
 * `viewport-fit=cover` the app is meant to paint the full screen, under the status bar and the
 * home indicator, and visualViewport does not always report that full height. Pinning to it
 * left the app short of the bottom of the screen.
 *
 * So the height is only overridden when the visual viewport is dramatically shorter than the
 * layout viewport, which happens when and only when a keyboard is covering part of it. The rest
 * of the time --vvh is unset and the stylesheet's own 100dvh applies, which is the behaviour
 * that was correct all along.
 */

/** A keyboard takes a large bite. Anything smaller is a toolbar, a scrollbar or rounding. */
const KEYBOARD_MIN_PX = 120;

/**
 * Whether the difference between the two viewport heights is a keyboard rather than noise.
 *
 * Pulled out as a plain function because it is the whole judgement, and getting the threshold
 * wrong in either direction is a visible bug: too low and a scrollbar collapses the layout, too
 * high and a short keyboard is missed entirely.
 */
export function isKeyboardCovering(layoutHeight: number, visualHeight: number): boolean {
  return layoutHeight - visualHeight >= KEYBOARD_MIN_PX;
}

/**
 * Scrolls the field being typed into to the middle of what is still visible.
 *
 * Shrinking the app above the keyboard is only half the fix: the field can end up anywhere in
 * the space that remains, including under the keyboard, which is the complaint - the box being
 * edited disappears while the editing works fine. Nothing about a React Native ScrollView knows
 * this happened, so it is done to the DOM node directly.
 */
function keepFocusVisible(): void {
  const el = document.activeElement as HTMLElement | null;
  if (!el || typeof el.scrollIntoView !== 'function') return;
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !el.isContentEditable) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function useViewportHeight(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      if (isKeyboardCovering(window.innerHeight, vv.height)) {
        document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
        // The resize lands *after* the keyboard has finished opening, which is the only moment
        // the amount of room left is actually known.
        keepFocusVisible();
      } else {
        document.documentElement.style.removeProperty('--vvh');
      }
    };

    /*
     * Focus is handled as well as resize, and needed separately: moving from one field to the
     * next with the keyboard already up resizes nothing, so there would be no event to react
     * to. The delay lets the browser finish scrolling and laying out first - without it the
     * scroll is computed against the position the field is about to leave.
     */
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onFocusIn = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(keepFocusVisible, 150);
    };

    apply();
    vv.addEventListener('resize', apply);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      if (pending) clearTimeout(pending);
      vv.removeEventListener('resize', apply);
      document.removeEventListener('focusin', onFocusIn);
      document.documentElement.style.removeProperty('--vvh');
    };
  }, []);
}

/**
 * Whether the on-screen keyboard is up.
 *
 * A screen with anything pinned to the bottom needs to know. With the keyboard open there may
 * be only a third of the display left, and a footer of buttons holding station in it takes a
 * share of that third which the row being edited needs more.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      const vv = window.visualViewport;
      if (!vv) return;
      const apply = () => setOpen(isKeyboardCovering(window.innerHeight, vv.height));
      apply();
      vv.addEventListener('resize', apply);
      return () => vv.removeEventListener('resize', apply);
    }

    const shown = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return open;
}
