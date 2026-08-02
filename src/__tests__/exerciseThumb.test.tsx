import { fireEvent, render, screen } from '@testing-library/react-native';
import { getExercise, imageUrl } from '@/catalog';
import { ExerciseThumb } from '@/ui/ExerciseThumb';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';

describe('exercise thumbnail', () => {
  it('shows the first demonstration photo', async () => {
    await render(<ExerciseThumb exerciseId={BENCH} />);

    const img = screen.getByLabelText(getExercise(BENCH)!.name);
    expect(img.props.source.uri).toBe(imageUrl(getExercise(BENCH)!.images[0]));
  });

  it('falls back to the muscle initials when the photo fails to load', async () => {
    await render(<ExerciseThumb exerciseId={BENCH} />);

    // The photos come from a remote CDN, so they are simply absent offline. A hole in the row
    // would be worse than a tile that still says which muscle group this is.
    await fireEvent(screen.getByLabelText(getExercise(BENCH)!.name), 'error');
    expect(screen.getByText('CH')).toBeTruthy();
  });

  it('falls back rather than crashing on an unknown exercise', async () => {
    await render(<ExerciseThumb exerciseId="not_a_real_exercise" />);
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('honours a custom size', async () => {
    await render(<ExerciseThumb exerciseId={BENCH} size={64} />);

    const img = screen.getByLabelText(getExercise(BENCH)!.name);
    const style = Array.isArray(img.props.style) ? Object.assign({}, ...img.props.style) : img.props.style;
    expect(style.width).toBe(64);
    expect(style.height).toBe(64);
  });
});
