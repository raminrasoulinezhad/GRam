import { fireEvent, render, screen } from '@testing-library/react-native';
import { EXERCISES, getExercise } from '@/catalog';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

/*
 * Required, not imported. An `import` is hoisted above the `const mockRouter` above it, so the
 * mock factory would run while that binding is still undefined and every component under test
 * would capture `router: undefined`. The other screen tests do the same for the same reason.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ExerciseDetail } = require('@/ui/ExerciseDetail');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MuscleScreen = require('../../app/muscle/[muscle]').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { muscleFromParam } = require('../../app/muscle/[muscle]');

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';

/**
 * Tapping a muscle tag.
 *
 * A tag used to be a label you could only read. It is the shortest question anyone has about an
 * exercise - what else works this? - and the answer was two taps and a search box away.
 */

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('the tags on an exercise', () => {
  it('opens that muscle from the primary row', async () => {
    await render(<ExerciseDetail exerciseId={BENCH} />);
    await fireEvent.press(screen.getByTestId('muscle-link-chest'));

    expect(mockRouter.push).toHaveBeenCalledWith('/muscle/chest');
  });

  it('opens it from the secondary row too', async () => {
    // Asking from the assistance row is still asking what trains it.
    await render(<ExerciseDetail exerciseId={BENCH} />);
    await fireEvent.press(screen.getByTestId('muscle-link-triceps'));

    expect(mockRouter.push).toHaveBeenCalledWith('/muscle/triceps');
  });

  it('escapes the two muscle names that contain a space', async () => {
    // A raw space in a path is not a path. "middle back" is one of exactly two like this.
    const rowing = EXERCISES.find((e) => e.primaryMuscles.includes('middle back'))!;
    await render(<ExerciseDetail exerciseId={rowing.id} />);
    await fireEvent.press(screen.getByTestId('muscle-link-middle back'));

    expect(mockRouter.push).toHaveBeenCalledWith('/muscle/middle%20back');
  });

  it('closes the sheet before navigating, when it is in one', async () => {
    /*
     * The sheet renders above the navigator. Without this the page opens behind a sheet still
     * covering the whole screen, and the app looks frozen.
     */
    const onLeave = jest.fn();
    await render(<ExerciseDetail exerciseId={BENCH} onLeave={onLeave} />);
    await fireEvent.press(screen.getByTestId('muscle-link-chest'));

    expect(onLeave).toHaveBeenCalled();
  });

  it('does not need an onLeave to work on the full page', async () => {
    await render(<ExerciseDetail exerciseId={BENCH} />);
    await fireEvent.press(screen.getByTestId('muscle-link-chest'));
    expect(mockRouter.push).toHaveBeenCalled();
  });
});

describe('the page a tag opens', () => {
  it('lists only exercises the muscle is the target of', async () => {
    mockParams = { muscle: 'chest' };
    await render(<MuscleScreen />);

    /*
     * The point of the page. A text search for "chest" answers with the two hundred movements
     * that involve it somewhere - the overhead press, the dip, half the catalog. Someone who
     * tapped the tag asked the narrower question.
     */
    const targeted = EXERCISES.filter((e) => e.primaryMuscles.includes('chest')).length;
    const involved = EXERCISES.filter(
      (e) => e.primaryMuscles.includes('chest') || e.secondaryMuscles.includes('chest'),
    ).length;
    expect(involved).toBeGreaterThan(targeted);

    // The count line the list prints. Recommended picks can be pulled in from another muscle,
    // so this is a floor rather than an equality - what matters is it is nowhere near `involved`.
    expect(screen.getByText(new RegExp(`^${targeted} exercises$`))).toBeTruthy();
  });

  it('names the muscle at the top', async () => {
    mockParams = { muscle: 'biceps' };
    await render(<MuscleScreen />);
    expect(screen.getAllByText('Biceps').length).toBeGreaterThan(0);
  });

  it('drops the group filter chips, having already been asked', async () => {
    mockParams = { muscle: 'chest' };
    await render(<MuscleScreen />);
    expect(screen.queryByTestId('muscle-all')).toBeNull();
    expect(screen.queryByTestId('muscle-Chest')).toBeNull();
  });

  it('still lets you search inside it', async () => {
    mockParams = { muscle: 'chest' };
    await render(<MuscleScreen />);
    expect(screen.getByTestId('exercise-search')).toBeTruthy();
  });

  it('opens an exercise from a row', async () => {
    mockParams = { muscle: 'chest' };
    await render(<MuscleScreen />);
    await fireEvent.changeText(screen.getByTestId('exercise-search'), getExercise(BENCH)!.name);
    await fireEvent.press(screen.getByTestId(`exercise-${BENCH}`));

    expect(mockRouter.push).toHaveBeenCalledWith(`/exercise/${BENCH}`);
  });

  it('says so rather than crashing on a muscle that does not exist', async () => {
    mockParams = { muscle: 'spleen' };
    await render(<MuscleScreen />);
    expect(screen.getByText('No such muscle')).toBeTruthy();
  });
});

describe('reading the muscle out of the route', () => {
  it('accepts a plain name and a percent-encoded one alike', () => {
    // Which one arrives depends on the navigator, and both have to work.
    expect(muscleFromParam('chest')).toBe('chest');
    expect(muscleFromParam('middle%20back')).toBe('middle back');
    expect(muscleFromParam('middle back')).toBe('middle back');
  });

  it('refuses anything the catalog does not file exercises under', () => {
    expect(muscleFromParam('spleen')).toBeNull();
    expect(muscleFromParam(undefined)).toBeNull();
    // Malformed input throws inside decodeURIComponent; it must not reach the screen.
    expect(muscleFromParam('%E0%A4%A')).toBeNull();
  });
});
