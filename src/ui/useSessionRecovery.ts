import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

/**
 * Settles workouts left open on an earlier day, once per launch.
 *
 * WHY A WORKOUT HAS TO SURVIVE THE APP CLOSING
 * A session is written to storage the moment it starts and again on every set, so the training
 * is never only in memory. What was missing was the way back to it: the app remembered *which*
 * session was live in a separate pointer, and a workout whose pointer went missing became
 * unreachable while still sitting on disk. The plans screen said nothing was in progress and
 * History showed only finished workouts, so from the outside it had disappeared. It had not.
 * `resumableSession` now reads the sessions themselves and treats the pointer as a hint, and
 * History lists a workout with sets in it whether or not it has been finished.
 *
 * What is left is the other end of the same problem: a workout nobody ever finished should not
 * still be in progress a week later. This closes those, dated to the last set recorded in them.
 *
 * WAITS FOR HYDRATION
 * Same reason as useVersionLog: writing to the store before the persisted blob has loaded
 * flushes the empty initial state over the real one. Here it would be worse than a stale
 * version log - the write would be "there are no sessions", which is the exact shape of the
 * bug this hook exists to prevent.
 */
export function useSessionRecovery(): void {
  const closeStaleSessions = useStore((s) => s.closeStaleSessions);

  useEffect(() => {
    const run = () => closeStaleSessions(Date.now());

    if (useStore.persist.hasHydrated()) {
      run();
      return;
    }
    return useStore.persist.onFinishHydration(run);
  }, [closeStaleSessions]);
}
