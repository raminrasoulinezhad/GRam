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
const DB_BENCH = 'Dumbbell_Bench_Press';
const ONE_ARM_ROW = 'One-Arm_Dumbbell_Row';
const PULLUPS = 'Pullups';
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

  it('edits weight and reps through the set wheels', async () => {
    /*
     * The weight wheel skips rows - ones to 40 kg, fives above it - so seeding a value between
     * two rows makes the whole path observable: the sheet has to open on the nearest row, and
     * Done has to write that row back. A value already on the wheel would leave the store
     * untouched and prove nothing.
     *
     * The library's own scrolling cannot be driven from here - it is a real scroll container,
     * and there isn't one - so choosing a *different* row is verified in a browser. What these
     * tests hold is the wiring on either side of it.
     */
    store().updateSettings({ unit: 'kg' });
    startWorkout();
    store().updateSet(store().sessions[0].id, entryId(), setIds()[0], {
      weightKg: 82.4,
      reps: 5,
    });
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.press(screen.getByTestId(`set-${setId}-weight`));
    await fireEvent.press(screen.getByTestId(`set-${setId}-weight-done`));

    // 82.4 sits between the 80 and 85 rows, and 80 is the nearer one.
    expect(store().sessions[0].entries[0].sets[0].weightKg).toBe(80);
  });

  it('shows the stored value on the row, without opening anything', async () => {
    // A set table has to be readable at a glance mid-workout. Whatever the wheel would snap to,
    // the row states what is actually recorded.
    store().updateSettings({ unit: 'kg' });
    startWorkout();
    store().updateSet(store().sessions[0].id, entryId(), setIds()[0], {
      weightKg: 82.5,
      reps: 5,
    });
    await renderScreen(<SessionScreen />);

    // All three, because an edit carries into the sets that come after it.
    expect(screen.getAllByText('82.5 kg').length).toBe(3);
    expect(screen.getAllByText('5 reps').length).toBe(3);
  });

  it('converts through the wheel in the default pounds', async () => {
    // Stored in kg whatever the wheel shows, so switching units never rewrites history. 102.5 kg
    // is 226.0 lb, the nearest pound row is 225, and that comes back as 102.06 kg.
    startWorkout();
    store().updateSet(store().sessions[0].id, entryId(), setIds()[0], { weightKg: 102.5 });
    await renderScreen(<SessionScreen />);

    const setId = setIds()[0];
    await fireEvent.press(screen.getByTestId(`set-${setId}-weight`));
    await fireEvent.press(screen.getByTestId(`set-${setId}-weight-done`));

    expect(store().sessions[0].entries[0].sets[0].weightKg).toBeCloseTo(102.06, 2);
  });

  it('says nothing rather than zero for a set with no numbers yet', async () => {
    /*
     * A wheel cannot express "blank", so a set that has never been filled in must not read as
     * 0 kg x 1 rep - that is a claim about a set nobody did. It shows a dash until chosen.
     *
     * This does cost something the typed field had: once a number is set it can be changed but
     * not cleared again. Deliberate - there is no gesture on a wheel that means "unset", and
     * inventing one for a case nobody hits is worse than the gap.
     */
    startWorkout(PULLUPS);
    store().updateSet(store().sessions[0].id, entryId(), setIds()[0], { reps: undefined });
    await renderScreen(<SessionScreen />);

    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
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

  it('shows the right fields for a timed exercise and no weight wheel', async () => {
    startWorkout(PLANK);
    const setId = setIds()[0];
    // The seconds wheel counts in fives, so 73 snaps to 75 and the write is observable.
    store().updateSet(store().sessions[0].id, entryId(), setId, { timeSec: 73 });
    await renderScreen(<SessionScreen />);

    expect(screen.getByTestId(`set-${setId}-time`)).toBeTruthy();
    expect(screen.queryByTestId(`set-${setId}-weight`)).toBeNull();

    await fireEvent.press(screen.getByTestId(`set-${setId}-time`));
    await fireEvent.press(screen.getByTestId(`set-${setId}-time-done`));
    expect(store().sessions[0].entries[0].sets[0].timeSec).toBe(75);
  });

  it('puts the stopwatch beside the seconds, not beside the record button', async () => {
    /*
     * It used to sit a thumb's width from Record, so the two most consequential buttons in the
     * app - "measure this set" and "this set happened" - were neighbours with nothing between
     * them. Position is checked as render order, which for this row is left to right: the
     * stopwatch comes after the time field and before the tick.
     */
    startWorkout(PLANK);
    const setId = setIds()[0];
    await renderScreen(<SessionScreen />);

    const tree = JSON.stringify(screen.toJSON());
    const field = tree.indexOf(`"set-${setId}-time"`);
    const stopwatch = tree.indexOf(`"time-${setId}"`);
    const record = tree.indexOf(`"log-${setId}"`);

    expect([field, stopwatch, record].every((i) => i >= 0)).toBe(true);
    expect(field).toBeLessThan(stopwatch);
    expect(stopwatch).toBeLessThan(record);
  });

  it('offers the stopwatch only where there is a duration to measure', async () => {
    startWorkout(BENCH);
    await renderScreen(<SessionScreen />);
    expect(screen.queryByTestId(`time-${setIds()[0]}`)).toBeNull();
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

describe('offering an easier exercise', () => {
  it('suggests the simpler movement, and says what it gives you', async () => {
    startWorkout(PULLUPS);
    await renderScreen(<SessionScreen />);

    expect(screen.getByTestId(`easier-${entryId()}`)).toBeTruthy();
    expect(screen.getByText(/Band Assisted Pull-Up/)).toBeTruthy();
    expect(screen.getByText(/carries part of your weight/)).toBeTruthy();
  });

  it('opens the how-to for the suggestion, which is a name you may not know', async () => {
    startWorkout(PULLUPS);
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`easier-name-${entryId()}`));

    expect(mockRouter.push).toHaveBeenCalledWith('/exercise/Band_Assisted_Pull-Up');
    // Reading about it is not choosing it.
    expect(store().sessions[0].entries[0].exerciseId).toBe(PULLUPS);
  });

  it('swaps the exercise, keeping the number of sets the plan asked for', async () => {
    startWorkout(PULLUPS);
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`swap-${entryId()}`));

    expect(store().sessions[0].entries[0].exerciseId).toBe('Band_Assisted_Pull-Up');
    expect(store().sessions[0].entries[0].sets).toHaveLength(3);
    expect(screen.getByText('Band Assisted Pull-Up')).toBeTruthy();
  });

  it('offers the next rung down once you have swapped', async () => {
    startWorkout(PULLUPS);
    await renderScreen(<SessionScreen />);
    await fireEvent.press(screen.getByTestId(`swap-${entryId()}`));

    // Band-assisted is itself on the ladder, so the way down carries on.
    expect(screen.getByText(/Scapular Pull-Up/)).toBeTruthy();
  });

  it('stops offering once a set has been recorded', async () => {
    startWorkout(PULLUPS);
    await renderScreen(<SessionScreen />);

    await fireEvent.press(screen.getByTestId(`log-${setIds()[0]}`));

    // You are doing it. The question the suggestion asks has been answered.
    expect(screen.queryByTestId(`easier-${entryId()}`)).toBeNull();
  });

  it('says nothing for an exercise with no listed regression', async () => {
    // A barbell curl is not a movement anyone needs a way into, and the list says nothing about
    // it rather than inventing something - which is the failure mode of the derived version.
    startWorkout('Barbell_Curl');
    await renderScreen(<SessionScreen />);
    expect(screen.queryByTestId(`easier-${entryId()}`)).toBeNull();
  });
});

describe('exercises loaded a dumbbell per hand', () => {
  it('says so on the record page, so the right number gets typed', async () => {
    startWorkout(DB_BENCH);
    await renderScreen(<SessionScreen />);

    expect(screen.getByTestId(`per-side-${entryId()}`)).toBeTruthy();
    expect(screen.getByText(/Weight is per dumbbell/)).toBeTruthy();
  });

  it('says nothing of the sort about a barbell', async () => {
    startWorkout(BENCH);
    await renderScreen(<SessionScreen />);

    expect(screen.queryByTestId(`per-side-${entryId()}`)).toBeNull();
  });

  it('says nothing about a one-arm exercise, where the weight is the whole load', async () => {
    startWorkout(ONE_ARM_ROW);
    await renderScreen(<SessionScreen />);

    expect(screen.queryByTestId(`per-side-${entryId()}`)).toBeNull();
  });
});

describe('while the keyboard is up', () => {
  it('gives the screen over to the set being edited', async () => {
    mockKeyboardOpen = true;
    startWorkout();
    await renderScreen(<SessionScreen />);

    // A footer of buttons is most of what is left of the display once a keyboard has taken the
    // rest, and the row being typed into was going under it.
    expect(screen.queryByTestId('finish')).toBeNull();
    expect(screen.queryByTestId('discard')).toBeNull();
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

  it('brings the footer back when it closes', async () => {
    startWorkout();
    await renderScreen(<SessionScreen />);

    expect(screen.getByTestId('finish')).toBeTruthy();
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

  /*
   * Recording stamps each set with Date.now(), and these tests tick sets off far faster than a
   * millisecond - fast enough for two to share a stamp, which would leave the order they were
   * recorded in unknowable. A hand tapping a phone never does that; the clock is stepped here
   * so the test sees the same distinct stamps a real workout produces.
   */
  let clock = 0;
  beforeEach(() => {
    clock = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1_000));
  });
  afterEach(() => jest.restoreAllMocks());

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

  it('orders the finished ones by when they finished, newest last', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    // The plank is finished first and the bench second, so the bench - the one just put down -
    // sits at the bottom of the finished group, nearest the work left.
    await fireEvent.press(screen.getByTestId(plank));
    await completeEntry(2);
    await fireEvent.press(screen.getByTestId(bench));
    await completeEntry(0);

    expect(onScreen()).toEqual([plank, bench, squat]);
  });

  it('orders the ones under way by when they were started, newest last', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    // One set each, plank before squat. Both are under way; the plank started first.
    await fireEvent.press(screen.getByTestId(plank));
    await fireEvent.press(screen.getByTestId(`log-${entries()[2].sets[0].id}`));
    await fireEvent.press(screen.getByTestId(squat));
    await fireEvent.press(screen.getByTestId(`log-${entries()[1].sets[0].id}`));

    expect(onScreen()).toEqual([plank, squat, bench]);
  });

  it('drops a newly finished exercise below one finished earlier', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    // The bench opens by default, so it needs no tap to reach its sets.
    await completeEntry(0);
    expect(onScreen()).toEqual([bench, squat, plank]);

    // Finishing the squat puts it under the bench rather than above it.
    await fireEvent.press(screen.getByTestId(squat));
    await completeEntry(1);

    expect(onScreen()).toEqual([bench, squat, plank]);
  });

  it('does not move an exercise you are part way through as you keep recording', async () => {
    startThree();
    await renderScreen(<SessionScreen />);
    const [bench, squat, plank] = entries().map((e) => `entry-${e.id}`);

    // Bench started first, then the squat. Both under way, bench above squat. The bench card
    // opens by default; opening the squat closes it, so it is reopened to reach its second set.
    await fireEvent.press(screen.getByTestId(`log-${entries()[0].sets[0].id}`));
    await fireEvent.press(screen.getByTestId(squat));
    await fireEvent.press(screen.getByTestId(`log-${entries()[1].sets[0].id}`));
    expect(onScreen()).toEqual([bench, squat, plank]);

    // A second bench set must not slide it under the squat - it is still the older start, and
    // the row being worked in has to hold still.
    await fireEvent.press(screen.getByTestId(bench));
    await fireEvent.press(screen.getByTestId(`log-${entries()[0].sets[1].id}`));

    expect(onScreen()).toEqual([bench, squat, plank]);
  });
});
