import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useStore } from '@/store/useStore';
import { readLaunchTheme, theme, writeLaunchTheme } from './theme';
import { markThemeReload } from './themeReload';

/**
 * Keeps the launch cache honest about which theme the store says to use.
 *
 * The store is the source of truth but resolves too late to paint with (see theme.ts), so the
 * choice is mirrored into a key that can be read synchronously. Almost always the two already
 * agree and this does nothing. The case that matters is a **restore from backup**: the blob
 * brings someone's theme across from their old phone, the mirror on this device still says
 * whatever was chosen here, and without reconciling them the app would paint the wrong palette
 * on every launch while the settings screen insisted the right one was selected.
 *
 * It reloads at most once, and only after confirming the write actually stuck - reloading on a
 * write that failed would land back in exactly this state and do it again, forever.
 */
export function useThemeSync() {
  const wanted = useStore((s) => s.settings.themeId);
  const hydrated = useStore.persist.hasHydrated();
  const reloaded = useRef(false);

  useEffect(() => {
    // Before hydration `wanted` is the default rather than the user's, and acting on it would
    // reload anyone whose stored theme is not the default, every single launch.
    if (!hydrated || reloaded.current) return;
    if (readLaunchTheme() === wanted) return;

    const stuck = writeLaunchTheme(wanted);
    // Nothing painted yet is wrong if the palette on screen already matches; the write was just
    // catching the cache up.
    if (!stuck || theme.id === wanted) return;

    reloaded.current = true;
    reloadApp();
  }, [hydrated, wanted]);
}

/**
 * Restarts the app so the new palette reaches the stylesheets, which were built at import.
 *
 * Web only, which is where this app actually runs - it is installed from the browser, not from
 * a store. Native has no synchronous storage to read the choice back from at launch anyway, so
 * there is nothing a restart there would pick up; see `themeAppliesImmediately`.
 */
export function reloadApp(reopenPicker = false) {
  if (Platform.OS !== 'web') return;
  // Leaves a note for the far side, so the restart comes back to this spot - and, when the
  // change came from the picker, with the picker still open. See themeReload.ts.
  markThemeReload(reopenPicker);
  try {
    globalThis.location?.reload();
  } catch {
    // A sandboxed frame can refuse. The theme is saved either way and will apply next launch.
  }
}
