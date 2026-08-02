import { fireEvent, screen } from '@testing-library/react-native';
import { cancelDialog, confirmDialog, dialogOpen, renderScreen } from '@/test-utils';
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

/** Seeds a plan with one exercise, starts it, and points the route params at the session. */
function startWorkout(exerciseId = BENCH) {
  let sessionId = '';
  const s = store();
  const planId = s.createPlan('monday');
  s.addPlanItem(planId, exerciseId);
  sessionId = s.startSession(planId)!;
  mockParams = { id: sessionId };
  return sessionId;
}

const setIds = () => store().sessions[0].entries[0].sets.map((x) => x.id);
const entryId = () => store().sessions[0].entries[0].id;

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  mockParams = {};
});

describe('active workout screen', () => {
  it('renders the plan, its exercise and its three seeded sets', async () => {
    const sessionId = startWorkout();
    await renderScreen(<SessionScreen />);

    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();

    const sets = store().sessions.find((s) => s.id === sessionId)!.entries[0].sets;
    for (const set of sets) expect(screen.getByTestId(`log-${set.id}`)).toBeTruthy();
  });

  it('records a set and reflects it in the header count', async () => {
    const sessionId = startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`log-${setIds()[0]}`));

    const session = store().sessions.find((s) => s.id === sessionId)!;
    expect(session.entries[0].sets[0].loggedAt).not.toBeNull();
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('un-records a set on a second tap', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.press(screen.getByTestId(`log-${setId}`));
    await fireEvent.press(screen.getByTestId(`log-${setId}`));

    expect(store().sessions[0].entries[0].sets[0].loggedAt).toBeNull();
    expect(screen.getByText('0/3')).toBeTruthy();
  });

  it('edits weight and reps through the set fields', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.changeText(screen.getByTestId(`set-${setId}-weight`), '82.5');
    await fireEvent.changeText(screen.getByTestId(`set-${setId}-reps`), '5');

    expect(store().sessions[0].entries[0].sets[0]).toMatchObject({ weightKg: 82.5, reps: 5 });
  });

  it('rejects non-numeric input rather than storing NaN', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.changeText(screen.getByTestId(`set-${setIds()[0]}-weight`), 'abc');

    expect(store().sessions[0].entries[0].sets[0].weightKg).toBeUndefined();
  });

  it('clears a field to undefined instead of zero when emptied', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.changeText(screen.getByTestId(`set-${setIds()[0]}-reps`), '');

    expect(store().sessions[0].entries[0].sets[0].reps).toBeUndefined();
  });

  it('adds a set from the button', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const entryId = store().sessions[0].entries[0].id;
    await fireEvent.press(screen.getByTestId(`add-set-${entryId}`));

    expect(store().sessions[0].entries[0].sets).toHaveLength(4);
    expect(screen.getByText('0/4')).toBeTruthy();
  });

  it('deletes a set from the row', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.press(screen.getByTestId(`del-${setId}`));

    expect(store().sessions[0].entries[0].sets).toHaveLength(2);
    expect(screen.queryByTestId(`log-${setId}`)).toBeNull();
  });

  it('deletes a set that was already recorded', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.press(screen.getByTestId(`log-${setId}`));
    await fireEvent.press(screen.getByTestId(`del-${setId}`));

    expect(store().sessions[0].entries[0].sets).toHaveLength(2);
    expect(screen.getByText('0/2')).toBeTruthy();
  });

  it('shows the right fields for a timed exercise and no weight input', async () => {
    startWorkout(PLANK);
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    expect(screen.getByTestId(`set-${setId}-time`)).toBeTruthy();
    expect(screen.queryByTestId(`set-${setId}-weight`)).toBeNull();

    await fireEvent.changeText(screen.getByTestId(`set-${setId}-time`), '75');
    expect(store().sessions[0].entries[0].sets[0].timeSec).toBe(75);
  });

  it('surfaces the muscles worked as sets are recorded', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    expect(screen.queryByText(/^Chest/)).toBeNull();
    await fireEvent.press(screen.getByTestId(`log-${setIds()[0]}`));

    expect(screen.getByText('Chest 1')).toBeTruthy();
    expect(screen.getByText('Triceps 0.5')).toBeTruthy();
  });

  it('starts a rest timer on record but not on un-record', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.press(screen.getByTestId(`log-${setId}`));
    expect(screen.getByText(/^Rest /)).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`log-${setId}`));
    // Un-recording must not restart the clock; only the bar from the first tap is present.
    expect(screen.getAllByText(/^Rest /)).toHaveLength(1);
  });

  it('finishes the workout and keeps only recorded sets', async () => {
    const sessionId = startWorkout();
    await renderScreen(<SessionScreen />);

    const [a, b] = setIds();
    await fireEvent.press(screen.getByTestId(`log-${a}`));
    await fireEvent.press(screen.getByTestId(`log-${b}`));
    await fireEvent.press(screen.getByTestId('finish'));
    expect(screen.getByText('2 recorded sets will be saved.')).toBeTruthy();
    await confirmDialog();

    const session = store().sessions.find((s) => s.id === sessionId)!;
    expect(session.endedAt).not.toBeNull();
    expect(session.entries[0].sets).toHaveLength(2);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/history');
  });

  it('cancelling the finish dialog leaves the workout running', async () => {
    const sessionId = startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`log-${setIds()[0]}`));
    await fireEvent.press(screen.getByTestId('finish'));
    await cancelDialog();

    expect(store().sessions.find((s) => s.id === sessionId)!.endedAt).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(dialogOpen()).toBe(false);
  });

  it('offers to discard rather than saving an empty workout', async () => {
    const sessionId = startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId('finish'));
    expect(screen.getByText('Nothing recorded')).toBeTruthy();

    await confirmDialog();
    expect(store().sessions.find((s) => s.id === sessionId)).toBeUndefined();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('discards the whole workout on demand', async () => {
    const sessionId = startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`log-${setIds()[0]}`));
    await fireEvent.press(screen.getByTestId('discard'));
    expect(screen.getByText('Discard workout?')).toBeTruthy();
    await confirmDialog();

    expect(store().sessions.find((s) => s.id === sessionId)).toBeUndefined();
  });

  it('renders an empty state rather than crashing on a missing session', async () => {
    mockParams = { id: 'does-not-exist' };
    await renderScreen(<SessionScreen />);

    expect(screen.getByText('Workout not found')).toBeTruthy();
  });

  it('handles an exercise whose sets have all been deleted', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    for (const setId of setIds()) {
      await fireEvent.press(screen.getByTestId(`del-${setId}`));
    }
    expect(screen.getByText(/No sets\./)).toBeTruthy();
    expect(screen.getByText('0/0')).toBeTruthy();
  });

  it('navigates to the how-to page from the opened exercise', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`howto-${BENCH}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/exercise/${BENCH}`);
  });

  it('opens the first unfinished exercise so you land on what you were doing', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    // Sets are reachable immediately rather than behind a tap.
    expect(screen.getByTestId(`log-${setIds()[0]}`)).toBeTruthy();
  });

  it('collapses an exercise to a single row when tapped', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const first = setIds()[0];
    await fireEvent.press(screen.getByTestId(`entry-${entryId()}`));
    expect(screen.queryByTestId(`log-${first}`)).toBeNull();

    // The summary stays visible while closed.
    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`entry-${entryId()}`));
    expect(screen.getByTestId(`log-${first}`)).toBeTruthy();
  });

  it('marks an exercise done once every set is recorded', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const id0 = entryId();
    expect(screen.queryByTestId(`entry-${id0}-done`)).toBeNull();

    for (const id of setIds()) await fireEvent.press(screen.getByTestId(`log-${id}`));

    // A finished exercise swaps its "2/3" counter for a completion badge.
    expect(screen.getByTestId(`entry-${id0}-done`)).toBeTruthy();
    expect(screen.queryByText('3/3')).toBeNull();
    expect(store().sessions[0].entries[0].sets.every((x) => x.loggedAt !== null)).toBe(true);
  });
});
