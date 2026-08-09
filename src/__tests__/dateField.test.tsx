import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { DateField } from '@/ui/DateField';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const onChange = jest.fn();
const open = async (value: string | null = null) => {
  await renderScreen(<DateField value={value} onChange={onChange} testID="dob" />);
  await fireEvent.press(screen.getByTestId('dob'));
};

beforeEach(() => jest.clearAllMocks());

describe('picking a date of birth', () => {
  it('shows the date in words rather than as a stored string', async () => {
    await renderScreen(<DateField value="1990-06-14" onChange={onChange} testID="dob" />);
    expect(screen.getByText('14 June 1990')).toBeTruthy();
  });

  it('says when nothing is set', async () => {
    await renderScreen(<DateField value={null} onChange={onChange} testID="dob" />);
    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('walks year, then month, then day', async () => {
    await open();
    expect(screen.getByText('Which year?')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('year-1990'));
    expect(screen.getByText('Which month?')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('month-6'));
    expect(screen.getByText('Which day?')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('day-14'));
    expect(onChange).toHaveBeenCalledWith('1990-06-14');
  });

  it('shows what has been chosen so far', async () => {
    // Three separate screens would feel like three unrelated questions without this.
    await open();
    await fireEvent.press(screen.getByTestId('year-1990'));
    expect(screen.getByTestId('date-crumb')).toHaveTextContent('1990');
    await fireEvent.press(screen.getByTestId('month-6'));
    expect(screen.getByTestId('date-crumb')).toHaveTextContent('1990 · Jun');
  });

  it('lets you go back and change the year', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('year-1990'));
    await fireEvent.press(screen.getByTestId('date-back'));
    expect(screen.getByText('Which year?')).toBeTruthy();
  });

  it('offers only the days that month has', async () => {
    // 1990 rather than a recent year: the list starts thirteen years back, so this year is not
    // an option at all - which is itself asserted below.
    await open();
    await fireEvent.press(screen.getByTestId('year-1990'));
    await fireEvent.press(screen.getByTestId('month-2'));

    expect(screen.getByTestId('day-28')).toBeTruthy();
    expect(screen.queryByTestId('day-29')).toBeNull();
    expect(screen.queryByTestId('day-31')).toBeNull();
  });

  it('offers 29 February in a leap year', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('year-2000'));
    await fireEvent.press(screen.getByTestId('month-2'));
    expect(screen.getByTestId('day-29')).toBeTruthy();
  });

  it('does not offer being born this year', async () => {
    // The list starts at thirteen years old; the current year is not an option at all.
    await open();
    expect(screen.queryByTestId(`year-${new Date().getFullYear()}`)).toBeNull();
  });

  it('reopens on the day step when a date is already set', async () => {
    // Correcting the day should be one tap, not three.
    await open('1990-06-14');
    expect(screen.getByText('Which day?')).toBeTruthy();
    expect(screen.getByTestId('date-crumb')).toHaveTextContent('1990 · Jun');
  });

  it('can clear a date that was set', async () => {
    await open('1990-06-14');
    await fireEvent.press(screen.getByTestId('date-clear'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('offers no clear button when there is nothing to clear', async () => {
    await open();
    expect(screen.queryByTestId('date-clear')).toBeNull();
  });

  it('changes nothing if you close without finishing', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('year-1990'));
    await fireEvent.press(screen.getByTestId('date-close'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
