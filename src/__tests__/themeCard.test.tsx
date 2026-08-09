import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { ThemeCard } from '@/ui/ThemeCard';
import { THEME_ORDER, THEMES } from '@/ui/themes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

/*
 * The picker runs on the platform the test environment reports, which is native - so
 * `writeLaunchTheme` cannot succeed and nothing reloads. That is the right shape for these
 * tests: they are about what gets *stored*, which is the part that has to be true on every
 * platform. The launch-and-reload half is covered in ui/__tests__/theme.test.ts.
 */

const themeId = () => useStore.getState().settings.themeId;

beforeEach(() => {
  useStore.getState().resetAll();
});

describe('choosing how the app looks', () => {
  it('offers every theme, in picker order', async () => {
    await renderScreen(<ThemeCard />);

    for (const id of THEME_ORDER) {
      expect(screen.getByTestId(`theme-${id}`)).toBeTruthy();
      expect(screen.getByText(THEMES[id].name)).toBeTruthy();
    }
  });

  it('marks the stored choice, and only that one', async () => {
    useStore.getState().updateSettings({ themeId: 'blueprint' });
    await renderScreen(<ThemeCard />);

    expect(screen.getByTestId('theme-blueprint-on')).toBeTruthy();
    expect(screen.queryByTestId('theme-carbon-on')).toBeNull();
  });

  it('stores the theme that was tapped', async () => {
    await renderScreen(<ThemeCard />);
    await fireEvent.press(screen.getByTestId('theme-logbook'));

    expect(themeId()).toBe('logbook');
  });

  it('moves the tick to the new choice', async () => {
    await renderScreen(<ThemeCard />);
    await fireEvent.press(screen.getByTestId('theme-neon'));

    expect(screen.getByTestId('theme-neon-on')).toBeTruthy();
    expect(screen.queryByTestId('theme-logbook-on')).toBeNull();
  });

  it('keeps the choice in settings, where a backup will carry it', async () => {
    // Not only in the launch cache: restoring onto a new phone should bring the look back with
    // the training history, and the cache is device-local by design.
    await renderScreen(<ThemeCard />);
    await fireEvent.press(screen.getByTestId('theme-chalk'));

    expect(useStore.getState().settings.themeId).toBe('chalk');
  });

  it('leaves everything else in settings alone', async () => {
    useStore.getState().updateSettings({ unit: 'kg', defaultRestSec: 45 });
    await renderScreen(<ThemeCard />);
    await fireEvent.press(screen.getByTestId('theme-graphite'));

    const settings = useStore.getState().settings;
    expect([settings.unit, settings.defaultRestSec]).toEqual(['kg', 45]);
  });

  it('describes each theme for someone who cannot see the swatch', async () => {
    await renderScreen(<ThemeCard />);
    const row = screen.getByTestId('theme-chalk');

    // Colour is the entire content of this control, so the label has to carry the blurb.
    expect(row.props.accessibilityLabel).toContain('Chalk');
    expect(row.props.accessibilityLabel).toContain(THEMES.chalk.blurb);
  });
});
