import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useStore } from '@/store/useStore';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SessionScreen = require('../../app/session/[id]').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const PLANK = 'Plank';
const store = () => useStore.getState();

/** Runs the destructive button of the most recent Alert, standing in for a user tap. */
function confirmAlert(label: string) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as { text: string; onPress?: () => void }[];
  const button = buttons.find((b) => b.text === label);
  if (!button?.onPress) throw new Error(`No "${label}" button in the alert`);
  act(() => button.onPress!());
}

function startWorkout(exerciseId = BENCH) {
  let sessionId = '';
  act(() => {
    const planId = store().createPlan('Push day');
    store().addPlanItem(planId, exerciseId);
    sessionId = store().startSession(planId)!;
  });
  mockParams = { id: sessionId };
  return sessionId;
}

beforeEach(() => {
  jest.clearAllMocks();
  act(() => store().resetAll());
  mockParams = {};
});

describe('active workout screen', () => {
  it('renders the plan, its exercise and its three seeded sets', () => {
    const sessionId = startWorkout();
    render(<SessionScreen />);

    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(screen.getByText('0/3 sets recorded')).toBeTruthy();

    const sets = store().sessions.find((s) => s.id === sessionId)!.entries[0].sets;
    for (const set of sets) expect(screen.getByTestId(`log-${set.id}`)).toBeTruthy();
  });

  it('records a set and reflects it in the header count', () => {
    const sessionId = startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.press(screen.getByTestId(`log-${setId}`));

    expect(store().sessions.find((s) => s.id === sessionId)!.entries[0].sets[0].loggedAt).not.toBeNull();
    expect(screen.getByText('1/3 sets recorded')).toBeTruthy();
  });

  it('un-records a set on a second tap', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.press(screen.getByTestId(`log-${setId}`));
    fireEvent.press(screen.getByTestId(`log-${setId}`));

    expect(store().sessions[0].entries[0].sets[0].loggedAt).toBeNull();
    expect(screen.getByText('0/3 sets recorded')).toBeTruthy();
  });

  it('edits weight and reps through the set fields', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.changeText(screen.getByTestId(`set-${setId}-weight`), '82.5');
    fireEvent.changeText(screen.getByTestId(`set-${setId}-reps`), '5');

    expect(store().sessions[0].entries[0].sets[0]).toMatchObject({ weightKg: 82.5, reps: 5 });
  });

  it('rejects non-numeric input rather than storing NaN', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.changeText(screen.getByTestId(`set-${setId}-weight`), 'abc');

    expect(store().sessions[0].entries[0].sets[0].weightKg).toBeUndefined();
  });

  it('clears a field to undefined instead of zero when emptied', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.changeText(screen.getByTestId(`set-${setId}-reps`), '');

    expect(store().sessions[0].entries[0].sets[0].reps).toBeUndefined();
  });

  it('adds a set from the button', () => {
    startWorkout();
    render(<SessionScreen />);

    const entryId = store().sessions[0].entries[0].id;
    fireEvent.press(screen.getByTestId(`add-set-${entryId}`));

    expect(store().sessions[0].entries[0].sets).toHaveLength(4);
    expect(screen.getByText('0/4 sets recorded')).toBeTruthy();
  });

  it('deletes a set from the row', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.press(screen.getByTestId(`del-${setId}`));

    expect(store().sessions[0].entries[0].sets).toHaveLength(2);
    expect(screen.queryByTestId(`log-${setId}`)).toBeNull();
  });

  it('deletes a set that was already recorded', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.press(screen.getByTestId(`log-${setId}`));
    fireEvent.press(screen.getByTestId(`del-${setId}`));

    expect(store().sessions[0].entries[0].sets).toHaveLength(2);
    expect(screen.getByText('0/2 sets recorded')).toBeTruthy();
  });

  it('shows the right fields for a timed exercise and no weight input', () => {
    startWorkout(PLANK);
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    expect(screen.getByTestId(`set-${setId}-time`)).toBeTruthy();
    expect(screen.queryByTestId(`set-${setId}-weight`)).toBeNull();

    fireEvent.changeText(screen.getByTestId(`set-${setId}-time`), '75');
    expect(store().sessions[0].entries[0].sets[0].timeSec).toBe(75);
  });

  it('surfaces the muscles worked as sets are recorded', () => {
    startWorkout();
    render(<SessionScreen />);

    expect(screen.queryByText(/^Chest/)).toBeNull();
    fireEvent.press(screen.getByTestId(`log-${store().sessions[0].entries[0].sets[0].id}`));
    expect(screen.getByText('Chest 1')).toBeTruthy();
    expect(screen.getByText('Triceps 0.5')).toBeTruthy();
  });

  it('starts a rest timer on record but not on un-record', () => {
    startWorkout();
    render(<SessionScreen />);

    const setId = store().sessions[0].entries[0].sets[0].id;
    fireEvent.press(screen.getByTestId(`log-${setId}`));
    expect(screen.getByText(/^Rest /)).toBeTruthy();

    fireEvent.press(screen.getByTestId(`log-${setId}`));
    // Un-recording must not restart the clock; the bar from the first tap is still counting.
    expect(screen.getAllByText(/^Rest /)).toHaveLength(1);
  });

  it('finishes the workout and keeps only recorded sets', () => {
    const sessionId = startWorkout();
    render(<SessionScreen />);

    const sets = store().sessions[0].entries[0].sets;
    fireEvent.press(screen.getByTestId(`log-${sets[0].id}`));
    fireEvent.press(screen.getByTestId(`log-${sets[1].id}`));
    fireEvent.press(screen.getByTestId('finish'));
    confirmAlert('Finish');

    const session = store().sessions.find((s) => s.id === sessionId)!;
    expect(session.endedAt).not.toBeNull();
    expect(session.entries[0].sets).toHaveLength(2);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/history');
  });

  it('offers to discard rather than saving an empty workout', () => {
    const sessionId = startWorkout();
    render(<SessionScreen />);

    fireEvent.press(screen.getByTestId('finish'));
    expect((Alert.alert as jest.Mock).mock.calls.at(-1)![0]).toBe('Nothing recorded');

    confirmAlert('Discard');
    expect(store().sessions.find((s) => s.id === sessionId)).toBeUndefined();
  });

  it('renders an empty state rather than crashing on a missing session', () => {
    mockParams = { id: 'does-not-exist' };
    render(<SessionScreen />);
    expect(screen.getByText('Workout not found')).toBeTruthy();
  });

  it('handles an exercise whose sets have all been deleted', () => {
    startWorkout();
    render(<SessionScreen />);

    for (const set of [...store().sessions[0].entries[0].sets]) {
      fireEvent.press(screen.getByTestId(`del-${set.id}`));
    }
    expect(screen.getByText(/No sets\./)).toBeTruthy();
    expect(screen.getByText('0/0 sets recorded')).toBeTruthy();
  });

  it('navigates to the how-to page for an exercise', () => {
    startWorkout();
    render(<SessionScreen />);

    fireEvent.press(screen.getByText('Barbell Bench Press - Medium Grip'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/exercise/${BENCH}`);
  });
});
