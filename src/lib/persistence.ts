import { Platform } from 'react-native';

/**
 * Asking the browser to hold on to what this app has stored.
 *
 * This file used to be `autoExport.ts` and held the File System Access machinery for writing
 * backups to a single file the user had picked once, with the handle kept in IndexedDB. That
 * approach was superseded by the folder archive in `directory.ts`, which writes a whole `GRam`
 * directory rather than one blob, and the file-based code sat unused for several releases
 * before being removed. The one function worth keeping is below.
 */

/**
 * Asks the browser not to evict this app's storage under pressure.
 *
 * Does nothing about deliberate deletion, which is what the backup is for. It addresses a
 * quieter failure: a browser reclaiming space from a site it thinks is idle. Safari exempts
 * home-screen web apps from its seven-day rule already, so this is mostly for the browser tab.
 * Returns whether storage is persistent afterwards, however it got that way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.storage) {
    return false;
  }
  try {
    if (await navigator.storage.persisted?.()) return true;
    return (await navigator.storage.persist?.()) ?? false;
  } catch {
    return false;
  }
}
