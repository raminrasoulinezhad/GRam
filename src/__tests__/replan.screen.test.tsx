import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));
const mockRouter = jest.requireMock('expo-router').router as {
  push: jest.Mock;
  replace: jest.Mock;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReplanScreen = require('../../app/replan/[id]').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const store = () => useStore.getState();

const WEEK = 7 * 86_400_000;

/**
 * A plan edited `weeksAgo`, with one finished workout per entry in `history` recording that
 * weight for every exercise. Written straight into the store rather than driven through the UI:
 * this page reads months of history, and no amount of button pressing produces that.
 */
function planWithHistory(weeksAgo: number, history: number[][], exerciseIds = [BENCH]) {
  const planId = store().createPlan('monday');
  for (const id of exerciseIds) store().addPlanItem(planId, id);

  const editedAt = Date.now() - weeksAgo * WEEK;
  useStore.setState((s) => ({
    plans: s.plans.map((p) => (p.id === planId ? { ...p, updatedAt: editedAt } : p)),
    sessions: history.map((weights, i) => {
      const at = editedAt + (i + 1) * (WEEK / 2);
      return {
        id: `h${i}`,
        planId,
        planName: 'Monday',
        startedAt: at,
        endedAt: at + 3_600_000,
        entries: exerciseIds.map((exerciseId, x) => ({
          id: `e${i}-${x}`,
          exerciseId,
          kind: 'weight_reps' as const,
          restSec: 90,
          sets: [{ id: `s${i}-${x}`, weightKg: weights[x], reps: 5, loggedAt: at }],
        })),
      };
    }),
  }));

  mockParams = { id: planId };
  return planId;
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  store().updateSettings({ unit: 'kg' });
  mockParams = {};
});

describe('the plan review page', () => {
  it('leads with how long it has been and how much has been done since', async () => {
    planWithHistory(9, [[60], [60], [60]]);
    await renderScreen(<ReplanScreen />);
    expect(screen.getByText('9 weeks, 3 workouts')).toBeTruthy();
  });

  it('tells you to leave a climbing lift alone', async () => {
    // The most useful thing this page can say on some visits is "change nothing", and it has to
    // say it out loud or the page reads as a demand to change something.
    planWithHistory(9, [[60], [70], [80]]);
    await renderScreen(<ReplanScreen />);

    expect(screen.getByText('Still working, leave these alone')).toBeTruthy();
    expect(screen.getByText('+20kg')).toBeTruthy();
    expect(screen.queryByText('Not moving, worth changing')).toBeNull();
  });

  it('flags a lift stuck at the same weight and offers other work for that muscle', async () => {
    planWithHistory(9, [[60], [60], [60]]);
    await renderScreen(<ReplanScreen />);

    expect(screen.getByText('Not moving, worth changing')).toBeTruthy();
    expect(screen.getByText('OTHER CHEST WORK')).toBeTruthy();
  });

  it('never offers an alternative already in the plan', async () => {
    // Suggesting the exercise sitting two rows above would be obviously broken advice.
    planWithHistory(9, [[60, 60], [60, 60], [60, 60]], [BENCH, SQUAT]);
    await renderScreen(<ReplanScreen />);

    for (const id of store().plans[0].items.map((i) => i.exerciseId)) {
      expect(screen.queryByTestId(`alt-${id}`)).toBeNull();
    }
  });

  it('opens the how-to for a suggestion rather than editing the plan', async () => {
    planWithHistory(9, [[60], [60], [60]]);
    await renderScreen(<ReplanScreen />);

    const before = store().plans[0].items.map((i) => i.exerciseId);
    const suggestion = screen.getAllByTestId(/^alt-/)[0];
    await fireEvent.press(suggestion);

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/exercise\//),
    );
    expect(store().plans[0].items.map((i) => i.exerciseId)).toEqual(before);
  });

  it('treats a falling lift as a recovery problem, and offers nothing', async () => {
    // Swapping the exercise here would hide the signal rather than answer it.
    planWithHistory(9, [[80], [72.5], [70]]);
    await renderScreen(<ReplanScreen />);

    expect(screen.getByText('Going backwards')).toBeTruthy();
    expect(screen.getByText('−10kg')).toBeTruthy();
    expect(screen.queryByText(/OTHER .* WORK/)).toBeNull();
  });

  it('shows a drop with a minus sign, never bare', async () => {
    // An unsigned "10kg" next to a lift that lost 10kg reads as a gain.
    planWithHistory(9, [[80], [75], [70]]);
    await renderScreen(<ReplanScreen />);
    expect(screen.queryByText('10kg')).toBeNull();
    expect(screen.getByText('−10kg')).toBeTruthy();
  });

  it('refuses to judge a lift with too little recorded', async () => {
    planWithHistory(9, [[60], [60]]);
    await renderScreen(<ReplanScreen />);

    expect(screen.getByText('Not enough recorded to say')).toBeTruthy();
    expect(screen.queryByText('Not moving, worth changing')).toBeNull();
  });

  it('says so plainly when a long-running plan is working', async () => {
    planWithHistory(12, [[60], [70], [80]]);
    await renderScreen(<ReplanScreen />);
    expect(screen.getByText(/The age of a plan is not on its own a reason to change it/)).toBeTruthy();
  });

  it('has something to say about a plan with no exercises', async () => {
    // Every path through this page must render something. An empty plan used to produce a
    // heading and nothing else.
    planWithHistory(9, [], []);
    await renderScreen(<ReplanScreen />);
    expect(screen.getByText(/no exercises in it yet/)).toBeTruthy();
  });

  it('opens the plan itself, replacing this page', async () => {
    planWithHistory(9, [[60], [60], [60]]);
    const planId = store().plans[0].id;
    await renderScreen(<ReplanScreen />);

    await fireEvent.press(screen.getByTestId('replan-open'));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/plan/${planId}`);
  });

  it('survives a plan that has been deleted out from under it', async () => {
    mockParams = { id: 'gone' };
    await renderScreen(<ReplanScreen />);
    expect(screen.getByText('Plan not found')).toBeTruthy();
  });

  it('reports weight in the unit the user reads in', async () => {
    store().updateSettings({ unit: 'lb' });
    planWithHistory(9, [[60], [70], [80]]);
    await renderScreen(<ReplanScreen />);
    // 20kg is 44lb; showing 20 here would be wrong by more than a factor of two.
    expect(screen.getByText('+44lb')).toBeTruthy();
  });
});
