import { STORAGE_KEY, backupKey, createBackingStorage } from '@/store/storage';

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
