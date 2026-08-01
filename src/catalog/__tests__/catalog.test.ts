import {
  CATEGORIES,
  EQUIPMENT,
  EXERCISES,
  LEVELS,
  MUSCLES,
  getExercise,
  exerciseName,
  imageUrl,
  searchExercises,
} from '@/catalog';

describe('bundled catalog integrity', () => {
  it('ships the full dataset', () => {
    expect(EXERCISES.length).toBe(873);
  });

  it('has unique ids and names', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(EXERCISES.map((e) => e.name)).size).toBe(EXERCISES.length);
  });

  it('only uses known enum values', () => {
    for (const e of EXERCISES) {
      expect(CATEGORIES).toContain(e.category);
      expect(LEVELS).toContain(e.level);
      if (e.equipment !== null) expect(EQUIPMENT).toContain(e.equipment);
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
        expect(MUSCLES).toContain(m);
      }
    }
  });

  it('gives every exercise at least one primary muscle', () => {
    const orphans = EXERCISES.filter((e) => e.primaryMuscles.length === 0);
    expect(orphans).toEqual([]);
  });

  it('gives every exercise a set kind and demo images', () => {
    for (const e of EXERCISES) {
      expect(['weight_reps', 'reps', 'time', 'distance_time']).toContain(e.kind);
      expect(e.images.length).toBeGreaterThan(0);
    }
  });

  it('never lists a muscle as both primary and secondary', () => {
    for (const e of EXERCISES) {
      const overlap = e.primaryMuscles.filter((m) => e.secondaryMuscles.includes(m));
      expect(overlap).toEqual([]);
    }
  });

  it('resolves image paths to the upstream CDN', () => {
    expect(imageUrl('Barbell_Curl/0.jpg')).toBe(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg',
    );
  });
});

describe('lookup', () => {
  it('finds a known exercise by id', () => {
    const bench = getExercise('Barbell_Bench_Press_-_Medium_Grip');
    expect(bench?.primaryMuscles).toContain('chest');
    expect(bench?.kind).toBe('weight_reps');
  });

  it('degrades gracefully for a missing id', () => {
    expect(getExercise('does_not_exist')).toBeUndefined();
    expect(exerciseName('does_not_exist')).toBe('Unknown exercise');
  });
});

describe('searchExercises', () => {
  it('returns everything with no filters', () => {
    expect(searchExercises({}).length).toBe(EXERCISES.length);
  });

  it('matches all search terms regardless of order', () => {
    const a = searchExercises({ query: 'barbell curl' });
    const b = searchExercises({ query: 'curl barbell' });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    expect(a.length).toBeGreaterThan(0);
    for (const e of a) {
      expect(e.name.toLowerCase()).toContain('barbell');
      expect(e.name.toLowerCase()).toContain('curl');
    }
  });

  it('is case insensitive and ignores surrounding whitespace', () => {
    expect(searchExercises({ query: '  SQUAT ' }).length).toBe(
      searchExercises({ query: 'squat' }).length,
    );
  });

  it('matches a muscle as primary OR secondary', () => {
    const results = searchExercises({ muscle: 'triceps' });
    const bench = results.find((e) => e.id === 'Barbell_Bench_Press_-_Medium_Grip');
    // Bench press is a chest exercise that assists triceps - a lifter expects it here.
    expect(bench).toBeDefined();
    for (const e of results) {
      expect([...e.primaryMuscles, ...e.secondaryMuscles]).toContain('triceps');
    }
  });

  it('intersects filters rather than unioning them', () => {
    const results = searchExercises({ muscle: 'chest', equipment: 'dumbbell', level: 'beginner' });
    expect(results.length).toBeGreaterThan(0);
    for (const e of results) {
      expect(e.equipment).toBe('dumbbell');
      expect(e.level).toBe('beginner');
      expect([...e.primaryMuscles, ...e.secondaryMuscles]).toContain('chest');
    }
  });

  it('returns an empty array rather than throwing on no match', () => {
    expect(searchExercises({ query: 'zzzzzzz' })).toEqual([]);
  });

  it('stays fast enough for search-as-you-type', () => {
    const start = Date.now();
    for (let i = 0; i < 50; i++) searchExercises({ query: 'press', muscle: 'chest' });
    // 50 full passes over 873 exercises; a single keystroke must be far under a frame.
    expect(Date.now() - start).toBeLessThan(500);
  });
});
