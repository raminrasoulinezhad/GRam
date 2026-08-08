import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { TRAINING_GROUPS, suggestionFor } from '@/analytics/balance';
import type { Weekday } from '@/store/types';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PlansScreen = require('../../app/(tabs)/index').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Squat';
const store = () => useStore.getState();

function makePlan(day: Weekday, ...exerciseIds: string[]) {
  const id = store().createPlan(day);
  for (const exerciseId of exerciseIds) store().addPlanItem(id, exerciseId);
  return id;
}

const planOn = (day: Weekday) => store().plans.find((p) => p.day === day)!;

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('the Plans screen layout', () => {
  it('puts the day picker after the plans, not above them', async () => {
    makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId('add-day')).toBeTruthy();
    expect(screen.getByTestId('week-review')).toBeTruthy();
  });

  it('offers every weekday, and shows the taken ones rather than hiding them', async () => {
    // A gap on Thursday should be visible; a missing chip would not show it.
    makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);

    for (const day of ['monday', 'thursday', 'sunday']) {
      expect(screen.getByTestId(`add-${day}`)).toBeTruthy();
    }
  });

  it('creates the day that was tapped, and opens it', async () => {
    await renderScreen(<PlansScreen />);
    await fireEvent.press(screen.getByTestId('add-thursday'));

    expect(store().plans.map((p) => p.day)).toEqual(['thursday']);
    expect(mockRouter.push).toHaveBeenCalledWith(`/plan/${store().plans[0].id}`);
  });

  it('says so once the whole week is planned', async () => {
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const) {
      makePlan(day, BENCH);
    }
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId('add-day')).toBeTruthy();
    expect(screen.getByText('Every day of the week has a plan.')).toBeTruthy();
  });
});

describe('too few days to be balanced', () => {
  it('is the only advice shown when there are no plans', async () => {
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-issue-days')).toBeTruthy();
    // Eight identical unfixable gaps underneath would bury the one thing to do.
    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('is still shown for a single plan, however complete', async () => {
    makePlan('monday', ...TRAINING_GROUPS.map(suggestionFor));
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-issue-days')).toBeTruthy();
    expect(screen.queryByTestId('week-review-balanced')).toBeNull();
  });

  it('cannot be ignored', async () => {
    // It is a precondition, not an opinion.
    makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-issue-days')).toBeTruthy();
    expect(screen.queryByTestId('ignore-days')).toBeNull();
  });

  it('creates a plan and opens it', async () => {
    makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('add-plan-day'));
    expect(store().plans).toHaveLength(2);
    // The new day is the first free one, Tuesday.
    expect(store().plans.map((p) => p.day)).toEqual(['monday', 'tuesday']);
  });

  it('gives way to the muscle advice once there are two days', async () => {
    makePlan('monday', BENCH);
    makePlan('wednesday', SQUAT);
    await renderScreen(<PlansScreen />);

    expect(screen.queryByTestId('week-issue-days')).toBeNull();
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
  });
});

describe('the week review', () => {
  it('explains itself before there are any plans', async () => {
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-review')).toBeTruthy();
    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('raises an issue for every group the week misses', async () => {
    makePlan('monday', BENCH);
    makePlan('wednesday', SQUAT);
    await renderScreen(<PlansScreen />);

    // One chest day is not two, and most groups are not trained at all.
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
    expect(screen.getByTestId('week-issue-biceps')).toBeTruthy();
    expect(screen.getByTestId('week-issue-glutes')).toBeTruthy();
  });

  it('says nothing is outstanding once the week is balanced', async () => {
    const picks = TRAINING_GROUPS.map(suggestionFor);
    makePlan('monday', ...picks);
    makePlan('tuesday', ...picks);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId('week-review-balanced')).toBeTruthy();
    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('drops advice the user ignores, and remembers the choice', async () => {
    makePlan('monday', BENCH);
    makePlan('wednesday', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('ignore-biceps'));

    expect(screen.queryByTestId('week-issue-biceps')).toBeNull();
    expect(store().ignoredBalanceGroups).toEqual(['biceps']);
    // Other advice is untouched.
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
  });

  it('lists what has been dismissed rather than hiding it', async () => {
    makePlan('monday', BENCH);
    makePlan('wednesday', SQUAT);
    await renderScreen(<PlansScreen />);
    await fireEvent.press(screen.getByTestId('ignore-biceps'));

    expect(screen.getByTestId('week-review-dismissed')).toBeTruthy();
  });

  it('brings dismissed advice back on a re-review', async () => {
    makePlan('monday', BENCH);
    makePlan('wednesday', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('ignore-biceps'));
    expect(screen.queryByTestId('week-issue-biceps')).toBeNull();

    await fireEvent.press(screen.getByTestId('week-review-refresh'));
    expect(screen.getByTestId('week-issue-biceps')).toBeTruthy();
    expect(store().ignoredBalanceGroups).toEqual([]);
  });
});

describe('fixing an issue from the review', () => {
  /** Two days, so the structural blocker is out of the way and muscle advice is showing. */
  const twoDays = async () => {
    makePlan('monday', BENCH);
    makePlan('wednesday', SQUAT);
    await renderScreen(<PlansScreen />);
  };

  it('opens the exercise list rather than deciding for the user', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));

    // The whole catalog, opened on the muscle in question - not a single forced pick.
    expect(screen.getByTestId('exercise-search')).toBeTruthy();
    expect(screen.getByTestId(`top-pick-${suggestionFor('chest')}`)).toBeTruthy();
  });

  it('asks for the day only after an exercise is chosen', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    expect(screen.queryByTestId(`fix-into-${planOn('wednesday').id}`)).toBeNull();

    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    expect(screen.getByTestId(`fix-into-${planOn('wednesday').id}`)).toBeTruthy();
  });

  it('offers the days that do not already train the group', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));

    // Leg day is offered; Push day already has a chest exercise.
    expect(screen.getByTestId(`fix-into-${planOn('wednesday').id}`)).toBeTruthy();
    expect(screen.queryByTestId(`fix-into-${planOn('monday').id}`)).toBeNull();
  });

  it('adds the exercise the user chose to the day the user chose', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    await fireEvent.press(screen.getByTestId(`fix-into-${planOn('wednesday').id}`));

    expect(planOn('wednesday').items.map((i) => i.exerciseId)).toContain(suggestionFor('chest'));
  });

  it('lets the user pick something other than the recommendation', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));

    // Search the whole catalog from inside the fix flow and take a different chest exercise.
    await fireEvent.changeText(screen.getByTestId('exercise-search'), 'dumbbell flyes');
    await fireEvent.press(screen.getByTestId('exercise-Dumbbell_Flyes'));
    await fireEvent.press(screen.getByTestId(`fix-into-${planOn('wednesday').id}`));

    const ids = planOn('wednesday').items.map((i) => i.exerciseId);
    expect(ids).toContain('Dumbbell_Flyes');
    expect(ids).not.toContain(suggestionFor('chest'));
  });

  it('warns when the chosen exercise will not close the gap', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));

    // Barbell Curl is a biceps exercise; adding it to a day does nothing for chest.
    await fireEvent.changeText(screen.getByTestId('exercise-search'), 'barbell curl');
    await fireEvent.press(screen.getByTestId('exercise-Barbell_Curl'));
    expect(screen.getByTestId('fix-warning')).toBeTruthy();
  });

  it('does not warn about a recommended pick', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    expect(screen.queryByTestId('fix-warning')).toBeNull();
  });

  it('can go back from the day list to the exercise list', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));

    // By accessible name: Pressable surfaces its testID on both its wrapper and inner view,
    // so the id matches twice while the label is what a user actually has to find.
    await fireEvent.press(screen.getByLabelText('Back to the exercise list'));
    expect(screen.getByTestId('exercise-search')).toBeTruthy();
    expect(screen.queryByTestId(`fix-into-${planOn('wednesday').id}`)).toBeNull();
  });

  it('closes the issue it was raised for', async () => {
    await twoDays();
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    await fireEvent.press(screen.getByTestId(`fix-into-${planOn('wednesday').id}`));

    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('closes the picker without adding anything when cancelled', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId('fix-close'));

    expect(screen.queryByTestId('fix-close')).toBeNull();
    expect(planOn('wednesday').items).toHaveLength(1);
  });

  it('does not leave the picker mounted after use', async () => {
    // react-native-web keeps a hidden Modal's children in the DOM, so the element itself has to
    // go - otherwise a screen reader still finds the list.
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    await fireEvent.press(screen.getByTestId(`fix-into-${planOn('wednesday').id}`));

    expect(screen.queryByTestId('fix-close')).toBeNull();
    expect(screen.queryByTestId('exercise-search')).toBeNull();
  });
});

describe('what a plan card offers', () => {
  const WEEK = 7 * 86_400_000;

  /** Ages a plan by rewriting updatedAt, which is what the staleness mark reads. */
  function age(planId: string, weeks: number) {
    useStore.setState((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId ? { ...p, updatedAt: Date.now() - weeks * WEEK } : p,
      ),
    }));
  }

  it('offers Start and nothing else', async () => {
    // Edit went because tapping the card opens the editor; Copy went because it made an unnamed
    // duplicate on a day that already had a plan; Delete moved to the plan's own page.
    const id = makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId(`start-${id}`)).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Copy')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('starts the workout from the card', async () => {
    const id = makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId(`start-${id}`));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/session\//));
  });

  it('leaves a recently changed plan unmarked', async () => {
    const id = makePlan('monday', BENCH);
    await renderScreen(<PlansScreen />);
    expect(screen.queryByTestId(`replan-${id}`)).toBeNull();
  });

  it('still leaves it unmarked at three weeks', async () => {
    const id = makePlan('monday', BENCH);
    age(id, 3);
    await renderScreen(<PlansScreen />);
    expect(screen.queryByTestId(`replan-${id}`)).toBeNull();
  });

  it('marks a plan untouched for a month, and says how long', async () => {
    const id = makePlan('monday', BENCH);
    age(id, 9);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId(`replan-${id}`)).toBeTruthy();
    expect(screen.getByText(/Unchanged for 9 weeks/)).toBeTruthy();
  });

  it('opens the review page rather than changing anything', async () => {
    const id = makePlan('monday', BENCH);
    age(id, 9);
    await renderScreen(<PlansScreen />);

    const before = JSON.stringify(store().plans);
    await fireEvent.press(screen.getByTestId(`replan-${id}`));

    expect(mockRouter.push).toHaveBeenCalledWith(`/replan/${id}`);
    expect(JSON.stringify(store().plans)).toBe(before);
  });

  it('marks only the stale day when the week is a mix', async () => {
    const old = makePlan('monday', BENCH);
    const fresh = makePlan('wednesday', SQUAT);
    age(old, 9);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId(`replan-${old}`)).toBeTruthy();
    expect(screen.queryByTestId(`replan-${fresh}`)).toBeNull();
  });
});
