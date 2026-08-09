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

  it('keeps the whole week on one row', async () => {
    /*
     * Seven chips, no wrapping. A week split across two lines reads as a five-day week with an
     * afterthought, and this row is the one place the shape of the week is visible at a glance.
     * Compact padding is what buys the space; without it Sunday dropped to a line of its own.
     */
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    const row = screen.getByTestId('day-monday').parent;
    const style = Object.assign({}, ...[row?.props.style].flat(Infinity).filter(Boolean));
    expect(style.flexDirection).toBe('row');
    expect(style.flexWrap).toBeUndefined();
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
    // Kilograms, so the number typed is the number stored - see the note in session.screen.test.
    store().updateSettings({ unit: 'kg' });
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

describe('deleting the plan from its own page', () => {
  it('offers the delete at the bottom, not on the week screen', async () => {
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);
    expect(screen.getByTestId('delete-plan')).toBeTruthy();
  });

  it('asks first, and does nothing if you decline', async () => {
    makePlan(BENCH, SQUAT);
    await renderScreen(<PlanEditorScreen />);

    await fireEvent.press(screen.getByTestId('delete-plan'));
    expect(dialogOpen()).toBe(true);
    await cancelDialog();

    expect(store().plans).toHaveLength(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('names the day and counts what goes with it', async () => {
    // "Delete this plan?" tells you nothing. Which day, and how much work, is the whole basis
    // for answering.
    makePlan(BENCH, SQUAT);
    await renderScreen(<PlanEditorScreen />);
    await fireEvent.press(screen.getByTestId('delete-plan'));

    expect(screen.getByText('Delete Monday?')).toBeTruthy();
    expect(screen.getByText(/2 exercises will be removed/)).toBeTruthy();
  });

  it('words an empty plan differently, because there is nothing to count', async () => {
    makePlan();
    await renderScreen(<PlanEditorScreen />);
    await fireEvent.press(screen.getByTestId('delete-plan'));

    expect(screen.getByText('This day will be removed from your week.')).toBeTruthy();
  });

  it('deletes on confirmation and leaves the page behind', async () => {
    // replace, not push: the page it was on no longer describes anything, and going "back" to a
    // deleted plan is a dead end.
    makePlan(BENCH);
    await renderScreen(<PlanEditorScreen />);

    await fireEvent.press(screen.getByTestId('delete-plan'));
    await confirmDialog();

    expect(store().plans).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('keeps the workouts already recorded from it', async () => {
    // The plan is a template. Deleting it must never touch the training you actually did - that
    // is the one rule the whole app is built around.
    const planId = makePlan(BENCH);
    const sessionId = store().startSession(planId)!;
    const session = store().sessions.find((s) => s.id === sessionId)!;
    for (const entry of session.entries) {
      for (const set of entry.sets) store().toggleSetLogged(sessionId, entry.id, set.id);
    }
    store().endSession(sessionId);

    await renderScreen(<PlanEditorScreen />);
    await fireEvent.press(screen.getByTestId('delete-plan'));
    await confirmDialog();

    expect(store().plans).toHaveLength(0);
    expect(store().sessions).toHaveLength(1);
    expect(store().sessions[0].entries[0].sets.every((s) => s.loggedAt !== null)).toBe(true);
  });
});
