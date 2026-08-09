import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { ThemeCard } from '@/ui/ThemeCard';
import { THEME_ORDER, THEMES } from '@/ui/themes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

let mockPickerWasOpen = false;
jest.mock('@/ui/themeReload', () => ({
  wasPickerOpen: () => mockPickerWasOpen,
}));

/*
 * The picker runs on the platform the test environment reports, which is native - so
 * `writeLaunchTheme` cannot succeed and nothing reloads. That is the right shape for these
 * tests: they are about what gets *stored* and what is on screen, which has to hold on every
 * platform. The launch-and-reload half is covered in ui/__tests__/theme.test.ts.
 */

const themeId = () => useStore.getState().settings.themeId;
const open = async () => fireEvent.press(screen.getByTestId('theme-field'));

beforeEach(() => {
  mockPickerWasOpen = false;
  useStore.getState().resetAll();
});

describe('the collapsed theme field', () => {
  it('shows the current theme without opening anything', async () => {
    // The whole point of the change: nine rows were 769px on an 812px phone.
    useStore.getState().updateSettings({ themeId: 'mocha' });
    await renderScreen(<ThemeCard />);

    expect(screen.getByTestId('theme-field')).toBeTruthy();
    expect(screen.getByText('Mocha')).toBeTruthy();
  });

  it('keeps the list out of the page until asked', async () => {
    await renderScreen(<ThemeCard />);

    expect(screen.queryByTestId('theme-sheet')).toBeNull();
    for (const id of THEME_ORDER) expect(screen.queryByTestId(`theme-${id}`)).toBeNull();
  });

  it('names the current theme for a screen reader', async () => {
    await renderScreen(<ThemeCard />);
    const field = screen.getByTestId('theme-field');

    expect(field.props.accessibilityLabel).toContain('Midnight');
    expect(field.props.accessibilityLabel).toContain(THEMES.midnight.blurb);
  });
});

describe('choosing how the app looks', () => {
  it('opens a sheet with every theme, in picker order', async () => {
    await renderScreen(<ThemeCard />);
    await open();

    expect(screen.getByTestId('theme-sheet')).toBeTruthy();
    for (const id of THEME_ORDER) {
      const row = screen.getByTestId(`theme-${id}`);
      // Scoped to the row: the current theme's name is also on the field behind the sheet.
      expect([id, within(row).queryByText(THEMES[id].name) !== null]).toEqual([id, true]);
    }
  });

  it('marks the stored choice, and only that one', async () => {
    useStore.getState().updateSettings({ themeId: 'lemon' });
    await renderScreen(<ThemeCard />);
    await open();

    expect(screen.getByTestId('theme-lemon-on')).toBeTruthy();
    expect(screen.queryByTestId('theme-midnight-on')).toBeNull();
  });

  it('stores the theme that was tapped', async () => {
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-logbook'));

    expect(themeId()).toBe('logbook');
  });

  it('applies on tap, with no Done button to press', async () => {
    // Deliberate: this is a choice you make by looking at it, and confirming something
    // instantly reversible is a tax on trying the next one.
    await renderScreen(<ThemeCard />);
    await open();

    expect(screen.queryByTestId('theme-sheet-done')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('closes the sheet once a theme is chosen', async () => {
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-canadian'));

    expect(screen.queryByTestId('theme-sheet')).toBeNull();
  });

  it('shows the new choice on the field afterwards', async () => {
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-canadian'));

    expect(screen.getByText('Canadian')).toBeTruthy();
  });

  it('moves the tick when the sheet is opened again', async () => {
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-neon'));
    await open();

    expect(screen.getByTestId('theme-neon-on')).toBeTruthy();
    expect(screen.queryByTestId('theme-midnight-on')).toBeNull();
  });

  it('closes without changing anything', async () => {
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-close'));

    expect(screen.queryByTestId('theme-sheet')).toBeNull();
    expect(themeId()).toBe('midnight');
  });

  it('keeps the choice in settings, where a backup will carry it', async () => {
    // Not only in the launch cache: restoring onto a new phone should bring the look back with
    // the training history, and the cache is device-local by design.
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-chalk'));

    expect(useStore.getState().settings.themeId).toBe('chalk');
  });

  it('leaves everything else in settings alone', async () => {
    useStore.getState().updateSettings({ unit: 'kg', defaultRestSec: 45 });
    await renderScreen(<ThemeCard />);
    await open();
    await fireEvent.press(screen.getByTestId('theme-graphite'));

    const settings = useStore.getState().settings;
    expect([settings.unit, settings.defaultRestSec]).toEqual(['kg', 45]);
  });

  it('describes each theme for someone who cannot see the swatch', async () => {
    await renderScreen(<ThemeCard />);
    await open();
    const row = screen.getByTestId('theme-chalk');

    // Colour is the entire content of this control, so the label has to carry the blurb.
    expect(row.props.accessibilityLabel).toContain('Chalk');
    expect(row.props.accessibilityLabel).toContain(THEMES.chalk.blurb);
  });
});

describe('after a theme change has reloaded the app', () => {
  it('comes back with the picker open, so the next colour is one tap', async () => {
    /*
     * Applying on tap means every colour tried costs a restart. Without this, seeing a second
     * one costs scrolling back, opening the field and tapping again - which turns browsing
     * nine palettes into a chore.
     */
    mockPickerWasOpen = true;
    await renderScreen(<ThemeCard />);

    expect(screen.getByTestId('theme-sheet')).toBeTruthy();
  });

  it('stays closed on an ordinary visit', async () => {
    mockPickerWasOpen = false;
    await renderScreen(<ThemeCard />);

    expect(screen.queryByTestId('theme-sheet')).toBeNull();
  });
});
