import { useEffect, useRef } from 'react';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';

/**
 * Making the reload after a theme change look like nothing happened.
 *
 * Changing the palette has to restart the app - the stylesheets were built at import and cannot
 * be repainted (see theme.ts). Left alone that restart is loud: the logo screen plays, and the
 * Profile page comes back at the top, several screens above the picker you just tapped. You
 * chose a colour and got thrown out of the page.
 *
 * So the reload carries two things across it - "this was deliberate" and "you were here" - and
 * the far side uses them to come back quietly to the same place.
 *
 * The note is read ONCE, here at import, and deleted immediately. That matters: it must not
 * survive to a later manual refresh, where restoring a scroll position nobody asked for would
 * be its own small bug.
 */

const KEY = 'gram-theme-reload';

/**
 * A note older than this did not come from a reload we started - the tab was left open, or the
 * reload never happened. Generous, because a slow phone reloading a cold bundle is not fast,
 * and harmless, because the note is deleted on read either way.
 */
const FRESH_MS = 30_000;

type Note = { y: number; at: number };

function store(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads the note left before the reload and clears it, so it is only ever used once. */
function consume(): Note | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    s.removeItem(KEY);
    if (raw === null) return null;

    const note = JSON.parse(raw) as Partial<Note>;
    if (typeof note.y !== 'number' || typeof note.at !== 'number') return null;
    if (Date.now() - note.at > FRESH_MS) return null;
    return { y: note.y, at: note.at };
  } catch {
    return null;
  }
}

const arrived = consume();

/** Where the page was scrolled to, tracked live so it is known at the moment of the reload. */
let lastScrollY = 0;

/** True when this launch is the far side of a theme change rather than a cold start. */
export function isThemeReload(): boolean {
  return arrived !== null;
}

/** Leaves the note. Called immediately before reloading. */
export function markThemeReload(): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify({ y: lastScrollY, at: Date.now() } satisfies Note));
  } catch {
    // Out of quota, or a browser refusing storage. The reload still works; it just lands at
    // the top, which is where it landed before any of this existed.
  }
}

/**
 * Keeps a scroll view's position across a theme change.
 *
 * Records where you are as you scroll, and puts you back there on the far side of the reload -
 * but only then. An ordinary visit to the page still starts at the top, because a page that
 * silently remembers a scroll position from some earlier visit is disorienting in its own way.
 */
export function useKeepScrollAcrossThemeChange(ref: React.RefObject<ScrollView | null>) {
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || arrived === null || arrived.y <= 0) return;
    restored.current = true;

    /*
     * Retried rather than done once, and on timers rather than animation frames.
     *
     * The content has to be tall enough to hold the offset before it will take, and on this
     * page that is not true until the store has hydrated and the cards have measured. Timers
     * for the same reason as the wheel: requestAnimationFrame does not fire at all while the
     * page is not compositing, which is exactly the state a reloading tab passes through.
     */
    const timers = [0, 50, 150, 300, 600].map((ms) =>
      setTimeout(() => ref.current?.scrollTo({ y: arrived.y, animated: false }), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [ref]);

  return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScrollY = event.nativeEvent.contentOffset.y;
  };
}
