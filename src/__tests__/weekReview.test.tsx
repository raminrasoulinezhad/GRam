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

describe('the week review', () => {
  it('explains itself before there are any plans', async () => {
    await renderScreen(<PlansScreen />);
    expect(screen.getByTestId('week-review')).toBeTruthy();
    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('raises an issue for every group the week misses', async () => {
    makePlan('Push day', BENCH);
    await renderScreen(<PlansScreen />);

    // One chest day is not two, and nothing else is trained at all.
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
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('ignore-biceps'));

    expect(screen.queryByTestId('week-issue-biceps')).toBeNull();
    expect(store().ignoredBalanceGroups).toEqual(['biceps']);
    // Other advice is untouched.
    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
  });

  it('lists what has been dismissed rather than hiding it', async () => {
    makePlan('Push day', BENCH);
    await renderScreen(<PlansScreen />);
    await fireEvent.press(screen.getByTestId('ignore-biceps'));

    expect(screen.getByTestId('week-review-dismissed')).toBeTruthy();
  });

  it('brings dismissed advice back on a re-review', async () => {
    makePlan('Push day', BENCH);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('ignore-biceps'));
    expect(screen.queryByTestId('week-issue-biceps')).toBeNull();

    await fireEvent.press(screen.getByTestId('week-review-refresh'));
    expect(screen.getByTestId('week-issue-biceps')).toBeTruthy();
    expect(store().ignoredBalanceGroups).toEqual([]);
  });
});

describe('fixing an issue from the review', () => {
  it('offers the days that do not already train the group', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('fix-chest'));

    // Leg day is offered; Push day already has a chest exercise.
    expect(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`)).toBeTruthy();
    expect(screen.queryByTestId(`fix-into-${planNamed('Push day').id}`)).toBeNull();
  });

  it('adds the recommended exercise to the day the user picks', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    const legDay = planNamed('Leg day');
    expect(legDay.items.map((i) => i.exerciseId)).toContain(suggestionFor('chest'));
  });

  it('closes the issue it was raised for', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    expect(screen.getByTestId('week-issue-chest')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    expect(screen.queryByTestId('week-issue-chest')).toBeNull();
  });

  it('closes the picker without adding anything when cancelled', async () => {
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId('fix-close'));

    expect(screen.queryByTestId('fix-close')).toBeNull();
    expect(planNamed('Leg day').items).toHaveLength(1);
  });

  it('does not leave the picker mounted after use', async () => {
    // react-native-web keeps a hidden Modal's children in the DOM, so the element itself has to
    // go - otherwise a screen reader still finds the day list.
    makePlan('Push day', BENCH);
    makePlan('Leg day', SQUAT);
    await renderScreen(<PlansScreen />);

    await fireEvent.press(screen.getByTestId('fix-chest'));
    await fireEvent.press(screen.getByTestId(`fix-into-${planNamed('Leg day').id}`));

    expect(screen.queryByTestId('fix-close')).toBeNull();
  });
});
