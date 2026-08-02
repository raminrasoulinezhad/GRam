import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { ExerciseSheetProvider } from '@/ui/ExerciseSheet';
import { ExerciseList } from '@/ui/ExerciseList';
import { ExerciseThumb } from '@/ui/ExerciseThumb';

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
const store = () => useStore.getState();

/**
 * Every control nested inside another control, as "outer > inner" paths.
 *
 * react-native-web turns a Pressable into a <button>, so a Pressable inside a Pressable is a
 * <button> inside a <button>. That is invalid HTML, it breaks hydration, and a screen reader
 * announces two overlapping controls with no boundary between them - the user cannot tell where
 * one ends and the next begins, and on iOS VoiceOver the inner one may be unreachable entirely.
 *
 * The rule this enforces: press targets are siblings, never nested.
 */
function nestedControls(node: unknown, ancestor: string | null = null): string[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((n) => nestedControls(n, ancestor));

  const el = node as ReactTestRendererJSON;
  const props = (el.props ?? {}) as Record<string, unknown>;
  const isControl = props.accessibilityRole === 'button' || props.role === 'button';
  const label = String(props.testID ?? props.accessibilityLabel ?? el.type ?? '?');

  const found: string[] = [];
  if (isControl && ancestor !== null) found.push(`${ancestor} > ${label}`);

  const nextAncestor = isControl ? label : ancestor;
  for (const child of el.children ?? []) found.push(...nestedControls(child, nextAncestor));
  return found;
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  mockParams = {};
});

describe('no control is nested inside another', () => {
  it('holds for the exercise list', async () => {
    await renderScreen(<ExerciseList onSelect={jest.fn()} />);
    expect(nestedControls(screen.toJSON())).toEqual([]);
  });

  it('holds for the exercise list inside a sheet provider', async () => {
    // The thumbnail only becomes a control when there is a sheet for it to open, so this is
    // the arrangement that actually regresses.
    await render(
      <ExerciseSheetProvider>
        <ExerciseList onSelect={jest.fn()} />
      </ExerciseSheetProvider>,
    );
    expect(nestedControls(screen.toJSON())).toEqual([]);
  });

  it('holds for the plan editor, collapsed and expanded', async () => {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    mockParams = { id: planId };

    await renderScreen(<PlanEditorScreen />);
    expect(nestedControls(screen.toJSON())).toEqual([]);

    await fireEvent.press(screen.getByTestId(`item-${store().plans[0].items[0].id}`));
    expect(nestedControls(screen.toJSON())).toEqual([]);
  });

  it('would catch the regression it was written for', async () => {
    // Guards the guard: a deliberately nested pair must be reported, otherwise the assertions
    // above would pass for the wrong reason.
    const { Pressable, Text } = require('react-native');
    await render(
      <Pressable accessibilityRole="button" testID="outer">
        <Pressable accessibilityRole="button" testID="inner">
          <Text>x</Text>
        </Pressable>
      </Pressable>,
    );
    expect(nestedControls(screen.toJSON())).toEqual(['outer > inner']);
  });
});

describe('the thumbnail is only a control when it does something', () => {
  it('is a button inside a sheet provider', async () => {
    await render(
      <ExerciseSheetProvider>
        <ExerciseThumb exerciseId={BENCH} />
      </ExerciseSheetProvider>,
    );
    const thumb = screen.getByTestId(`thumb-${BENCH}`);
    expect(thumb.props.accessibilityRole).toBe('button');
    expect(thumb.props.accessibilityLabel).toMatch(/Open description$/);
  });

  it('is a picture outside one, not a disabled button', async () => {
    // A disabled Pressable still renders a <button>: it holds a place in the tab order and is
    // announced as a control, for a control that cannot do anything.
    await render(<ExerciseThumb exerciseId={BENCH} />);
    const thumb = screen.getByTestId(`thumb-${BENCH}`);
    expect(thumb.props.accessibilityRole).toBe('image');
    expect(thumb.props.accessibilityLabel).not.toMatch(/Open description/);
    expect(thumb.props.focusable).toBeFalsy();
  });
});

describe('both press targets still work', () => {
  /** The list virtualises, so narrow it until the row under test is actually mounted. */
  const listShowing = async (onSelect: () => void) => {
    await render(
      <ExerciseSheetProvider>
        <ExerciseList onSelect={onSelect} />
      </ExerciseSheetProvider>,
    );
    await fireEvent.changeText(screen.getByTestId('exercise-search'), 'barbell bench press');
  };

  it('selects the exercise from the row', async () => {
    const onSelect = jest.fn();
    await listShowing(onSelect);

    await fireEvent.press(screen.getByTestId(`exercise-${BENCH}`));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: BENCH }));
    // The row does not open the description.
    expect(screen.queryByTestId('exercise-sheet-close')).toBeNull();
  });

  it('opens the description from the picture', async () => {
    const onSelect = jest.fn();
    await listShowing(onSelect);

    await fireEvent.press(screen.getByTestId(`thumb-${BENCH}`));
    expect(screen.getByTestId('exercise-sheet-close')).toBeTruthy();
    // Opening the description does not also select the exercise.
    expect(onSelect).not.toHaveBeenCalled();
  });
});
