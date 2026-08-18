import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/*
 * DO NOT RENAME. This survived the FitRam -> GRam rebrand deliberately.
 *
 * The key is where every existing install's plans and logged workouts live. Renaming it does
 * not move the data; it points the app at an empty slot and every user opens a blank app with
 * their training history still on disk and unreachable. The name is invisible to users and
 * changing it buys nothing. Same goes for the backup prefix below.
 */
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
    /**
     * Reads the blob, stashing a copy first if a migration is about to rewrite it.
     *
     * NOTHING IN THE STASHING MAY THROW
     * Whatever happens here, the caller gets its data back. Taking the safety copy is a nicety;
     * returning the user's training is not. An earlier version let a failed write escape from
     * this function, which meant a device with no room left could not *load* - zustand sees the
     * rejection, gives up on rehydration and hands the app its initial state, and the user opens
     * a blank app with everything they have logged sitting intact on disk behind it. The very
     * failure this file was written to prevent, caused by the code preventing it.
     */
    getItem: async (name) => {
      const raw = await storage.getItem(name);
      if (raw === null) return null;

      let key: string;
      try {
        const parsed = JSON.parse(raw) as { version?: number };
        const from = typeof parsed.version === 'number' ? parsed.version : 0;
        if (from >= currentVersion) return raw;
        key = backupKey(from);
      } catch {
        // Unparseable. Keep a copy anyway: it is the only evidence of what went wrong, and the
        // migration layer will fall back to defaults rather than crash.
        key = backupKey(-1);
      }

      try {
        // Never clobber an existing backup: the first one is the pristine copy.
        if ((await storage.getItem(key)) === null) await storage.setItem(key, raw);
      } catch {
        // No room, or storage refusing writes. Proceed without insurance.
      }

      return raw;
    },

    /**
     * Writes the blob, and fights for it.
     *
     * A rejected write is the quietest way this app can lose data: the sets are on screen, the
     * app looks fine, and nothing reached disk. It is not hypothetical - a home-screen web app
     * on iOS gets a few megabytes, and the pre-migration copies below sit in the same budget as
     * the live blob they are insuring.
     *
     * So when a write fails, the copies go and the write is tried again. That is the right
     * order of sacrifice: the insurance protects against a bad migration, which is a risk, and
     * the live blob is this week's training, which is a certainty.
     */
    setItem: async (name, value) => {
      try {
        await storage.setItem(name, value);
      } catch {
        await clearPreMigrationBackups(currentVersion, storage);
        // Deliberately unguarded. If it still will not go, the caller has to know: a silent
        // failure here is the user's workout disappearing with the app reporting success.
        await storage.setItem(name, value);
      }
    },

    removeItem: (name) => storage.removeItem(name),
  };
}

/**
 * Every schema version a pre-migration copy could have been stashed under.
 *
 * Zero to the current version, plus -1 for the copy taken when a blob would not parse. There is
 * no index of which ones exist, so erasing has to ask about all of them; removing a key that
 * was never written is free.
 */
export function allBackupKeys(currentVersion: number): string[] {
  const keys = [backupKey(-1)];
  for (let v = 0; v <= currentVersion; v++) keys.push(backupKey(v));
  return keys;
}

/**
 * Deletes the pre-migration copies.
 *
 * Called by Erase all data, and by nothing else. The safety net exists so a bad migration is
 * recoverable, which is worth a few hundred KB sitting in storage indefinitely - but it holds a
 * verbatim copy of the plans, the workouts, the name, the birth date and the body weight, and
 * a button that says the data is deleted from this device has to be telling the truth. On a
 * shared laptop it is the difference between a promise kept and a promise broken.
 *
 * Resolves rather than throwing: the live data is already gone by the time this runs, and a
 * storage error here must not surface as a failure of an erase that did in fact happen.
 */
export async function clearPreMigrationBackups(
  currentVersion: number,
  storage: Pick<typeof AsyncStorage, 'removeItem'> = AsyncStorage,
): Promise<void> {
  await Promise.all(
    allBackupKeys(currentVersion).map((key) =>
      Promise.resolve(storage.removeItem(key)).catch(() => undefined),
    ),
  );
}
