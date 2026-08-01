import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

export const STORAGE_KEY = 'fitram-v1';

/** Where the pre-migration copy of an upgraded blob is kept. */
export const backupKey = (fromVersion: number) => `${STORAGE_KEY}-backup-v${fromVersion}`;

/**
 * AsyncStorage, plus one safety net.
 *
 * The moment a user's data is at risk is the first launch after an upgrade, when a migration
 * rewrites their blob into a new shape. If a migration has a bug, the original is gone -
 * zustand writes the migrated result straight back over it. So before handing anything to the
 * migration layer we stash a verbatim copy under a version-stamped key.
 *
 * The copy is written once per source version and never overwritten, so it always holds the
 * data as it was immediately before that upgrade. It costs a few hundred KB and buys a
 * recoverable path out of a bad release.
 */
export function createBackingStorage(
  currentVersion: number,
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'> = AsyncStorage,
): StateStorage {
  return {
    getItem: async (name) => {
      const raw = await storage.getItem(name);
      if (raw === null) return null;

      try {
        const parsed = JSON.parse(raw) as { version?: number };
        const from = typeof parsed.version === 'number' ? parsed.version : 0;

        if (from < currentVersion) {
          const key = backupKey(from);
          // Never clobber an existing backup: the first one is the pristine copy.
          if ((await storage.getItem(key)) === null) {
            await storage.setItem(key, raw);
          }
        }
      } catch {
        // Unparseable. Keep a copy anyway - it is the only evidence of what went wrong, and
        // the migration layer will fall back to defaults rather than crash.
        const key = backupKey(-1);
        if ((await storage.getItem(key)) === null) await storage.setItem(key, raw);
      }

      return raw;
    },

    setItem: (name, value) => storage.setItem(name, value),
    removeItem: (name) => storage.removeItem(name),
  };
}
