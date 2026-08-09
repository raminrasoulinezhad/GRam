import { Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useStore } from '@/store/useStore';
import { useThemeSync } from '@/ui/useThemeSync';

/*
 * Reconciling the painted palette with the stored one.
 *
 * The hazard this guards is a boot loop: the hook reloads the app, and a reload that lands back
 * in the same disagreement reloads again, forever, with the user unable to reach any screen.
 * Every test here is really about when it must NOT reload.
 */

const mockRead = jest.fn();
const mockWrite = jest.fn();

jest.mock('@/ui/theme', () => ({
  // `theme.id` is the palette actually on screen, fixed at import in the real module.
  theme: { id: 'midnight' },
  readLaunchTheme: () => mockRead(),
  writeLaunchTheme: (id: string) => mockWrite(id),
}));

/**
 * A component rather than renderHook: renderHook does not flush effects in this setup, and the
 * entire hook is an effect - tested through it, every assertion would have passed vacuously.
 */
function Harness() {
  useThemeSync();
  return null;
}

/** Mounts it and lets the effect actually run - nothing here flushes effects on its own. */
async function mount() {
  await act(async () => {
    render(<Harness />);
  });
}

/** Changes the stored theme on a mounted app, which re-runs the effect. */
async function chooseAgain(themeId: 'midnight' | 'neon' | 'logbook') {
  await act(async () => {
    useStore.getState().updateSettings({ themeId });
  });
}

const reload = jest.fn();
const realOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  useStore.getState().resetAll();

  // The web, because that is where reloading is a thing that happens. Under the default native
  // platform reloadApp returns early and every assertion about it would pass for the wrong
  // reason.
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  Object.defineProperty(globalThis, 'location', {
    value: { reload },
    configurable: true,
    writable: true,
  });

  /*
   * Hydration never completes under test - nothing resolves the persisted read. Left alone,
   * the hook would bail at its first guard and every test here would pass vacuously.
   */
  jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
  delete (globalThis as { location?: unknown }).location;
});

describe('catching the painted palette up with the stored one', () => {
  it('does nothing when they already agree', async () => {
    mockRead.mockReturnValue('midnight');
    await mount();

    expect(mockWrite).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('caches the stored theme when the launch cache disagrees', async () => {
    // The restore-from-backup case: the blob brought a theme across from another device.
    useStore.getState().updateSettings({ themeId: 'logbook' });
    mockRead.mockReturnValue('midnight');
    mockWrite.mockReturnValue(true);

    await mount();

    expect(mockWrite).toHaveBeenCalledWith('logbook');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the write did not stick', async () => {
    /*
     * The loop-maker. A failed write means the next launch reads the same stale value, lands in
     * the same disagreement, and reloads again - so a write that cannot be confirmed must not
     * be followed by a reload, however wrong the colours are.
     */
    useStore.getState().updateSettings({ themeId: 'logbook' });
    mockRead.mockReturnValue('midnight');
    mockWrite.mockReturnValue(false);

    await mount();

    expect(mockWrite).toHaveBeenCalledWith('logbook');
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when the palette on screen is already the right one', async () => {
    // Cache was stale but happened to have painted correctly anyway. Fixing the cache is
    // enough; a reload here would be a visible restart that changed nothing.
    useStore.getState().updateSettings({ themeId: 'midnight' });
    mockRead.mockReturnValue('neon');
    mockWrite.mockReturnValue(true);

    await mount();

    expect(mockWrite).toHaveBeenCalledWith('midnight');
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits for the store to hydrate before believing anything', async () => {
    /*
     * Before hydration the store reports defaults, not the user's choice. Acting then would
     * see a disagreement on every launch for anyone not on the default theme, and reload them
     * every single time they open the app.
     */
    jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(false);
    mockRead.mockReturnValue('logbook');

    await mount();

    expect(mockRead).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('reloads at most once, however many times it re-runs', async () => {
    /*
     * The other half of the loop guard. A reload tears the page down, so a second one fired
     * while the first is in flight is at best a wasted restart and at worst a flicker of
     * repeated reloads. Once it has committed to restarting, it stops acting.
     */
    useStore.getState().updateSettings({ themeId: 'logbook' });
    mockRead.mockReturnValue('midnight');
    mockWrite.mockReturnValue(true);

    await mount();
    await chooseAgain('neon');
    await chooseAgain('logbook');

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
