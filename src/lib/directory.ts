import { Platform } from 'react-native';
import { ARCHIVE_DIR } from '@/store/archive';

/**
 * A folder the app can keep writing into, chosen once.
 *
 * The user picks a parent - Documents, iCloud Drive, a Dropbox folder - and GRam creates a
 * `GRam/` directory inside it and keeps everything there. Picking the parent rather than the
 * folder itself is deliberate: it means the app names its own folder, so the backup is always
 * somewhere obvious and self-describing instead of loose files in whatever the user chose.
 *
 * WHERE THIS WORKS
 * `showDirectoryPicker` is Chrome and Edge on desktop. Safari does not have it, on any
 * platform, so an iPhone cannot do this - there the export is a single file through the share
 * sheet. That is a browser rule, not a gap to engineer around.
 */

const DB = 'gram-backup';
const STORE = 'handles';
const KEY = 'archive-directory';

type Permission = 'granted' | 'denied' | 'prompt';

type FileHandle = {
  createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
  getFile: () => Promise<{ text: () => Promise<string> }>;
};

type DirHandle = {
  name: string;
  getDirectoryHandle: (name: string, o?: { create?: boolean }) => Promise<DirHandle>;
  getFileHandle: (name: string, o?: { create?: boolean }) => Promise<FileHandle>;
  removeEntry: (name: string, o?: { recursive?: boolean }) => Promise<void>;
  queryPermission: (o: { mode: 'readwrite' }) => Promise<Permission>;
  requestPermission: (o: { mode: 'readwrite' }) => Promise<Permission>;
  values: () => AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
};

const isWeb = Platform.OS === 'web';

export function isDirectoryBackupSupported(): boolean {
  return isWeb && typeof window !== 'undefined' && 'showDirectoryPicker' in window;
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

async function remember(handle: DirHandle | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (handle === null) store.delete(KEY);
    else store.put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function recall(): Promise<DirHandle | null> {
  if (!isWeb || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/** Name of the folder being written to, or null when none has been chosen. */
export async function archiveDirectoryName(): Promise<string | null> {
  const handle = await recall();
  return handle?.name ?? null;
}

export type ChooseDirectoryResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'cancelled' | 'unsupported' | 'denied' | 'error' };

/**
 * Asks where the backup folder should live, and creates `GRam/` inside the answer.
 *
 * Must run from a user gesture.
 */
export async function chooseArchiveDirectory(): Promise<ChooseDirectoryResult> {
  if (!isDirectoryBackupSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const picker = (window as unknown as {
      showDirectoryPicker: (o: unknown) => Promise<DirHandle>;
    }).showDirectoryPicker;

    const parent = await picker({ id: 'gram-backup', mode: 'readwrite', startIn: 'documents' });
    const dir = await parent.getDirectoryHandle(ARCHIVE_DIR, { create: true });
    await remember(dir);
    return { ok: true, name: `${parent.name}/${ARCHIVE_DIR}` };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    if (e instanceof DOMException && e.name === 'NotAllowedError') return { ok: false, reason: 'denied' };
    return { ok: false, reason: 'error' };
  }
}

export async function forgetArchiveDirectory(): Promise<void> {
  if (!isWeb || typeof indexedDB === 'undefined') return;
  try {
    await remember(null);
  } catch {
    // Nothing to undo.
  }
}

async function usable(handle: DirHandle): Promise<boolean> {
  let permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'prompt') permission = await handle.requestPermission({ mode: 'readwrite' });
  return permission === 'granted';
}

/** Walks `a/b/c.json` down from the root, creating directories as needed. */
async function resolveFile(root: DirHandle, path: string, create: boolean): Promise<FileHandle> {
  const parts = path.split('/');
  const name = parts.pop()!;
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  return dir.getFileHandle(name, { create });
}

export type WriteArchiveResult =
  | { ok: true; written: number }
  | { ok: false; reason: 'no-directory' | 'denied' | 'error'; detail?: string };

/**
 * Writes the given files into the folder, and deletes the ones named in `remove`.
 *
 * The manifest is written last, deliberately: until it lands, the folder still describes the
 * previous state, so a write interrupted halfway leaves a readable older backup rather than a
 * manifest promising files that were never written.
 */
export async function writeArchive(
  files: { path: string; text: string }[],
  remove: string[] = [],
): Promise<WriteArchiveResult> {
  const root = await recall();
  if (!root) return { ok: false, reason: 'no-directory' };
  if (!(await usable(root))) return { ok: false, reason: 'denied' };

  const ordered = [...files].sort((a, b) =>
    a.path === 'manifest.json' ? 1 : b.path === 'manifest.json' ? -1 : 0,
  );

  try {
    for (const file of ordered) {
      const handle = await resolveFile(root, file.path, true);
      const writable = await handle.createWritable();
      await writable.write(file.text);
      await writable.close();
    }
    for (const path of remove) {
      const parts = path.split('/');
      const name = parts.pop()!;
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      await dir.removeEntry(name).catch(() => undefined);
    }
    return { ok: true, written: ordered.length };
  } catch (e) {
    return { ok: false, reason: 'error', detail: e instanceof Error ? e.message : undefined };
  }
}

/** Every file in the folder, as path -> text. Recurses one level into `sessions/`. */
export async function readArchiveDirectory(
  handle?: DirHandle | null,
): Promise<ReadonlyMap<string, string> | null> {
  const root = handle ?? (await recall());
  if (!root) return null;
  if (!(await usable(root))) return null;

  const out = new Map<string, string>();
  const walk = async (dir: DirHandle, prefix: string) => {
    for await (const entry of dir.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        await walk(await dir.getDirectoryHandle(entry.name), path);
      } else if (entry.name.endsWith('.json')) {
        const file = await (await dir.getFileHandle(entry.name)).getFile();
        out.set(path, await file.text());
      }
    }
  };

  try {
    await walk(root, '');
    return out;
  } catch {
    return null;
  }
}

/**
 * Opens the picker and reads whatever folder is chosen, without remembering it.
 *
 * Used for importing from a backup that is not the folder this device writes to - restoring
 * onto a new machine, say. Accepts either the `GRam` folder or its parent.
 */
export async function pickAndReadArchive(): Promise<ReadonlyMap<string, string> | null> {
  if (!isDirectoryBackupSupported()) return null;
  try {
    const picker = (window as unknown as {
      showDirectoryPicker: (o: unknown) => Promise<DirHandle>;
    }).showDirectoryPicker;
    let dir = await picker({ id: 'gram-backup', mode: 'read', startIn: 'documents' });

    // Be forgiving about which of the two folders was picked.
    if (dir.name !== ARCHIVE_DIR) {
      const inner = await dir.getDirectoryHandle(ARCHIVE_DIR).catch(() => null);
      if (inner) dir = inner;
    }
    return await readArchiveDirectory(dir);
  } catch {
    return null;
  }
}
