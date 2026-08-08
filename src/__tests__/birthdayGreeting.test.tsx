import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { BirthdayGreeting } from '@/ui/BirthdayGreeting';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const store = () => useStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('the birthday greeting', () => {
  const today = () => {
    const now = new Date();
    return `1990-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  it('says nothing when no date of birth has been given', async () => {
    // It is an optional field, and most people will never fill it in.
    await renderScreen(<BirthdayGreeting />);
    expect(screen.queryByTestId('birthday-greeting')).toBeNull();
  });

  it('says nothing on any other day', async () => {
    store().updateProfile({ birthDate: '1990-01-01', displayName: 'Sam' });
    const notToday = new Date();
    notToday.setMonth(0);
    notToday.setDate(1);
    // Only assert when today genuinely is not 1 January, or the test would contradict itself.
    if (notToday.toDateString() !== new Date().toDateString()) {
      await renderScreen(<BirthdayGreeting />);
      expect(screen.queryByTestId('birthday-greeting')).toBeNull();
    }
  });

  it('greets you by name on the day', async () => {
    store().updateProfile({ birthDate: today(), displayName: 'Sam' });
    await renderScreen(<BirthdayGreeting />);
    expect(screen.getByText('Happy birthday, Sam!')).toBeTruthy();
  });

  it('greets you without a name when none is set', async () => {
    // displayName is optional too, and "Happy birthday, !" would be worse than no name.
    store().updateProfile({ birthDate: today(), displayName: '' });
    await renderScreen(<BirthdayGreeting />);
    expect(screen.getByText('Happy birthday!')).toBeTruthy();
  });

  it('ignores a name that is only spaces', async () => {
    store().updateProfile({ birthDate: today(), displayName: '   ' });
    await renderScreen(<BirthdayGreeting />);
    expect(screen.getByText('Happy birthday!')).toBeTruthy();
  });

  it('says how old you are today', async () => {
    store().updateProfile({ birthDate: today(), displayName: 'Sam' });
    await renderScreen(<BirthdayGreeting />);
    const age = new Date().getFullYear() - 1990;
    expect(screen.getByText(`${age} today. Have a good one.`)).toBeTruthy();
  });

  it('can be dismissed', async () => {
    store().updateProfile({ birthDate: today(), displayName: 'Sam' });
    await renderScreen(<BirthdayGreeting />);
    await fireEvent.press(screen.getByTestId('birthday-dismiss'));
    expect(screen.queryByTestId('birthday-greeting')).toBeNull();
  });
});
