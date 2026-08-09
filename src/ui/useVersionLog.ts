import { useEffect } from 'react';
import Constants from 'expo-constants';
import { useStore } from '@/store/useStore';

/**
 * Notes that this build has run on this device.
 *
 * There is no server and no crash reporting, so when something looks wrong on a phone the first
 * question - which build is this actually running? - otherwise has no answer. During the app
 * icon problem it took several rounds to establish that the device was running a version from
 * weeks earlier; a log the user can read out settles that in one glance.
 *
 * Recorded once per version, on first launch of it. Shown in Profile > About.
 *
 * WAITS FOR HYDRATION, AND THAT IS THE IMPORTANT PART
 * This is the only thing in the app that writes to the store purely because the app opened.
 * Unguarded it fired at root mount, which is *before* the persisted blob has finished loading -
 * so it wrote a store still holding its empty initial state, and zustand's persist dutifully
 * flushed that over the real file. Hydration then finished and put everything back, so the
 * damage was invisible almost always: a window of a few tens of milliseconds in which storage
 * said the user had no plans and no workouts.
 *
 * Almost always is not a guarantee, and this app's one rule is that data survives. An app
 * killed in that window - a phone under memory pressure, a tab closed on a slow launch - comes
 * back empty. Waiting costs nothing: the version log is read on the About screen and nowhere
 * else, and it is no less accurate for being written a moment later.
 */
export function useVersionLog(): void {
  const recordVersion = useStore((s) => s.recordVersion);

  useEffect(() => {
    const version = Constants.expoConfig?.version;
    if (!version) return;

    const record = () => recordVersion(version, Date.now());

    // Already loaded when this mounts is the common case, and onFinishHydration would never
    // fire for it.
    if (useStore.persist.hasHydrated()) {
      record();
      return;
    }
    return useStore.persist.onFinishHydration(record);
  }, [recordVersion]);
}
