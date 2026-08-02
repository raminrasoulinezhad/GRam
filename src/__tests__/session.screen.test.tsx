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

/*
 * The keyboard is faked rather than raised. Whether a real one is up is a judgement about two
 * viewport heights, tested on its own in src/ui/__tests__/viewportHeight.test.ts; what matters
 * here is what the screen does once the answer is yes.
 */
let mockKeyboardOpen = false;
jest.mock('@/ui/useViewportHeight', () => ({
  ...jest.requireActual('@/ui/useViewportHeight'),
  useKeyboardOpen: () => mockKeyboardOpen,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SessionScreen = require('../../app/session/[id]').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
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
  mockKeyboardOpen = false;
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
    // Deliberately in kilograms, so the number typed is the number stored and this stays a
    // test of the field wiring. The pounds path, which is what a fresh install shows, is next.
    store().updateSettings({ unit: 'kg' });
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.changeText(screen.getByTestId(`set-${setId}-weight`), '82.5');
    await fireEvent.changeText(screen.getByTestId(`set-${setId}-reps`), '5');

    expect(store().sessions[0].entries[0].sets[0]).toMatchObject({ weightKg: 82.5, reps: 5 });
  });

  it('converts a weight typed in the default pounds', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.changeText(screen.getByTestId(`set-${setId}-weight`), '225');

    // Stored in kg whatever the field says, so switching units never rewrites history.
    expect(store().sessions[0].entries[0].sets[0].weightKg).toBeCloseTo(102.06, 1);
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

  it('shows what each muscle is in for today, and how much of it is done', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    // Before anything is recorded the chips already say what the workout holds: three sets of
    // bench is three effective sets of chest, and half that for the triceps assisting.
    expect(screen.getByText('Chest 0/3')).toBeTruthy();
    expect(screen.getByText('Triceps 0/1.5')).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`log-${setIds()[0]}`));

    expect(screen.getByText('Chest 1/3')).toBeTruthy();
    expect(screen.getByText('Triceps 0.5/1.5')).toBeTruthy();
  });

  it('completes a muscle when the workout has nothing left for it', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    for (const id of setIds()) await fireEvent.press(screen.getByTestId(`log-${id}`));

    expect(screen.getByText('Chest 3/3')).toBeTruthy();
  });

  it('counts a muscle across every exercise that works it', async () => {
    const s = store();
    const planId = s.createPlan('monday');
    s.addPlanItem(planId, BENCH);
    s.addPlanItem(planId, BENCH);
    mockParams = { id: s.startSession(planId)! };
    await renderScreen(<SessionScreen />);

    // Two exercises of three sets each, not three.
    expect(screen.getByText('Chest 0/6')).toBeTruthy();
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

describe('while the keyboard is up', () => {
  it('gives the screen over to the set being edited', async () => {
    mockKeyboardOpen = true;
    startWorkout();
    await renderScreen(<SessionScreen />);

    // A footer of buttons and two rows of muscle chips is most of what is left of the display
    // once a keyboard has taken the rest, and the row being typed into was going under it.
    expect(screen.queryByTestId('finish')).toBeNull();
    expect(screen.queryByTestId('discard')).toBeNull();
    expect(screen.queryByTestId('muscle-chest')).toBeNull();
  });

  it('keeps the set count, which is the one line worth the space', async () => {
    mockKeyboardOpen = true;
    startWorkout();
    await renderScreen(<SessionScreen />);

    expect(screen.getByText(/^Started/)).toBeTruthy();
  });

  it('keeps the sets themselves reachable', async () => {
    mockKeyboardOpen = true;
    startWorkout();
    await renderScreen(<SessionScreen />);

    expect(screen.getByTestId(`set-${setIds()[0]}-weight`)).toBeTruthy();
  });

  it('brings the footer and the chips back when it closes', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    expect(screen.getByTestId('finish')).toBeTruthy();
    expect(screen.getByTestId('muscle-chest')).toBeTruthy();
  });
});

describe('the order exercises appear in', () => {
  /** A workout of three exercises, in plan order: bench, squat, plank. */
  function startThree() {
    const s = store();
    const planId = s.createPlan('monday');
    for (const id of [BENCH, SQUAT, PLANK]) s.addPlanItem(planId, id);
    const sessionId = s.startSession(planId)!;
    mockParams = { id: sessionId };
    return sessionId;
  }

  const entries = () => store().sessions[0].entries;

  /** The entry ids as they appear down the screen. The `-done` badge shares the prefix. */
  const onScreen = () =>
    screen
      .getAllByTestId(/^entry-/)
      .map((el) => String(el.props.testID))
      .filter((id) => !id.endsWith('-done'));

  /** Ticks off every set of one exercise. */
  async function completeEntry(index: number) {
    for (const set of entries()[index].sets) {
      await fireEvent.press(screen.getByTestId(`log-${set.id}`));
    }
  }

  it('keeps the plan order while nothing has been recorded', async () => {
    startThree();
    await renderScreen(<SessionScreen />);

    expect(onScreen()).toEqual(entries().map((e) => `entry-${e.id}`));
  });

  it('lifts a finished exercise to the top', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    // Open the squat and tick off all of it.
    await fireEvent.press(screen.getByTestId(squat));
    await completeEntry(1);

    expect(onScreen()).toEqual([squat, bench, plank]);
  });

  it('puts the exercise under way between the finished and the untouched', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    await fireEvent.press(screen.getByTestId(plank));
    await completeEntry(2);
    // One set of the squat: started, not finished.
    await fireEvent.press(screen.getByTestId(squat));
    await fireEvent.press(screen.getByTestId(`log-${entries()[1].sets[0].id}`));

    expect(onScreen()).toEqual([plank, squat, bench]);
  });

  it('sends an exercise back to its plan position when every set is un-recorded', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    await fireEvent.press(screen.getByTestId(squat));
    await completeEntry(1);
    expect(onScreen()).toEqual([squat, bench, plank]);

    // Ticked off by mistake: un-recording all of it makes it untouched again, which puts it
    // back among the exercises still to do, in the order the plan has them.
    await completeEntry(1);

    expect(onScreen()).toEqual([bench, squat, plank]);
  });

  it('holds the plan order within each group', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    // Finish the plank first, then the bench: both done, but bench came first in the plan.
    await fireEvent.press(screen.getByTestId(plank));
    await completeEntry(2);
    await fireEvent.press(screen.getByTestId(bench));
    await completeEntry(0);

    expect(onScreen()).toEqual([bench, plank, squat]);
  });
});
