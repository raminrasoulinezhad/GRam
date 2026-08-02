import { render, screen } from '@testing-library/react-native';
import { getExercise, MUSCLES } from '@/catalog';
import { ExerciseThumb } from '@/ui/ExerciseThumb';
import { MUSCLE_VIEW, REGIONS } from '@/ui/MuscleGlyph';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';

describe('exercise thumbnail', () => {
  it('labels the row with the exercise and the muscle it works', async () => {
    await render(<ExerciseThumb exerciseId={BENCH} />);
    expect(screen.getByLabelText(`${getExercise(BENCH)!.name}, works chest`)).toBeTruthy();
  });

  it('renders without a network request of any kind', async () => {
    const { toJSON } = await render(<ExerciseThumb exerciseId={BENCH} />);
    // Nothing in the tree may reference a remote host: the glyph is drawn, not fetched.
    expect(JSON.stringify(toJSON())).not.toContain('http');
  });

  it('degrades to a plain body rather than crashing on an unknown exercise', async () => {
    await render(<ExerciseThumb exerciseId="not_a_real_exercise" />);
    expect(screen.getByLabelText('Unknown exercise')).toBeTruthy();
  });
});

describe('muscle glyph', () => {
  // react-native-svg renders to null under jest, so the invariants worth protecting are the
  // data ones: a muscle with no region would draw a blank silhouette and silently say nothing.
  it('has a drawn region for every muscle in the catalog', () => {
    expect(Object.keys(REGIONS).sort()).toEqual([...MUSCLES].sort());
    for (const muscle of MUSCLES) {
      expect(REGIONS[muscle].length).toBeGreaterThan(0);
    }
  });

  it('places every muscle on a front or back view', () => {
    expect(Object.keys(MUSCLE_VIEW).sort()).toEqual([...MUSCLES].sort());
    for (const muscle of MUSCLES) {
      expect(['front', 'back']).toContain(MUSCLE_VIEW[muscle]);
    }
  });

  it('draws back muscles on the back view, where you could actually see them', () => {
    for (const muscle of ['lats', 'traps', 'glutes', 'hamstrings', 'lower back', 'middle back'] as const) {
      expect(MUSCLE_VIEW[muscle]).toBe('back');
    }
    for (const muscle of ['chest', 'abdominals', 'quadriceps', 'biceps'] as const) {
      expect(MUSCLE_VIEW[muscle]).toBe('front');
    }
  });

  it('keeps every shape inside the 100x164 viewBox', () => {
    // A stray coordinate would clip against the tile edge and look like a rendering bug.
    for (const muscle of MUSCLES) {
      for (const d of REGIONS[muscle]) {
        for (const n of d.match(/-?\d+(\.\d+)?/g) ?? []) {
          expect(Math.abs(Number(n))).toBeLessThanOrEqual(164);
        }
      }
    }
  });
});
