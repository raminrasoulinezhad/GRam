import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { buildBackup, serialiseBackup, summarise } from '@/store/backup';
import { useStore } from '@/store/useStore';
import { isAutoExportSupported, writeBackupFile } from '@/lib/autoExport';

/**
 * Keeps the chosen backup file up to date on its own.
 *
 * Mounted once at the app root. It watches the data, not the screens, so a set logged in the
 * middle of a workout reaches the file whether or not anyone visits Profile afterwards - which
 * is the entire point: a backup you have to remember to take is one you will not have when you
 * need it.
 *
 * Writes are debounced. Editing a weight fires a change per keystroke, and rewriting the whole
 * blob each time would put file I/O on the typing path for no benefit; a couple of seconds of
 * quiet means the file is never more than a moment behind and the app never stutters.
 *
 * If permission to the file has lapsed - the browser drops it between sessions, and getting it
 * back needs a click - auto-export switches itself off rather than throwing a dialog at someone
 * mid-set. The Profile card then says so and offers to pick the file again.
 */
const DEBOUNCE_MS = 2_000;

export function useAutoBackup(): void {
  const plans = useStore((s) => s.plans);
  const sessions = useStore((s) => s.sessions);
  const autoExport = useStore((s) => s.backup.autoExport);
  const exportState = useStore((s) => s.exportState);
  const recordExport = useStore((s) => s.recordExport);
  const setAutoExport = useStore((s) => s.setAutoExport);

  /** Skips the write triggered by simply opening the app, which would change nothing. */
  const primed = useRef(false);

  useEffect(() => {
    if (!autoExport || !isAutoExportSupported()) return;
    if (!primed.current) {
      primed.current = true;
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        const state = exportState();
        const text = serialiseBackup(
          buildBackup(state, Constants.expoConfig?.version ?? '0.0.0', Date.now()),
        );
        const result = await writeBackupFile(text);

        if (result === 'written') {
          recordExport(Date.now(), summarise(state).loggedSets);
        } else if (result === 'denied' || result === 'no-file') {
          // Nothing is being saved, and pretending otherwise is worse than stopping.
          setAutoExport(false);
        }
        // 'error' is left armed: a transient write failure should not disarm the safety net.
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [plans, sessions, autoExport, exportState, recordExport, setAutoExport]);
}
