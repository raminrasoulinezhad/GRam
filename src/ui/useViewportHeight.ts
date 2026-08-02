import { useEffect } from 'react';
import { Platform } from 'react-native';

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

export function useViewportHeight(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      const layout = window.innerHeight;
      const covered = layout - vv.height;
      if (covered >= KEYBOARD_MIN_PX) {
        document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      } else {
        document.documentElement.style.removeProperty('--vvh');
      }
    };

    apply();
    vv.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      document.documentElement.style.removeProperty('--vvh');
    };
  }, []);
}
