import { EXERCISES, getExercise, searchExercises } from '@/catalog';

const ids = (query: string) => searchExercises({ query }).map((e) => e.id);
const names = (query: string) => searchExercises({ query }).map((e) => e.name);

/** Position of the first result whose name contains `needle`, or -1. */
function rankOf(query: string, needle: string): number {
  return names(query).findIndex((n) => n.toLowerCase().includes(needle.toLowerCase()));
}

describe('typing a name the way people actually type it', () => {
  it('ignores hyphens and spacing', () => {
    for (const query of ['push-up', 'push up', 'pushup', 'PushUp']) {
      expect(names(query).some((n) => n.includes('Push-Up'))).toBe(true);
    }
  });

  it('matches singular against plural and back', () => {
    expect(names('curl').some((n) => n.includes('Curls'))).toBe(true);
    expect(names('curls').some((n) => n.includes('Curl') && !n.includes('Curls'))).toBe(true);
    expect(names('crunches').some((n) => n === 'Crunches')).toBe(true);
    expect(names('crunch').some((n) => n === 'Crunches')).toBe(true);
  });

  it('forgives a typo', () => {
    expect(names('squt').some((n) => n.includes('Squat'))).toBe(true);
    expect(names('deadlfit').some((n) => n.includes('Deadlift'))).toBe(true);
    expect(names('dumbell curl').some((n) => n.includes('Dumbbell Curl'))).toBe(true);
  });

  it('understands gym shorthand', () => {
    expect(names('db curl').some((n) => n.includes('Dumbbell'))).toBe(true);
    expect(names('bb row').some((n) => n.includes('Barbell'))).toBe(true);
    expect(names('rdl').some((n) => n.includes('Romanian Deadlift'))).toBe(true);
    expect(names('ohp').length).toBeGreaterThan(0);
  });

  it('does not care about word order', () => {
    expect(new Set(ids('bench barbell'))).toEqual(new Set(ids('barbell bench')));
  });

  it('is case insensitive and ignores surrounding whitespace', () => {
    expect(ids('  SQUAT ')).toEqual(ids('squat'));
  });

  it('still requires every term to match something', () => {
    // A stray word should narrow the results, not be quietly ignored.
    expect(searchExercises({ query: 'squat zzzzzzzz' })).toEqual([]);
  });

  it('returns an empty array rather than throwing on nonsense', () => {
    expect(searchExercises({ query: 'zzzzzzzz' })).toEqual([]);
  });
});

describe('searching by muscle', () => {
  it('finds exercises that train a muscle, not only ones named after it', () => {
    const results = searchExercises({ query: 'hamstrings' });
    // Nothing in the catalog is called "hamstring curl", but plenty train them.
    expect(results.length).toBeGreaterThan(20);
    for (const e of results) {
      const trains = [...e.primaryMuscles, ...e.secondaryMuscles].includes('hamstrings');
      expect(trains || e.name.toLowerCase().includes('hamstring')).toBe(true);
    }
  });

  it('accepts the names lifters use', () => {
    for (const [slang, muscle] of [
      ['abs', 'abdominals'],
      ['quads', 'quadriceps'],
      ['bicep', 'biceps'],
      ['tris', 'triceps'],
      ['pecs', 'chest'],
      ['delts', 'shoulders'],
      ['glutes', 'glutes'],
      ['calf', 'calves'],
    ] as const) {
      const results = searchExercises({ query: slang });
      expect(results.length).toBeGreaterThan(0);
      const share = results.filter((e) =>
        [...e.primaryMuscles, ...e.secondaryMuscles].includes(muscle),
      ).length;
      // Allow a few name-only hits alongside, but the muscle must dominate.
      expect(share / results.length).toBeGreaterThan(0.8);
    }
  });

  it('puts exercises named for the muscle above ones that merely use it', () => {
    // Below the two recommended picks, which lead a muscle search by design - see
    // recommended.test.ts. This is about the relevance ordering of everything after them.
    const results = searchExercises({ query: 'chest' }).slice(2);
    const named = (e: (typeof results)[number]) => e.name.toLowerCase().includes('chest');
    const first = results.findIndex(named);
    const primaryOnly = results.findIndex((e) => !named(e) && e.primaryMuscles.includes('chest'));
    const secondaryOnly = results.findIndex((e) => !named(e) && e.secondaryMuscles.includes('chest'));
    expect(first).toBeLessThan(primaryOnly);
    expect(primaryOnly).toBeLessThan(secondaryOnly);
  });

  it('combines a muscle word with a kit word', () => {
    const results = searchExercises({ query: 'dumbbell shoulders' });
    expect(results.length).toBeGreaterThan(0);
    for (const e of results) {
      // "dumbbell" may match the name or the equipment field - Cuban Press is a dumbbell
      // exercise that does not say so in its name, and a lifter still means it.
      expect(e.name.toLowerCase().includes('dumbbell') || e.equipment === 'dumbbell').toBe(true);
      const shoulders =
        [...e.primaryMuscles, ...e.secondaryMuscles].includes('shoulders') ||
        e.name.toLowerCase().includes('shoulder');
      expect(shoulders).toBe(true);
    }
  });

  it('reaches a muscle group through a body-part word', () => {
    expect(searchExercises({ query: 'legs' }).length).toBeGreaterThan(50);
    expect(searchExercises({ query: 'arms curl' }).length).toBeGreaterThan(0);
  });

  it('still supports the muscle filter chips alongside the text box', () => {
    const results = searchExercises({ query: 'press', muscle: 'triceps' });
    expect(results.length).toBeGreaterThan(0);
    for (const e of results) {
      expect([...e.primaryMuscles, ...e.secondaryMuscles]).toContain('triceps');
    }
  });
});

describe('ranking', () => {
  it('leads with the exercise whose name is the query', () => {
    expect(names('crunches')[0]).toBe('Crunches');
    expect(names('plank')[0]).toBe('Plank');
  });

  it('prefers a name that starts with what was typed', () => {
    // "Bench Press - Powerlifting" should beat "Decline Barbell Bench Press".
    for (const name of names('bench press').slice(0, 3)) {
      expect(name.toLowerCase().startsWith('bench press')).toBe(true);
    }
  });

  it('prefers the plainer of two matching names', () => {
    expect(rankOf('cable crunch', 'Cable Crunch')).toBeLessThan(
      rankOf('cable crunch', 'Bosu Ball Cable Crunch'),
    );
  });

  it('puts an exact word above a typo correction', () => {
    const r = names('squat');
    expect(r[0].toLowerCase()).toContain('squat');
  });

  it('falls back to alphabetical order when there is no query', () => {
    const all = searchExercises({});
    expect(all.length).toBe(EXERCISES.length);
    expect(all.map((e) => e.name)).toEqual([...all.map((e) => e.name)].sort((a, b) => a.localeCompare(b)));
  });
});

describe('the exercises the dataset was missing', () => {
  it('finds an incline walk', () => {
    for (const query of ['incline walk', 'inclined walk', 'walk incline', 'uphill']) {
      const found = names(query).includes('Incline Walk, Treadmill');
      // "uphill" is not in the name, so only the first three must hit it directly.
      if (query !== 'uphill') expect([query, found]).toEqual([query, true]);
    }
  });

  it('records it as time and distance, and trains the posterior chain', () => {
    const walk = getExercise('FitRam_Incline_Walk_Treadmill')!;
    expect(walk.kind).toBe('distance_time');
    expect(walk.primaryMuscles).toContain('glutes');
    expect(walk.category).toBe('cardio');
  });

  it('adds the other everyday conditioning the dataset lacks', () => {
    for (const query of ['hiking', 'swimming', 'rucking', 'fan bike', 'battle ropes']) {
      expect([query, searchExercises({ query }).length > 0]).toEqual([query, true]);
    }
  });

  it('times battle ropes rather than asking for a distance', () => {
    expect(getExercise('FitRam_Battle_Ropes')!.kind).toBe('time');
  });

  it('writes instructions for every one of them, since there are no photos', () => {
    for (const e of EXERCISES.filter((x) => x.id.startsWith('FitRam_'))) {
      expect(e.images).toEqual([]);
      expect(e.instructions.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('performance', () => {
  // A phone has 16ms to draw a frame. Search runs on the same thread as the keystroke that
  // triggered it, so these budgets are generous multiples of what was measured (~1.3ms and
  // ~2.9ms per pass) and exist to catch a regression, not to certify a number.
  it('stays fast enough for search-as-you-type', () => {
    const queries = ['b', 'be', 'ben', 'benc', 'bench', 'bench p', 'chest', 'press', 'legs'];
    const start = Date.now();
    for (let i = 0; i < 20; i++) for (const q of queries) searchExercises({ query: q });
    expect(Date.now() - start).toBeLessThan(900); // 180 passes
  });

  it('stays fast even when every term has to be typo-corrected', () => {
    // The expensive path: nothing matches literally, so the whole catalog gets fuzzy-matched.
    const start = Date.now();
    for (let i = 0; i < 20; i++) searchExercises({ query: 'dumbell squt' });
    expect(Date.now() - start).toBeLessThan(400); // 20 passes
  });
});
