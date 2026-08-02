import { fireEvent, render, screen } from '@testing-library/react-native';
import { getExercise } from '@/catalog';
import { ExerciseSheetProvider } from '@/ui/ExerciseSheet';
import { ExerciseThumb } from '@/ui/ExerciseThumb';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const NAME = getExercise(BENCH)!.name;

const renderThumb = () =>
  render(
    <ExerciseSheetProvider>
      <ExerciseThumb exerciseId={BENCH} />
    </ExerciseSheetProvider>,
  );

describe('exercise description sheet', () => {
  it('is closed until the picture is tapped', async () => {
    await renderThumb();
    expect(screen.queryByTestId('exercise-sheet-close')).toBeNull();
  });

  it('opens the full description from the thumbnail', async () => {
    await renderThumb();
    await fireEvent.press(screen.getByTestId(`thumb-${BENCH}`));

    expect(screen.getByTestId('exercise-sheet-close')).toBeTruthy();
    // The same content the full page shows.
    expect(screen.getByText('How to')).toBeTruthy();
    expect(screen.getByText('Muscles involved')).toBeTruthy();
  });

  it('closes again from the close button', async () => {
    await renderThumb();
    await fireEvent.press(screen.getByTestId(`thumb-${BENCH}`));
    await fireEvent.press(screen.getByTestId('exercise-sheet-close'));

    expect(screen.queryByTestId('exercise-sheet-close')).toBeNull();
    expect(screen.queryByText('How to')).toBeNull();
  });

  it('can be reopened after closing', async () => {
    await renderThumb();
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(screen.getByTestId(`thumb-${BENCH}`));
      expect(screen.getByTestId('exercise-sheet-close')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('exercise-sheet-close'));
    }
    expect(screen.queryByTestId('exercise-sheet-close')).toBeNull();
  });

  it('tells a screen reader the picture opens something', async () => {
    await renderThumb();
    expect(screen.getByLabelText(`${NAME}, works chest. Open description`)).toBeTruthy();
  });

  it('renders as a plain image outside the provider rather than crashing', async () => {
    // A thumbnail must still work in a context that has no sheet, e.g. a test or a snapshot.
    await render(<ExerciseThumb exerciseId={BENCH} />);
    expect(screen.getByLabelText(`${NAME}, works chest`)).toBeTruthy();
  });
});
