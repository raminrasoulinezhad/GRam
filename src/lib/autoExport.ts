import { Platform } from 'react-native';

/**
 * Writing backups to a file the user chose once, without asking again.
 *
 * WHAT IS AND IS NOT POSSIBLE
 * A web app cannot write to your disk. That is a deliberate browser rule, not an oversight, and
 * there is no way around it. The one sanctioned exception is the File System Access API: the
 * user picks a file through the system dialog, the page receives a handle to it, and that handle
 * can be kept and written to later without prompting again. That is genuine automatic export -
 * pick a file once, and every change writes itself.
 *
 * The catch is where it exists. Chrome and Edge on desktop: yes. Safari: no, on any platform,
 * including iOS. Chrome on Android: no. So on an iPhone - which is where this app actually runs
 * - automatic export to a file in Files is not available, and no amount of work here will make
 * it so. What iOS gets instead is a reminder and a one-tap export; see BackupCard.
 *
 * The handle lives in IndexedDB because a FileSystemFileHandle is structured-cloneable but not
 * JSON, so it cannot go in the same store as everything else.
 */

const DB = 'gram-backup';
const STORE = 'handles';
const KEY = 'auto-export-file';

type Permission = 'granted' | 'denied' | 'prompt';

type FileHandle = {
  name: string;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
  queryPermission: (opts: { mode: 'readwrite' }) => Promise<Permission>;
  requestPermission: (opts: { mode: 'readwrite' }) => Promise<Permission>;
};

const isWeb = Platform.OS === 'web';

/** True when this browser can hand out a reusable write handle to a file the user picks. */
export function isAutoExportSupported(): boolean {
  return isWeb && typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

async function put(value: FileHandle | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (value === null) store.delete(KEY);
    else store.put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the file handle'));
  });
  db.close();
}

async function get(): Promise<FileHandle | null> {
  if (!isWeb || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const handle = await new Promise<FileHandle | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as FileHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/** Name of the file auto-export writes to, or null when none has been chosen. */
export async function autoExportTarget(): Promise<string | null> {
  const handle = await get();
  return handle?.name ?? null;
}

export type ChooseResult = { ok: true; name: string } | { ok: false; reason: 'cancelled' | 'unsupported' | 'error' };

/**
 * Asks the user where to keep their backup, and remembers it.
 *
 * Must be called from a user gesture - the picker will not open otherwise.
 */
export async function chooseBackupFile(suggestedName: string): Promise<ChooseResult> {
  if (!isAutoExportSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const picker = (window as unknown as {
      showSaveFilePicker: (o: unknown) => Promise<FileHandle>;
    }).showSaveFilePicker;

    const handle = await picker({
      suggestedName,
      types: [{ description: 'GRam backup', accept: { 'application/json': ['.json'] } }],
    });
    await put(handle);
    return { ok: true, name: handle.name };
  } catch (e) {
    // The picker throws AbortError when the user closes it, which is not a failure.
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    return { ok: false, reason: aborted ? 'cancelled' : 'error' };
  }
}

export async function forgetBackupFile(): Promise<void> {
  if (!isWeb || typeof indexedDB === 'undefined') return;
  try {
    await put(null);
  } catch {
    // Nothing to undo; the caller turns the setting off regardless.
  }
}

export type WriteResult = 'written' | 'no-file' | 'denied' | 'error';

/**
 * Writes to the chosen file.
 *
 * Permission can lapse between sessions, and re-requesting it needs a user gesture. So a silent
 * background write that finds permission missing reports 'denied' rather than throwing a dialog
 * at someone mid-workout; the UI turns auto-export off and says why.
 */
export async function writeBackupFile(text: string): Promise<WriteResult> {
  const handle = await get();
  if (!handle) return 'no-file';

  try {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'prompt') permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') return 'denied';

    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return 'written';
  } catch {
    return 'error';
  }
}

/**
 * Asks the browser not to evict this app's storage under pressure.
 *
 * Does nothing about deliberate deletion, which is what the backup file is for. It addresses a
 * quieter failure: a browser reclaiming space from a site it thinks is idle. Safari exempts
 * home-screen web apps from its seven-day rule already, so this is mostly for the browser tab.
 * Returns whether storage is persistent afterwards, however it got that way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!isWeb || typeof navigator === 'undefined' || !navigator.storage) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return (await navigator.storage.persist?.()) ?? false;
  } catch {
    return false;
  }
}
