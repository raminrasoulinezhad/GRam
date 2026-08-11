import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { exerciseName } from '@/catalog';
import { useStore } from '@/store/useStore';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PickerScreen = require('../../app/picker').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const store = () => useStore.getState();

/**
 * Choosing exercises.
 *
 * The bug: a row you tapped twice was added twice, and a third tap made three. Nothing on
 * screen said so beyond a small number next to a tick, and the second copy showed up later as a
 * duplicate exercise in the workout. Tapping a chosen row now takes it out again.
 *
 * The list is virtualised over nearly nine hundred rows, so every helper here types the name
 * into the search box first - the same thing a person does, and the only way the row exists.
 */
async function reveal(exerciseId: string) {
  await fireEvent.changeText(screen.getByTestId('exercise-search'), exerciseName(exerciseId));
}

async function tap(exerciseId: string) {
  await reveal(exerciseId);
  await fireEvent.press(screen.getByTestId(`exercise-${exerciseId}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  mockParams = {};
});

describe('adding to a plan', () => {
  function openOnPlan() {
    const planId = store().createPlan('monday');
    mockParams = { planId };
    return planId;
  }

  const items = (planId: string) =>
    store().plans.find((p) => p.id === planId)!.items.map((i) => i.exerciseId);

  it('adds an exercise on the first tap', async () => {
    const planId = openOnPlan();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);

    expect(items(planId)).toEqual([BENCH]);
  });

  it('takes it out again on the second tap, rather than adding a copy', async () => {
    const planId = openOnPlan();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);
    await tap(BENCH);

    expect(items(planId)).toEqual([]);
  });

  it('survives a third and fourth tap without ever holding two', async () => {
    // The old behaviour turned an uncertain double-tap into a plan with the same lift twice.
    const planId = openOnPlan();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);
    await tap(BENCH);
    await tap(BENCH);
    await tap(BENCH);

    expect(items(planId)).toEqual([]);
  });

  it('keeps the other exercises when one is removed', async () => {
    const planId = openOnPlan();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);
    await tap(SQUAT);
    await tap(BENCH);

    expect(items(planId)).toEqual([SQUAT]);
  });

  it('marks a chosen exercise as chosen, and leaves the rest alone', async () => {
    openOnPlan();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);
    expect(screen.getByTestId(`chosen-${BENCH}`)).toBeTruthy();

    await reveal(SQUAT);
    expect(screen.queryByTestId(`chosen-${SQUAT}`)).toBeNull();
  });

  it('reads the tick off the plan, so reopening shows what is already in it', async () => {
    // Not off a tally kept while the screen is open - which is what made the old count wrong
    // the moment you left and came back.
    const planId = openOnPlan();
    store().addPlanItem(planId, BENCH);

    await renderScreen(<PickerScreen />);
    await reveal(BENCH);

    expect(screen.getByTestId(`chosen-${BENCH}`)).toBeTruthy();
  });

  it('clears out every copy left behind by an older version', async () => {
    const planId = openOnPlan();
    store().addPlanItem(planId, BENCH);
    store().addPlanItem(planId, BENCH);
    store().addPlanItem(planId, SQUAT);

    await renderScreen(<PickerScreen />);
    await tap(BENCH);

    expect(items(planId)).toEqual([SQUAT]);
  });
});

describe('adding to a live workout', () => {
  function openOnSession() {
    const planId = store().createPlan('monday');
    const sessionId = store().startEmptySession();
    mockParams = { sessionId };
    return { planId, sessionId };
  }

  const entries = (sessionId: string) =>
    store().sessions.find((x) => x.id === sessionId)!.entries;

  it('adds and removes the same way a plan does', async () => {
    const { sessionId } = openOnSession();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);
    expect(entries(sessionId).map((e) => e.exerciseId)).toEqual([BENCH]);

    await tap(BENCH);
    expect(entries(sessionId)).toEqual([]);
  });

  it('refuses to remove an exercise you have already recorded a set of', async () => {
    /*
     * The one place a mis-tap in a list of eight hundred near-identical rows could delete
     * training that actually happened. Adding it back would not bring the sets with it.
     */
    const { sessionId } = openOnSession();
    await renderScreen(<PickerScreen />);
    await tap(BENCH);

    const entry = entries(sessionId)[0];
    store().toggleSetLogged(sessionId, entry.id, entry.sets[0].id);

    await tap(BENCH);

    expect(entries(sessionId)).toHaveLength(1);
    expect(entries(sessionId)[0].sets.some((x) => x.loggedAt !== null)).toBe(true);
  });

  it('shows a padlock rather than a tick for one it will not remove', async () => {
    // Two states need two pictures: a tick that sometimes responds and sometimes does not is
    // worse than either.
    const { sessionId } = openOnSession();
    await renderScreen(<PickerScreen />);
    await tap(BENCH);

    const entry = entries(sessionId)[0];
    store().toggleSetLogged(sessionId, entry.id, entry.sets[0].id);
    await reveal(BENCH);

    expect(screen.getByTestId(`locked-${BENCH}`)).toBeTruthy();
    expect(screen.queryByTestId(`chosen-${BENCH}`)).toBeNull();
  });
});

describe('correcting a workout that is already finished', () => {
  /*
   * The history editor opens this same screen. Adding to a finished workout stamps the set as
   * recorded on the spot - there is no workout left to record it during - so the padlock would
   * otherwise snap shut on the tap just made.
   */
  function openOnFinished() {
    const planId = store().createPlan('monday');
    const sessionId = store().startEmptySession();
    store().endSession(sessionId);
    mockParams = { sessionId };
    return { planId, sessionId };
  }

  const entries = (sessionId: string) =>
    store().sessions.find((x) => x.id === sessionId)!.entries;

  it('lets you undo an exercise you just added by mistake', async () => {
    const { sessionId } = openOnFinished();
    await renderScreen(<PickerScreen />);

    await tap(BENCH);
    expect(entries(sessionId)).toHaveLength(1);
    expect(entries(sessionId)[0].sets[0].loggedAt).not.toBeNull();

    await tap(BENCH);
    expect(entries(sessionId)).toEqual([]);
  });

  it('locks an exercise that was already in the workout when the screen opened', async () => {
    /*
     * The other half of the exemption. A set added in an earlier visit is history like any
     * other by the time you come back, and removing it is the editor's own job - this screen
     * only knows about the taps it saw itself.
     */
    const { sessionId } = openOnFinished();
    store().addSessionExercise(sessionId, BENCH);
    expect(entries(sessionId)[0].sets[0].loggedAt).not.toBeNull();

    await renderScreen(<PickerScreen />);
    await reveal(BENCH);
    expect(screen.getByTestId(`locked-${BENCH}`)).toBeTruthy();

    await tap(BENCH);
    expect(entries(sessionId)).toHaveLength(1);
  });
});

describe('the done button', () => {
  it('counts what the target holds, not the taps made', async () => {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, SQUAT);
    mockParams = { planId };

    await renderScreen(<PickerScreen />);
    await tap(BENCH);

    expect(screen.getByText('Done - 2 exercises')).toBeTruthy();
  });

  it('says just Done when there is nothing in it', async () => {
    mockParams = { planId: store().createPlan('monday') };
    await renderScreen(<PickerScreen />);

    expect(screen.getByText('Done')).toBeTruthy();
  });
});
