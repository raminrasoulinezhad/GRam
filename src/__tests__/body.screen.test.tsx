import { fireEvent, screen } from '@testing-library/react-native';
import { confirmDialog, dialogOpen, renderScreen } from '@/test-utils';
import { getExercise } from '@/catalog';
import { useStore } from '@/store/useStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BodyScreen = require('../../app/(tabs)/body').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const store = () => useStore.getState();

/** Runs a full plan to completion so the heatmap has something to draw. */
function completeWorkout(exerciseId: string) {
  const planId = store().createPlan('monday');
  store().addPlanItem(planId, exerciseId);
  const sessionId = store().startSession(planId)!;
  const entry = store().sessions[0].entries[0];
  for (const set of entry.sets) store().toggleSetLogged(sessionId, entry.id, set.id);
  store().endSession(sessionId);
}

/** Union of the primary and secondary muscles of the given movements. */
function musclesOf(...ids: string[]): Set<string> {
  return new Set(
    ids.flatMap((id) => {
      const e = getExercise(id)!;
      return [...e.primaryMuscles, ...e.secondaryMuscles];
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('body heatmap', () => {
  it('renders both figures with no history and does not crash', async () => {
    await renderScreen(<BodyScreen />);

    expect(screen.getByText('FRONT')).toBeTruthy();
    expect(screen.getByText('BACK')).toBeTruthy();
    expect(screen.getByText('No finished workouts yet')).toBeTruthy();
  });

  it('shows the weekly breakdown once a workout is finished', async () => {
    completeWorkout(BENCH);
    await renderScreen(<BodyScreen />);

    expect(screen.getByText('Breakdown')).toBeTruthy();
    // Three sets of bench: 3.0 effective sets on the chest, and 1.5 on each muscle it
    // assists, since a secondary muscle earns half credit.
    expect(screen.getByText('3.0')).toBeTruthy();
    expect(screen.getAllByText('1.5')).toHaveLength(getExercise(BENCH)!.secondaryMuscles.length);
  });

  it('counts only the muscles actually trained', async () => {
    completeWorkout(BENCH);
    await renderScreen(<BodyScreen />);

    const expected = musclesOf(BENCH).size;
    expect(screen.getByText(`${expected} of 17 muscles trained this week`)).toBeTruthy();
  });

  it('grows the trained count as different muscle groups are worked', async () => {
    completeWorkout(BENCH);
    completeWorkout(SQUAT);
    await renderScreen(<BodyScreen />);

    const expected = musclesOf(BENCH, SQUAT).size;
    expect(expected).toBeGreaterThan(musclesOf(BENCH).size);
    expect(screen.getByText(`${expected} of 17 muscles trained this week`)).toBeTruthy();
  });

  it('switches to the recovery view', async () => {
    completeWorkout(BENCH);
    await renderScreen(<BodyScreen />);

    await fireEvent.press(screen.getByText('Recovery'));

    expect(screen.getByText(/How recovered each muscle is right now/)).toBeTruthy();
    expect(screen.getByText(/muscles carrying fatigue/)).toBeTruthy();
    // Recovery is a percentage, so muscles the session never touched read 100%.
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('switches back to the volume view', async () => {
    completeWorkout(BENCH);
    await renderScreen(<BodyScreen />);

    await fireEvent.press(screen.getByText('Recovery'));
    await fireEvent.press(screen.getByText("This week's volume"));

    expect(screen.getByText(/Effective sets per muscle over the last 7 days/)).toBeTruthy();
  });

  it('ignores a workout still in progress', async () => {
    const planId = store().createPlan('tuesday');
    store().addPlanItem(planId, BENCH);
    const sessionId = store().startSession(planId)!;
    const entry = store().sessions[0].entries[0];
    store().toggleSetLogged(sessionId, entry.id, entry.sets[0].id);

    await renderScreen(<BodyScreen />);

    // The map reflects finished workouts, so an unfinished one must not colour it in.
    expect(screen.getByText('No finished workouts yet')).toBeTruthy();
  });
});
