import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const HistoryScreen = require('../../app/(tabs)/history').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const store = () => useStore.getState();

/**
 * The log, and the workout that has not finished yet.
 *
 * A session was saved from its first recorded set and always had been, but nothing showed it:
 * this tab listed finished workouts only. Someone who closed the app mid-session and came back
 * here saw no trace of the sets they had just done, and concluded the app had thrown them away.
 * It had not. Now it is here, marked, and tapping it goes back to the workout.
 */
function startWorkout(): string {
  const planId = store().createPlan('monday');
  store().addPlanItem(planId, BENCH);
  return store().startSession(planId)!;
}

function record(sessionId: string, count: number): void {
  const entry = store().sessions.find((x) => x.id === sessionId)!.entries[0];
  for (const set of entry.sets.slice(0, count)) {
    store().toggleSetLogged(sessionId, entry.id, set.id);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('a workout still in progress', () => {
  it('appears here from its very first recorded set', async () => {
    const id = startWorkout();
    record(id, 1);

    await renderScreen(<HistoryScreen />);

    expect(screen.getByTestId(`resume-${id}`)).toBeTruthy();
    expect(screen.getByText('IN PROGRESS')).toBeTruthy();
  });

  it('says how many sets are already safe', async () => {
    const id = startWorkout();
    record(id, 2);

    await renderScreen(<HistoryScreen />);

    expect(screen.getByText(/2 sets saved/)).toBeTruthy();
    // The sentence that answers the actual worry, in as many words.
    expect(screen.getByText(/Already saved/)).toBeTruthy();
  });

  it('goes back to the workout when tapped', async () => {
    const id = startWorkout();
    record(id, 1);

    await renderScreen(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId(`resume-${id}`));

    expect(mockRouter.push).toHaveBeenCalledWith(`/session/${id}`);
  });

  it('stays out of the list until something is recorded', async () => {
    // A workout with nothing in it is an intention, not a workout.
    const id = startWorkout();

    await renderScreen(<HistoryScreen />);

    expect(screen.queryByTestId(`resume-${id}`)).toBeNull();
    expect(screen.getByText('No workouts yet')).toBeTruthy();
  });

  it('replaces the empty state rather than sitting under it', async () => {
    // "No workouts yet" above a workout in progress is the app arguing with itself.
    const id = startWorkout();
    record(id, 1);

    await renderScreen(<HistoryScreen />);

    expect(screen.queryByText('No workouts yet')).toBeNull();
  });

  it('is not counted in the finished log or its weekly totals', async () => {
    /*
     * Deliberate. It is shown so it can be found and resumed, not so it can be counted twice -
     * the seven-day summary and the body map read finished workouts, and a session still open
     * would move those numbers and then move them again when it ends.
     */
    const id = startWorkout();
    record(id, 3);

    await renderScreen(<HistoryScreen />);

    expect(screen.queryByText('Last 7 days')).toBeNull();
  });

  it('gives way to the log once it is finished', async () => {
    const id = startWorkout();
    record(id, 2);
    store().endSession(id);

    await renderScreen(<HistoryScreen />);

    expect(screen.queryByTestId(`resume-${id}`)).toBeNull();
    expect(screen.getByText('Last 7 days')).toBeTruthy();
  });
});
