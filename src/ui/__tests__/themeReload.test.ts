/**
 * The note carried across a theme-change reload.
 *
 * Loaded fresh for each case, because the note is read once at import and deleted - that
 * single-use behaviour is the point, and a module imported normally would only ever show the
 * state of the first import in the run.
 */

type Mod = typeof import('@/ui/themeReload');

let mockOS = 'web';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOS;
    },
  },
}));

const KEY = 'gram-theme-reload';

function fakeSession(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    _data: data,
  };
}

/** Boots the module as if the app had just started with this storage. */
function boot(options: { web?: boolean; storage?: unknown }): Mod {
  mockOS = options.web === false ? 'ios' : 'web';
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: options.storage,
    configurable: true,
    writable: true,
  });

  let mod!: Mod;
  jest.isolateModules(() => {
    mod = require('@/ui/themeReload') as Mod;
  });
  return mod;
}

const noteFrom = (storage: ReturnType<typeof fakeSession>) =>
  JSON.parse(storage._data.get(KEY) ?? 'null') as { y: number; at: number } | null;

afterEach(() => {
  mockOS = 'web';
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe('recognising the far side of a theme change', () => {
  it('knows a fresh note means this was a theme reload', () => {
    const storage = fakeSession({ [KEY]: JSON.stringify({ y: 802, at: Date.now() }) });
    const mod = boot({ storage });

    expect(mod.isThemeReload()).toBe(true);
  });

  it('is an ordinary launch when there is no note', () => {
    expect(boot({ storage: fakeSession() }).isThemeReload()).toBe(false);
  });

  it('ignores a note left over from much earlier', () => {
    /*
     * A tab open since yesterday, or a reload that never happened. Restoring a scroll position
     * nobody asked for - and skipping the logo - would be its own small bug.
     */
    const storage = fakeSession({ [KEY]: JSON.stringify({ y: 802, at: Date.now() - 60_000 }) });
    expect(boot({ storage }).isThemeReload()).toBe(false);
  });

  it('ignores a note that is not the shape it should be', () => {
    // Hand-edited, or written by an older build.
    const storage = fakeSession({ [KEY]: '{"y":"lots"}' });
    expect(boot({ storage }).isThemeReload()).toBe(false);
  });

  it('ignores unparseable rubbish rather than throwing before first paint', () => {
    expect(boot({ storage: fakeSession({ [KEY]: 'not json' }) }).isThemeReload()).toBe(false);
  });

  it('deletes the note on read, so it is used exactly once', () => {
    const storage = fakeSession({ [KEY]: JSON.stringify({ y: 802, at: Date.now() }) });
    const first = boot({ storage });

    expect(first.isThemeReload()).toBe(true);
    expect(storage._data.has(KEY)).toBe(false);
    // A later manual refresh is an ordinary launch again: logo shown, no scroll restored.
    expect(boot({ storage }).isThemeReload()).toBe(false);
  });

  it('survives a platform with no session storage', () => {
    const mod = boot({ web: false, storage: fakeSession() });
    expect(mod.isThemeReload()).toBe(false);
    expect(() => mod.markThemeReload()).not.toThrow();
  });

  it('survives storage that throws instead of answering', () => {
    // Private-mode Safari. This runs before the first paint, so a throw here is a blank screen.
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => undefined,
    };
    const mod = boot({ storage: hostile });

    expect(mod.isThemeReload()).toBe(false);
    expect(() => mod.markThemeReload()).not.toThrow();
  });
});

describe('leaving the note', () => {
  it('records where the page was scrolled to', () => {
    const storage = fakeSession();
    const mod = boot({ storage });
    // Stands in for the scroll handler the Profile page feeds it.
    mod.markThemeReload();

    expect(noteFrom(storage)).toMatchObject({ y: 0 });
    expect(typeof noteFrom(storage)?.at).toBe('number');
  });

  it('writes nothing on a platform with no session storage', () => {
    const storage = fakeSession();
    boot({ web: false, storage }).markThemeReload();
    expect(storage._data.has(KEY)).toBe(false);
  });
});
