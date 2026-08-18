import { SCHEMA_VERSION } from '@/store/migrations';
import {
  STORAGE_KEY,
  allBackupKeys,
  backupKey,
  clearPreMigrationBackups,
  createBackingStorage,
} from '@/store/storage';

/** Minimal in-memory stand-in for AsyncStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: jest.fn(async (k: string) => data[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      data[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete data[k];
    }),
  };
}

const blob = (version: number, state: unknown = { plans: [{ id: 'p1' }] }) =>
  JSON.stringify({ state, version });

describe('backing storage', () => {
  it('returns null for a fresh install without writing anything', async () => {
    const fake = fakeStorage();
    const storage = createBackingStorage(2, fake);

    expect(await storage.getItem(STORAGE_KEY)).toBeNull();
    expect(fake.setItem).not.toHaveBeenCalled();
  });

  it('backs up the old blob verbatim before an upgrade reads it', async () => {
    const old = blob(1);
    const fake = fakeStorage({ [STORAGE_KEY]: old });
    const storage = createBackingStorage(2, fake);

    const returned = await storage.getItem(STORAGE_KEY);

    // The caller still gets the original, untouched.
    expect(returned).toBe(old);
    expect(fake.data[backupKey(1)]).toBe(old);
  });

  it('does not overwrite an existing backup, so the pristine copy survives', async () => {
    const pristine = blob(1, { plans: [{ id: 'original' }] });
    const fake = fakeStorage({
      [STORAGE_KEY]: blob(1, { plans: [{ id: 'later' }] }),
      [backupKey(1)]: pristine,
    });
    const storage = createBackingStorage(2, fake);

    await storage.getItem(STORAGE_KEY);
    expect(fake.data[backupKey(1)]).toBe(pristine);
  });

  it('writes no backup when the version already matches', async () => {
    const fake = fakeStorage({ [STORAGE_KEY]: blob(2) });
    const storage = createBackingStorage(2, fake);

    await storage.getItem(STORAGE_KEY);
    expect(fake.data[backupKey(2)]).toBeUndefined();
    expect(fake.setItem).not.toHaveBeenCalled();
  });

  it('treats a blob with no version as v0 and backs it up', async () => {
    const raw = JSON.stringify({ state: { plans: [] } });
    const fake = fakeStorage({ [STORAGE_KEY]: raw });
    const storage = createBackingStorage(2, fake);

    await storage.getItem(STORAGE_KEY);
    expect(fake.data[backupKey(0)]).toBe(raw);
  });

  it('keeps unparseable data instead of discarding the evidence', async () => {
    const corrupt = '{ this is not json';
    const fake = fakeStorage({ [STORAGE_KEY]: corrupt });
    const storage = createBackingStorage(2, fake);

    const returned = await storage.getItem(STORAGE_KEY);

    expect(returned).toBe(corrupt);
    expect(fake.data[backupKey(-1)]).toBe(corrupt);
  });

  it('never throws on a read, whatever is in storage', async () => {
    for (const value of ['', 'null', '[]', '{}', 'undefined']) {
      const fake = fakeStorage({ [STORAGE_KEY]: value });
      const storage = createBackingStorage(2, fake);
      await expect(storage.getItem(STORAGE_KEY)).resolves.toBe(value);
    }
  });

  it('passes writes and deletes straight through', async () => {
    const fake = fakeStorage();
    const storage = createBackingStorage(2, fake);

    await storage.setItem(STORAGE_KEY, blob(2));
    expect(fake.data[STORAGE_KEY]).toBe(blob(2));

    await storage.removeItem(STORAGE_KEY);
    expect(fake.data[STORAGE_KEY]).toBeUndefined();
  });
});

/**
 * What happens when the device says no.
 *
 * A home-screen web app on iOS gets a few megabytes for everything, and this app keeps the live
 * blob and its pre-migration copies in the same budget. Running out is not exotic, and both
 * halves of it lose data silently unless handled: a failed write is a workout that never
 * reached disk, and a failed read is an app that opens blank with the training still on disk
 * behind it.
 */
describe('storage that is full', () => {
  /** Refuses writes to anything but the keys named. */
  function tightStorage(initial: Record<string, string>, writable: string[] = []) {
    const fake = fakeStorage(initial);
    fake.setItem.mockImplementation(async (k: string, v: string) => {
      if (!writable.includes(k)) throw new Error('QuotaExceededError');
      fake.data[k] = v;
    });
    return fake;
  }

  it('still loads when there is no room to take a safety copy', async () => {
    /*
     * The one that would hurt most. Rehydration failing hands zustand its initial state, so
     * the user opens an empty app - total data loss, caused by the code whose whole job is to
     * prevent total data loss.
     */
    const old = blob(1);
    const fake = tightStorage({ [STORAGE_KEY]: old });
    const storage = createBackingStorage(7, fake);

    await expect(storage.getItem(STORAGE_KEY)).resolves.toBe(old);
  });

  it('still loads when the blob is corrupt and cannot be copied either', async () => {
    const fake = tightStorage({ [STORAGE_KEY]: 'not json at all' });
    const storage = createBackingStorage(7, fake);

    await expect(storage.getItem(STORAGE_KEY)).resolves.toBe('not json at all');
  });

  it('drops the safety copies to make room for the training', async () => {
    // The right order of sacrifice: the copies insure against a bad migration, which is a
    // risk; the blob is this week's sets, which is a certainty.
    const fake = fakeStorage({ [backupKey(5)]: 'old copy', [backupKey(6)]: 'newer copy' });
    let full = true;
    fake.setItem.mockImplementation(async (k: string, v: string) => {
      if (full && k === STORAGE_KEY) throw new Error('QuotaExceededError');
      fake.data[k] = v;
    });
    fake.removeItem.mockImplementation(async (k: string) => {
      delete fake.data[k];
      full = false;
    });

    const storage = createBackingStorage(7, fake);
    await storage.setItem(STORAGE_KEY, 'the new blob');

    expect(fake.data[STORAGE_KEY]).toBe('the new blob');
    expect(fake.data[backupKey(5)]).toBeUndefined();
    expect(fake.data[backupKey(6)]).toBeUndefined();
  });

  it('reports a write that still will not go, rather than pretending it did', async () => {
    // Nothing left to drop. The caller has to hear about it; swallowing this is the app
    // telling someone their workout is saved when it is not.
    const fake = tightStorage({});
    const storage = createBackingStorage(7, fake);

    await expect(storage.setItem(STORAGE_KEY, 'blob')).rejects.toThrow();
  });
});

describe('erasing the safety copies', () => {
  it('removes every version a copy could be under, including the unparseable one', async () => {
    const fake = fakeStorage({
      [backupKey(-1)]: 'corrupt copy',
      [backupKey(0)]: 'v0 copy',
      [backupKey(6)]: 'v6 copy',
      'something-else': 'not ours',
    });

    await clearPreMigrationBackups(7, fake);

    expect(fake.data[backupKey(-1)]).toBeUndefined();
    expect(fake.data[backupKey(0)]).toBeUndefined();
    expect(fake.data[backupKey(6)]).toBeUndefined();
    expect(fake.data['something-else']).toBe('not ours');
  });

  it('does not fail when storage refuses to delete', async () => {
    // Called from an erase that has already happened. Throwing here would report a failure for
    // something that did work.
    const fake = fakeStorage({ [backupKey(6)]: 'copy' });
    fake.removeItem.mockRejectedValue(new Error('nope'));

    await expect(clearPreMigrationBackups(7, fake)).resolves.toBeUndefined();
  });

  it('covers every schema version there has ever been', () => {
    const keys = allBackupKeys(SCHEMA_VERSION);
    expect(keys).toContain(backupKey(-1));
    for (let v = 0; v <= SCHEMA_VERSION; v++) expect(keys).toContain(backupKey(v));
  });
});
