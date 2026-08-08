import { fireEvent, screen } from '@testing-library/react-native';
import { cancelDialog, confirmDialog, dialogOpen, renderScreen } from '@/test-utils';
import { EXERCISES } from '@/catalog';
import { SCHEMA_VERSION } from '@/store/migrations';
import { useStore } from '@/store/useStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ProfileScreen = require('../../app/(tabs)/profile').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const store = () => useStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('the rest timer setting', () => {
  it('offers three presets and a stepper, not a menu of five', async () => {
    await renderScreen(<ProfileScreen />);
    for (const sec of [45, 60, 90]) expect(screen.getByTestId(`rest-${sec}`)).toBeTruthy();
    expect(screen.queryByTestId('rest-120')).toBeNull();
    expect(screen.queryByTestId('rest-180')).toBeNull();
    expect(screen.getByTestId('rest-seconds')).toBeTruthy();
  });

  it('sets the default from a preset', async () => {
    await renderScreen(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('rest-45'));
    expect(store().settings.defaultRestSec).toBe(45);
  });

  it('retimes plans you have already written', async () => {
    // The whole reason this lives in Profile rather than per plan. A default that only applied
    // to future plans would leave a week of old ones on the old timer with no way to see it.
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    await renderScreen(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('rest-45'));
    expect(store().plans[0].items.every((i) => i.restSec === 45)).toBe(true);
  });

  it('takes a custom length from the stepper', async () => {
    await renderScreen(<ProfileScreen />);
    await fireEvent.changeText(screen.getByTestId('rest-seconds'), '150');
    expect(store().settings.defaultRestSec).toBe(150);
  });

  it('accepts zero, which turns the timer off', async () => {
    await renderScreen(<ProfileScreen />);
    await fireEvent.changeText(screen.getByTestId('rest-seconds'), '0');
    expect(store().settings.defaultRestSec).toBe(0);
  });
});

describe('units', () => {
  it('switches what weights are read in without touching what is stored', async () => {
    // Everything is kept in kilograms. If changing the display unit rewrote the data, a lifter
    // toggling this twice would watch their history drift.
    store().updateProfile({ weightKg: 80 });
    await renderScreen(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('unit-lb'));
    expect(store().settings.unit).toBe('lb');
    expect(store().profile.weightKg).toBe(80);
  });
});

describe('About', () => {
  it('says which build this is and what it holds', async () => {
    await renderScreen(<ProfileScreen />);
    expect(screen.getByTestId('about')).toBeTruthy();
    expect(screen.getByText(`v${SCHEMA_VERSION}`)).toBeTruthy();
    expect(screen.getByText(String(EXERCISES.length))).toBeTruthy();
  });

  it('no longer lists every version this device has run', async () => {
    // Written for one bad week during the app-icon problem; a growing list nobody read after.
    await renderScreen(<ProfileScreen />);
    expect(screen.queryByText('VERSIONS THIS DEVICE HAS RUN')).toBeNull();
  });

  it('no longer reports the phone back to its owner', async () => {
    await renderScreen(<ProfileScreen />);
    expect(screen.queryByText('System')).toBeNull();
  });
});

describe('erasing everything', () => {
  function someHistory() {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const sessionId = store().startSession(planId)!;
    const session = store().sessions.find((s) => s.id === sessionId)!;
    for (const entry of session.entries) {
      for (const set of entry.sets) store().toggleSetLogged(sessionId, entry.id, set.id);
    }
    store().endSession(sessionId);
  }

  it('asks before doing anything', async () => {
    someHistory();
    await renderScreen(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('erase'));
    expect(dialogOpen()).toBe(true);
    expect(store().sessions).toHaveLength(1);
  });

  it('leaves everything alone if you decline', async () => {
    // The one action in the app that cannot be undone, so backing out has to actually back out.
    someHistory();
    await renderScreen(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('erase'));
    await cancelDialog();

    expect(store().plans).toHaveLength(1);
    expect(store().sessions).toHaveLength(1);
  });

  it('erases plans, workouts and the profile on confirmation', async () => {
    someHistory();
    store().updateProfile({ displayName: 'Sam', birthDate: '1990-06-14' });
    await renderScreen(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('erase'));
    await confirmDialog();

    expect(store().plans).toHaveLength(0);
    expect(store().sessions).toHaveLength(0);
    expect(store().profile.displayName).toBe('');
    expect(store().profile.birthDate).toBeNull();
    expect(store().activeSessionId).toBeNull();
  });
});
