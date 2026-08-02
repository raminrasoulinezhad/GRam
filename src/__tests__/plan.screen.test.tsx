import { fireEvent, screen } from '@testing-library/react-native';
import { confirmDialog, dialogOpen, renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PlanEditorScreen = require('../../app/plan/[id]').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const store = () => useStore.getState();

function makePlan(...exerciseIds: string[]) {
  const planId = store().createPlan('monday');
  for (const id of exerciseIds) store().addPlanItem(planId, id);
  mockParams = { id: planId };
  return planId;
}

const plan = () => store().plans[0];

/** Exercises are collapsed to a row by default; open one to reach its sets. */
async function openItem(index = 0) {
  await fireEvent.press(screen.getByTestId(`item-${plan().items[index].id}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  mockParams = {};
});

describe('plan editor', () => {
  it('lists the exercises and their seeded sets', async () => {
    makePlan(BENCH, SQUAT);
    await renderScreen(<PlanEditorScreen />);

    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(screen.getByText('Barbell Full Squat')).toBeTruthy();
    expect(screen.getByText(/2 exercises · 6 sets/)).toBeTruthy();

    // Collapsed by default: the summary is visible, the set fields are not.
    expect(screen.queryByTestId(/^tpl-/)).toBeNull();
  });

  it('opens an exercise to reveal its sets, and closes it again', async () => {
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    const templateId = plan().items[0].templates[0].id;
    expect(screen.queryByTestId(`tpl-${templateId}-weight`)).toBeNull();

    await openItem();
    expect(screen.getByTestId(`tpl-${templateId}-weight`)).toBeTruthy();

    await openItem();
    expect(screen.queryByTestId(`tpl-${templateId}-weight`)).toBeNull();
  });

  it('moves the plan to another day', async () => {
    const planId = makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    await fireEvent.press(screen.getByTestId('day-friday'));
    expect(store().plans.find((p) => p.id === planId)!.day).toBe('friday');
  });

  it('offers every weekday, not a name to type', async () => {
    // A plan is a day now, so there is nothing to name and nothing to get wrong.
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    for (const day of ['monday', 'wednesday', 'sunday']) {
      expect(screen.getByTestId(`day-${day}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('plan-name')).toBeNull();
  });

  it('adds a template set', async () => {
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    await openItem();
    await fireEvent.press(screen.getByTestId(`add-template-${plan().items[0].id}`));
    expect(plan().items[0].templates).toHaveLength(4);
    expect(screen.getByText(/1 exercise · 4 sets/)).toBeTruthy();
  });

  it('edits a template weight and reps', async () => {
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    await openItem();
    const templateId = plan().items[0].templates[0].id;
    await fireEvent.changeText(screen.getByTestId(`tpl-${templateId}-weight`), '100');
    await fireEvent.changeText(screen.getByTestId(`tpl-${templateId}-reps`), '3');

    expect(plan().items[0].templates[0]).toMatchObject({ weightKg: 100, reps: 3 });
  });

  it('removes an exercise from the plan', async () => {
    makePlan(BENCH, SQUAT);
    await renderScreen(<PlanEditorScreen />);

    await openItem();
    await fireEvent.press(screen.getByTestId(`remove-item-${plan().items[0].id}`));

    expect(plan().items).toHaveLength(1);
    expect(screen.queryByText('Barbell Bench Press - Medium Grip')).toBeNull();
    expect(screen.getByText('Barbell Full Squat')).toBeTruthy();
  });

  it('opens the picker scoped to this plan', async () => {
    const planId = makePlan();
    await renderScreen(<PlanEditorScreen />);

    await fireEvent.press(screen.getByTestId('add-exercise'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/picker?planId=${planId}`);
  });

  it('starts a workout from the plan', async () => {
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    await fireEvent.press(screen.getByTestId('start-plan'));

    expect(store().sessions).toHaveLength(1);
    expect(store().sessions[0].planName).toBe('Monday');
    expect(mockRouter.replace).toHaveBeenCalledWith(`/session/${store().sessions[0].id}`);
  });

  it('starts an empty plan rather than refusing', async () => {
    // Consistent with "Start an empty workout" on the Plans screen: turning up and building the
    // session as you go is normal training, and the session screen can add exercises live.
    makePlan();
    await renderScreen(<PlanEditorScreen />);

    await fireEvent.press(screen.getByTestId('start-plan'));

    expect(dialogOpen()).toBe(false);
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.stringContaining('/session/'),
    );
  });

  it('prompts to add exercises when the plan is empty', async () => {
    makePlan();
    await renderScreen(<PlanEditorScreen />);
    expect(screen.getByText('No exercises yet')).toBeTruthy();
  });

  it('renders an empty state rather than crashing on a missing plan', async () => {
    mockParams = { id: 'nope' };
    await renderScreen(<PlanEditorScreen />);
    expect(screen.getByText('Plan not found')).toBeTruthy();
  });
});
