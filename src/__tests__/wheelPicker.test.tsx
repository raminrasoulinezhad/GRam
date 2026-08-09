import { fireEvent, screen } from '@testing-library/react-native';
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

describe('the wheel', () => {
  it('opens on the stored value rather than at the top of the list', async () => {
    // The whole reason this is not a ScrollView. Someone 180cm tall should not be shown 120.
    await show(45);
    expect(screen.getByText('45')).toBeTruthy();
    // Row 30 is fifteen rows away and outside the drawn window.
    expect(screen.queryByText('30')).toBeNull();
  });

  it('opens on the nearest row when the value is between two', async () => {
    // Weight is stored in kilograms and shown in pounds, so the stored number is often not on
    // the wheel at all.
    await show(45.4);
    expect(screen.getByText('45')).toBeTruthy();
  });

  it('shows the neighbours, which are how you judge which way to drag', async () => {
    await show(45);
    for (const v of ['43', '44', '45', '46', '47']) expect(screen.getByText(v)).toBeTruthy();
  });

  it('draws a window rather than every row', async () => {
    // 441 mounted rows would be re-laid-out on every frame of a drag.
    await show(150, range(30, 250, 0.5));
    expect(screen.queryByText('30')).toBeNull();
    expect(screen.queryByText('250')).toBeNull();
  });

  it('steps down one row and reports it', async () => {
    await show(45);
    await fireEvent.press(screen.getByTestId('wheel-down'));
    expect(onChange).toHaveBeenCalledWith(46);
  });

  it('steps up one row and reports it', async () => {
    await show(45);
    await fireEvent.press(screen.getByTestId('wheel-up'));
    expect(onChange).toHaveBeenCalledWith(44);
  });

  it('will not step past the start of the list', async () => {
    await show(30);
    expect(screen.getByTestId('wheel-up').props.accessibilityState.disabled).toBe(true);
  });

  it('will not step past the end', async () => {
    await show(60);
    expect(screen.getByTestId('wheel-down').props.accessibilityState.disabled).toBe(true);
  });

  it('shows its unit', async () => {
    await show(45);
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('formats values when asked', async () => {
    await renderScreen(
      <WheelPicker values={[1, 2, 3]} value={2} onChange={onChange} format={(v) => `${v} reps`} testID="wheel" />,
    );
    expect(screen.getByText('2 reps')).toBeTruthy();
  });

  it('opens at the first row when nothing is set', async () => {
    await show(null);
    expect(screen.getByText('30')).toBeTruthy();
  });
});
