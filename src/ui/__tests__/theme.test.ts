import { DEFAULT_THEME, THEMES } from '@/ui/themes';

/**
 * The launch path: how a chosen theme reaches the stylesheets.
 *
 * These load `@/ui/theme` afresh each time, because the whole mechanism *is* what happens at
 * import - the palette is resolved once, before any StyleSheet.create downstream runs, and it
 * cannot be re-read afterwards. A test that imported the module normally would only ever see
 * the state of the very first import in the run.
 */

type ThemeModule = typeof import('@/ui/theme');

/*
 * Platform, and only Platform - it is all theme.ts takes from react-native.
 *
 * Setting `Platform.OS` on the real module does not survive here: react-native re-exports it
 * through a getter that re-requires on every access, so once jest.isolateModules restores the
 * registry the flag reverts and calls made after launch see the original platform. A getter
 * over a variable this file owns is read the same way at every point in the test.
 */
let mockOS = 'web';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOS;
    },
  },
}));

/** A localStorage stand-in; the test environment is node and has none. */
function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    _data: data,
  };
}

/** Imports theme.ts as if the app had just started on the given platform and storage. */
function launch(options: { web?: boolean; storage?: unknown }): ThemeModule {
  mockOS = options.web === false ? 'ios' : 'web';
  // Left installed on purpose: readLaunchTheme and writeLaunchTheme are called *after* launch
  // returns, and they go looking for it again each time. Torn down in afterEach.
  Object.defineProperty(globalThis, 'localStorage', {
    value: options.storage,
    configurable: true,
    writable: true,
  });

  let mod!: ThemeModule;
  jest.isolateModules(() => {
    mod = require('@/ui/theme') as ThemeModule;
  });

  return mod;
}

afterEach(() => {
  mockOS = 'web';
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('the palette the app paints with', () => {
  it('is the one cached at launch', () => {
    const { theme } = launch({ storage: fakeStorage({ 'gram-theme': 'logbook' }) });

    expect(theme.id).toBe('logbook');
    expect(theme.color.bg).toBe(THEMES.logbook.colors.bg);
    expect(theme.color.accent).toBe(THEMES.logbook.colors.accent);
    // Light themes have to be knowable without comparing colours: the status bar reads this.
    expect(theme.light).toBe(true);
  });

  it('is the default when nothing has been chosen', () => {
    const { theme } = launch({ storage: fakeStorage() });
    expect(theme.id).toBe(DEFAULT_THEME);
  });

  it('is the default when the cache holds something unrecognisable', () => {
    // A hand-edited key, or a theme that existed in an older build and has since been cut.
    const { theme } = launch({ storage: fakeStorage({ 'gram-theme': 'ember' }) });
    expect(theme.id).toBe(DEFAULT_THEME);
  });

  it('survives storage that throws instead of answering', () => {
    // Safari in private mode does this rather than returning null, and it happens before the
    // first paint - an unguarded throw here is a white screen, not a wrong colour.
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    const mod = launch({ storage: hostile });

    expect(mod.theme.id).toBe(DEFAULT_THEME);
    expect(mod.writeLaunchTheme('neon')).toBe(false);
  });

  it('falls back to the default on a platform with no synchronous storage', () => {
    // Native. There is nothing to read before paint, so the choice cannot be honoured there.
    const mod = launch({ web: false, storage: fakeStorage({ 'gram-theme': 'logbook' }) });

    expect(mod.theme.id).toBe(DEFAULT_THEME);
    expect(mod.themeAppliesImmediately).toBe(false);
    expect(mod.writeLaunchTheme('neon')).toBe(false);
  });
});

describe('caching a choice for the next launch', () => {
  it('writes the id and reports that it stuck', () => {
    const storage = fakeStorage();
    const mod = launch({ storage });

    expect(mod.writeLaunchTheme('mocha')).toBe(true);
    expect(storage._data.get('gram-theme')).toBe('mocha');
    expect(mod.readLaunchTheme()).toBe('mocha');
  });

  it('reports failure when the write silently does not take', () => {
    /*
     * A full quota accepts setItem and then has nothing to give back. The return value is what
     * stops useThemeSync reloading: reloading into a palette that was never saved lands right
     * back here and does it again, forever.
     */
    const amnesiac = { getItem: () => null, setItem: () => undefined };
    const mod = launch({ storage: amnesiac });

    expect(mod.writeLaunchTheme('mocha')).toBe(false);
  });

  it('does not paint the new choice until the next launch', () => {
    const storage = fakeStorage({ 'gram-theme': 'carbon' });
    const mod = launch({ storage });
    mod.writeLaunchTheme('logbook');

    // Still Carbon: the stylesheets were built at import and a write cannot reach them. This is
    // exactly why choosing a theme reloads the app.
    expect(mod.theme.id).toBe('carbon');
    expect(mod.theme.color.bg).toBe(THEMES.carbon.colors.bg);

    // And the next launch does pick it up.
    expect(launch({ storage }).theme.id).toBe('logbook');
  });
});

describe('the heatmap ramp', () => {
  it('reads from whichever palette launched', () => {
    const { rampColor, rampIntensity } = launch({
      storage: fakeStorage({ 'gram-theme': 'neon' }),
    });

    // Zero is "untouched" and must be the inert first stop, not the coldest live colour.
    expect(rampColor(0, 20)).toBe(THEMES.neon.colors.ramp[0]);
    expect(rampIntensity(0, 20)).toBe(1);
    expect(rampColor(20, 20)).toBe(THEMES.neon.colors.ramp[5]);
  });
});
