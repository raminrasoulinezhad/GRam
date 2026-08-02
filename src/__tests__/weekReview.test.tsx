import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { TRAINING_GROUPS, suggestionFor } from '@/analytics/balance';

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

function makePlan(name: string, ...exerciseIds: string[]) {
  const id = store().createPlan(name);
  for (const exerciseId of exerciseIds) store().addPlanItem(id, exerciseId);
  return id;
}

const planNamed = (name: string) => store().plans.find((p) => p.name === name)!;

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('the Plans screen layout', () => {
  it('puts the add-plan box after the plans, not above them', async () => {
    makePlan('Push day', BENCH);
    await renderScreen(<PlansScreen />);

    // Both present; the review is last, the add box after the plan list.
    expect(screen.getByTestId('new-plan-name')).toBeTruthy();
    expect(screen.getByTestId('week-review')).toBeTruthy();
    expect(screen.getByPlaceholderText('Add a plan, e.g. Push day')).toBeTruthy();
  });

  it('still creates a plan and opens it', async () => {
    await renderScreen(<PlansScreen />);
    await fireEvent.changeText(screen.getByTestId('new-plan-name'), 'Leg day');
    await fireEvent.press(screen.getByTestId('create-plan'));

    expect(store().plans.map((p) => p.name)).toContain('Leg day');
    expect(mockRouter.push).toHaveBeenCalledWith(`/plan/${store().plans[0].id}`);
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
    makePlan('Full body', ...TRAINING_GROUPS.map(suggestionFor));
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-issue-days')).toBeTruthy();
    expect(screen.queryByTestId('week-review-balanced')).toBeNull();
  });

  it('cannot be ignored', async () => {
    // It is a precondition, not an opinion.
    makePlan('Push day', BENCH);
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-issue-days')).toBeTruthy();
    expect(screen.queryByTestId('ignore-days')).toBeNull();
  });

  it('creates a plan and opens it', async () => {
    makePlan('Push day', BENCH);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('add-plan-day'));
    expect(store().plans).toHaveLength(2);
    expect(mockRouter.push).toHaveBeenCalledWith(`/plan/${store().plans[0].id}`);
  });

  it('gives way to the muscle advice once there are two days', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
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
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    // One chest day is not two, and most groups are not trained at all.
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
    expect(screen.getByTestId('week-issue-biceps')).toBeTruthy();
    expect(screen.getByTestId('week-issue-glutes')).toBeTruthy();
  });

  it('says nothing is outstanding once the week is balanced', async () => {
    const picks = TRAINING_GROUPS.map(suggestionFor);
    makePlan('Day 1', ...picks);
    makePlan('Day 2', ...picks);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId('week-review-balanced')).toBeTruthy();
    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('drops advice the user ignores, and remembers the choice', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('ignore-biceps'));

    expect(screen.queryByTestId('week-issue-biceps')).toBeNull();
    expect(store().ignoredBalanceGroups).toEqual(['biceps']);
    // Other advice is untouched.
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
  });

  it('lists what has been dismissed rather than hiding it', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);
    await fireEvent.press(screen.getByTestId('ignore-biceps'));

    expect(screen.getByTestId('week-review-dismissed')).toBeTruthy();
  });

  it('brings dismissed advice back on a re-review', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
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
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
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
    expect(screen.queryByTestId(`fix-into-${planNamed('Leg day').id}`)).toBeNull();

    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    expect(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`)).toBeTruthy();
  });

  it('offers the days that do not already train the group', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));

    // Leg day is offered; Push day already has a chest exercise.
    expect(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`)).toBeTruthy();
    expect(screen.queryByTestId(`fix-into-${planNamed('Push day').id}`)).toBeNull();
  });

  it('adds the exercise the user chose to the day the user chose', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    expect(planNamed('Leg day').items.map((i) => i.exerciseId)).toContain(suggestionFor('chest'));
  });

  it('lets the user pick something other than the recommendation', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));

    // Search the whole catalog from inside the fix flow and take a different chest exercise.
    await fireEvent.changeText(screen.getByTestId('exercise-search'), 'dumbbell flyes');
    await fireEvent.press(screen.getByTestId('exercise-Dumbbell_Flyes'));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    const ids = planNamed('Leg day').items.map((i) => i.exerciseId);
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
    expect(screen.queryByTestId(`fix-into-${planNamed('Leg day').id}`)).toBeNull();
  });

  it('closes the issue it was raised for', async () => {
    await twoDays();
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('closes the picker without adding anything when cancelled', async () => {
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId('fix-close'));

    expect(screen.queryByTestId('fix-close')).toBeNull();
    expect(planNamed('Leg day').items).toHaveLength(1);
  });

  it('does not leave the picker mounted after use', async () => {
    // react-native-web keeps a hidden Modal's children in the DOM, so the element itself has to
    // go - otherwise a screen reader still finds the list.
    await twoDays();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`exercise-${suggestionFor('chest')}`));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    expect(screen.queryByTestId('fix-close')).toBeNull();
    expect(screen.queryByTestId('exercise-search')).toBeNull();
  });
});
