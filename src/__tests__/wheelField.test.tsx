import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { range } from '@/lib/wheel';
import { WheelField } from '@/ui/WheelField';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const onChange = jest.fn();
const VALUES = range(30, 60, 1);

const show = (value: number | null) =>
  renderScreen(
    <WheelField
      value={value}
      values={VALUES}
      onChange={onChange}
      suffix="kg"
      title="Weight"
      testID="w"
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe('a field that opens a wheel', () => {
  it('states the current value on the page', async () => {
    // The wheel opens on its first row rather than on the value, so this line is the only
    // place the real setting is visible without scrolling. It is not decoration.
    await show(45);
    expect(screen.getByText('45 kg')).toBeTruthy();
  });

  it('says when nothing is set', async () => {
    await show(null);
    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('stays closed until tapped', async () => {
    await show(45);
    expect(screen.queryByTestId('w-sheet')).toBeNull();
  });

  it('opens a sheet with the wheel in it', async () => {
    await show(45);
    await fireEvent.press(screen.getByTestId('w'));
    expect(screen.getByTestId('w-sheet')).toBeTruthy();
    expect(screen.getByText('Weight')).toBeTruthy();
  });

  it('commits only on Done', async () => {
    // Writing as the wheel turns would push a store update per frame of a drag, and would
    // rewrite a recorded set several dozen times on the way past.
    await show(45);
    await fireEvent.press(screen.getByTestId('w'));
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('w-done'));
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it('changes nothing when closed without choosing', async () => {
    await show(45);
    await fireEvent.press(screen.getByTestId('w'));
    await fireEvent.press(screen.getByTestId('w-close'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('w-sheet')).toBeNull();
  });

  it('closes after Done', async () => {
    await show(45);
    await fireEvent.press(screen.getByTestId('w'));
    await fireEvent.press(screen.getByTestId('w-done'));
    expect(screen.queryByTestId('w-sheet')).toBeNull();
  });

  it('formats the value on the field the same way as on the wheel', async () => {
    await renderScreen(
      <WheelField
        value={90}
        values={[60, 90, 120]}
        onChange={onChange}
        format={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`}
        title="Rest"
        testID="w"
      />,
    );
    expect(screen.getByText('1:30')).toBeTruthy();
  });
});
