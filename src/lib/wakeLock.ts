import { useEffect } from 'react';

/**
 * Holds the screen awake while a timer is running.
 *
 * A timed set is the one place in the app where nobody touches the phone. It goes on the floor
 * or the bench, you get into position, and for the next sixty seconds the only input the device
 * sees is nothing at all - so the display dims and then locks, exactly when the number on it is
 * the whole point. Resting is the same shape of problem with a longer fuse.
 *
 * WHY THIS IS HAND-ROLLED
 * `expo-keep-awake` would do it, but its web implementation is this file: a call to the Screen
 * Wake Lock API. GRam ships as a PWA and that is how every user reaches it, so a dependency
 * would add a package, a licence entry and a native module to serve a path nobody takes. Where
 * the API is missing - an older browser, a native runtime - every function here is a no-op and
 * the timer still keeps correct time, because the clock was never tied to the screen.
 *
 * THE PART THAT IS EASY TO GET WRONG
 * The lock is not permanent. The browser drops it the moment the page is hidden, and it does
 * not come back on its own: switch to another app mid-plank, come back, and the screen would go
 * dark under a running timer even though nothing here had released anything. So the sentinel is
 * re-requested on every `visibilitychange` that lands visible, for as long as the caller still
 * wants it held.
 */

type Sentinel = {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

function api(): WakeLockApi | null {
  const nav = globalThis.navigator as (Navigator & { wakeLock?: WakeLockApi }) | undefined;
  return nav?.wakeLock ?? null;
}

/**
 * Keeps the display on while `active`.
 *
 * Safe to call unconditionally: passing `false` releases anything held, and a component may
 * unmount at any point without leaking the lock.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLock = api();
    if (!active || !wakeLock) return;

    /*
     * `cancelled` guards the gap between asking and being granted. Stopping a set early can
     * finish the whole timer inside that gap, and the sentinel would then arrive after the
     * effect had already been torn down - holding the screen on for the rest of the session
     * with nothing left alive to release it.
     */
    let cancelled = false;
    let held: Sentinel | null = null;

    const acquire = async () => {
      // Requesting a second one while the first is live is legal but pointless, and each one
      // has to be released separately.
      if (cancelled || (held && !held.released)) return;
      try {
        const sentinel = await wakeLock.request('screen');
        if (cancelled) return void sentinel.release().catch(() => undefined);
        held = sentinel;
      } catch {
        /*
         * Rejected rather than absent: the page is hidden, or the browser wants a gesture it
         * did not get. Neither is worth telling the user about - the timer is still correct,
         * the screen just behaves as it did before. The visibility handler will try again.
         */
      }
    };

    // Re-taken every time the page comes back, because the browser released it on the way out.
    const onVisible = () => {
      if (globalThis.document?.visibilityState === 'visible') void acquire();
    };

    void acquire();
    globalThis.document?.addEventListener?.('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      globalThis.document?.removeEventListener?.('visibilitychange', onVisible);
      // Errors here are ignored on purpose: the common one is releasing a lock the browser has
      // already taken back, which is not a failure, it is the same outcome by another route.
      if (held && !held.released) void held.release().catch(() => undefined);
      held = null;
    };
  }, [active]);
}
