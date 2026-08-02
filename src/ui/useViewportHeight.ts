import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Keeps the app exactly as tall as the space the keyboard leaves.
 *
 * When the iOS keyboard opens it shrinks the *visual* viewport but leaves the *layout* viewport
 * at full height. A 100%-tall app therefore overflows, the page becomes scrollable, and tapping
 * the search box lets the header, the filter chips and the tab bar all slide around - when the
 * only thing that should ever scroll is the results list.
 *
 * visualViewport is the only API that reports the real usable height while the keyboard is up;
 * every CSS unit, dvh included, is unreliable in a standalone iOS web app. This publishes it as
 * --vvh, which index.html applies to the body.
 *
 * In the bundle rather than an inline script because the Content-Security-Policy sets no
 * script-src, so default-src 'self' forbids inline JavaScript.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);
}
