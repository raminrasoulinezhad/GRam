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
 */
export function useVersionLog(): void {
  const recordVersion = useStore((s) => s.recordVersion);

  useEffect(() => {
    const version = Constants.expoConfig?.version;
    if (version) recordVersion(version, Date.now());
  }, [recordVersion]);
}
