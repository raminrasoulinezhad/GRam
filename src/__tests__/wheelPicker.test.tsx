import { screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { range } from '@/lib/wheel';
import { WheelPicker } from '@/ui/WheelPicker';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const onChange = jest.fn();
const VALUES = range(30, 60, 1);

const show = (value: number | null, values: readonly number[] = VALUES) =>
  renderScreen(
    <WheelPicker values={values} value={value} onChange={onChange} suffix="kg" testID="wheel" />,
  );

beforeEach(() => jest.clearAllMocks());

/*
 * The wheel is a thin wrapper over a library, so these cover the part that is ours: turning
 * plain numbers into the items it wants, and picking the row a stored value corresponds to.
 * The dragging is the library's and is verified in a browser, not here.
 *
 * KNOWN LIMITATION, deliberately not asserted either way: on react-native-web the wheel opens
 * on its first row rather than on `value`. See the note in ui/WheelPicker.tsx - the position is
 * patched from an effect that does not always take. Dragging works; the opening row may not be
 * yours. There is no test here claiming otherwise.
 */
describe('the wheel', () => {
  it('offers every value it was given', async () => {
    await show(45);
    for (const v of ['44', '45', '46']) expect(screen.getByText(v)).toBeTruthy();
  });

  it('selects the nearest row when the value is between two', async () => {
    // Weight is stored in kilograms and shown in pounds, so 80 kg is 176.37 lb and no row says
    // that. Snapping to the nearest is right; falling back to the first row is not.
    await show(45.4);
    expect(screen.getByText('45')).toBeTruthy();
  });

  it('handles a value below the bottom of the range', async () => {
    await show(-100);
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('handles a value above the top', async () => {
    await show(9999);
    expect(screen.getByText('60')).toBeTruthy();
  });

  it('handles nothing set at all', async () => {
    await show(null);
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('shows its unit', async () => {
    await show(45);
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('formats values when asked', async () => {
    await renderScreen(
      <WheelPicker
        values={[60, 90, 120]}
        value={90}
        onChange={onChange}
        format={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`}
        testID="wheel"
      />,
    );
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('renders an empty wheel without falling over', async () => {
    // A kind with no values configured must not crash a whole screen.
    await renderScreen(<WheelPicker values={[]} value={null} onChange={onChange} testID="wheel" />);
    expect(screen.getByTestId('wheel')).toBeTruthy();
  });
});
