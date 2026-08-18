import pkg from '../../../package.json';
import appJson from '../../../app.json';
import {
  ALL_RECOMMENDED_IDS,
  MUSCLES,
  RECOMMENDED,
  RECOMMENDED_REVIEWED_FOR,
  RECOMMENDED_REVIEWED_ON,
  focusMuscles,
  getExercise,
  recommendedRanks,
  searchExercises,
  muscleTermsIn,
} from '@/catalog';

describe('the recommendation list is real', () => {
  it('names two exercises for every muscle in the catalog', () => {
    for (const muscle of MUSCLES) {
      expect(RECOMMENDED[muscle]).toHaveLength(2);
    }
    expect(Object.keys(RECOMMENDED).sort()).toEqual([...MUSCLES].sort());
  });

  it('points only at exercises that exist', () => {
    const missing = ALL_RECOMMENDED_IDS.filter((id) => getExercise(id) === undefined);
    expect(missing).toEqual([]);
  });

  it('recommends nothing for a muscle it does not train', () => {
    // The whole mechanism is dead if a pick cannot appear in that muscle's results.
    for (const muscle of MUSCLES) {
      for (const id of RECOMMENDED[muscle]) {
        const e = getExercise(id)!;
        expect([id, [...e.primaryMuscles, ...e.secondaryMuscles].includes(muscle)]).toEqual([
          id,
          true,
        ]);
      }
    }
  });

  it('does not recommend a stretch or a mobility drill as training', () => {
    for (const id of ALL_RECOMMENDED_IDS) {
      expect([id, getExercise(id)!.category]).not.toEqual([id, 'stretching']);
    }
  });

  it('does not name the same exercise twice for one muscle', () => {
    for (const muscle of MUSCLES) {
      expect(new Set(RECOMMENDED[muscle]).size).toBe(2);
    }
  });
});

describe('the review stamp', () => {
  /*
   * A record, not a gate.
   *
   * This used to fail the build unless RECOMMENDED_REVIEWED_FOR matched the minor series in
   * package.json, so no feature release could ship without redoing the research or consciously
   * re-stamping it. That is off by decision: the review is optional from 1.9.4 on.
   *
   * The stamp stays because it is the only thing that says how old this judgement is, and
   * anyone opening the file deserves to know whether they are reading 2026 or 2031. What is
   * gone is the release-blocking, which had started producing re-stamps a day apart that
   * established nothing - see the 1.5-to-1.8 note in recommended.ts.
   */
  it('is stamped as a minor series rather than a full version', () => {
    expect(RECOMMENDED_REVIEWED_FOR).toMatch(/^\d+\.\d+$/);
  });

  it('records when the review happened', () => {
    expect(RECOMMENDED_REVIEWED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is not stamped for a release that has not happened yet', () => {
    // The one direction still worth catching. Behind is fine and expected; ahead means a typo,
    // and a stamp claiming a future review is worse than an old one.
    const [major, minor] = pkg.version.split('.').map(Number);
    const [sMajor, sMinor] = RECOMMENDED_REVIEWED_FOR.split('.').map(Number);
    expect(sMajor * 1000 + sMinor).toBeLessThanOrEqual(major * 1000 + minor);
  });
});

describe('the two version files', () => {
  it('agree, so the app reports the build it actually is', () => {
    // Nothing to do with the recommendations; it lives here because this is the only test with
    // both files already in scope, and a mismatch makes every bug report ambiguous.
    expect(appJson.expo.version).toBe(pkg.version);
  });
});

describe('recommendedRanks', () => {
  it('ranks the first pick above the second', () => {
    const ranks = recommendedRanks(['chest']);
    expect(ranks.get(RECOMMENDED.chest[0])).toBe(0);
    expect(ranks.get(RECOMMENDED.chest[1])).toBe(1);
  });

  it('takes the best rank when several muscles are in play', () => {
    // Romanian Deadlift is the second glute pick and the second hamstring pick. The first glute
    // pick is read from the table rather than named, so a future review can change it without
    // this test - which is about the rank arithmetic - having an opinion about which lift wins.
    const ranks = recommendedRanks(['glutes', 'hamstrings']);
    expect(ranks.get('Seated_Leg_Curl')).toBe(0);
    expect(ranks.get(RECOMMENDED.glutes[0])).toBe(0);
    expect(ranks.get('Romanian_Deadlift')).toBe(1);
  });

  it('is empty for no muscles', () => {
    expect(recommendedRanks([]).size).toBe(0);
  });
});

describe('deciding whether a search is about a muscle', () => {
  it('recognises a muscle typed in the box', () => {
    expect(muscleTermsIn('chest')).toEqual(['chest']);
    expect(muscleTermsIn('abs')).toEqual(['abdominals']);
    expect(muscleTermsIn('quads')).toEqual(['quadriceps']);
    expect(muscleTermsIn('calf')).toEqual(['calves']);
  });

  it('expands a body part to the muscles it covers', () => {
    expect(new Set(muscleTermsIn('legs'))).toEqual(
      new Set(['quadriceps', 'hamstrings', 'glutes', 'calves']),
    );
  });

  it('does not treat an exercise name as a muscle search', () => {
    expect(muscleTermsIn('bench press')).toEqual([]);
    expect(muscleTermsIn('romanian deadlift')).toEqual([]);
    expect(muscleTermsIn('')).toEqual([]);
  });

  it('does not treat a movement named after a muscle as a muscle search', () => {
    /*
     * Every word has to name a muscle, not merely one of them. These all begin with the name of
     * a muscle and are all names of specific movements - "leg raise" used to come back with the
     * two exercises recommended for calves ahead of any actual leg raise.
     */
    for (const query of ['leg raise', 'calf raise', 'leg press', 'chest press', 'back squat']) {
      expect([query, muscleTermsIn(query)]).toEqual([query, []]);
    }
  });

  it('still expands a phrase where every word is a muscle', () => {
    expect(new Set(muscleTermsIn('chest triceps'))).toEqual(new Set(['chest', 'triceps']));
    expect(new Set(muscleTermsIn('abs core'))).toEqual(new Set(['abdominals']));
  });

  it('counts the filter chip as well as the text', () => {
    expect(focusMuscles({ muscle: 'chest' })).toEqual(['chest']);
    expect(focusMuscles({ query: 'press', muscle: 'triceps' })).toEqual(['triceps']);
    // No double entry when the chip and the word agree.
    expect(focusMuscles({ query: 'chest', muscle: 'chest' })).toEqual(['chest']);
  });
});

describe('ordering a search by muscle', () => {
  it('leads with the two recommended exercises, in order', () => {
    for (const muscle of MUSCLES) {
      const results = searchExercises({ muscle });
      expect([muscle, results[0]?.id]).toEqual([muscle, RECOMMENDED[muscle][0]]);
      expect([muscle, results[1]?.id]).toEqual([muscle, RECOMMENDED[muscle][1]]);
    }
  });

  it('does the same when the muscle is typed rather than tapped', () => {
    const results = searchExercises({ query: 'chest' });
    expect(results[0].id).toBe(RECOMMENDED.chest[0]);
    expect(results[1].id).toBe(RECOMMENDED.chest[1]);
  });

  it('puts what the user has recorded next, most-recorded first', () => {
    const history = new Map([
      ['Dumbbell_Flyes', 3],
      ['Pushups', 12],
      ['Cable_Crossover', 7],
    ]);
    const ids = searchExercises({ muscle: 'chest', history }).map((e) => e.id);
    expect(ids.slice(0, 2)).toEqual([...RECOMMENDED.chest]);
    expect(ids.slice(2, 5)).toEqual(['Pushups', 'Cable_Crossover', 'Dumbbell_Flyes']);
  });

  it('does not let history displace a recommended pick', () => {
    const history = new Map([['Pushups', 500]]);
    const ids = searchExercises({ muscle: 'chest', history }).map((e) => e.id);
    expect(ids[0]).toBe(RECOMMENDED.chest[0]);
    expect(ids[2]).toBe('Pushups');
  });

  it('promotes a recorded exercise that is also recommended only once', () => {
    const history = new Map([[RECOMMENDED.chest[1], 99]]);
    const ids = searchExercises({ muscle: 'chest', history }).map((e) => e.id);
    expect(ids.filter((id) => id === RECOMMENDED.chest[1])).toHaveLength(1);
    expect(ids.slice(0, 2)).toEqual([...RECOMMENDED.chest]);
  });

  it('leaves everything below the recorded band in relevance order', () => {
    const ids = searchExercises({ query: 'chest' }).map((e) => e.id);
    // Past the two picks, the name matches still come before the merely-chest-training ones.
    const rest = searchExercises({ query: 'chest' }).slice(2);
    const firstNamed = rest.findIndex((e) => e.name.toLowerCase().includes('chest'));
    const firstUnnamed = rest.findIndex(
      (e) => !e.name.toLowerCase().includes('chest') && e.primaryMuscles.includes('chest'),
    );
    expect(firstNamed).toBeLessThan(firstUnnamed);
    expect(ids.length).toBeGreaterThan(100);
  });

  it('still honours the other filters', () => {
    const results = searchExercises({ muscle: 'chest', equipment: 'dumbbell' });
    expect(results.length).toBeGreaterThan(0);
    for (const e of results) expect(e.equipment).toBe('dumbbell');
    // The barbell pick cannot lead a dumbbell-only list.
    expect(results[0].id).not.toBe('Barbell_Bench_Press_-_Medium_Grip');
  });

  it('leaves a plain name search alone', () => {
    // "bench press" should answer with bench presses, not with the chest recommendations.
    const results = searchExercises({ query: 'bench press' });
    expect(results[0].name.toLowerCase().startsWith('bench press')).toBe(true);
  });

  it('is unaffected by history when the search is not about a muscle', () => {
    const history = new Map([['Pushups', 500]]);
    const withHistory = searchExercises({ query: 'bench press', history }).map((e) => e.id);
    const without = searchExercises({ query: 'bench press' }).map((e) => e.id);
    expect(withHistory).toEqual(without);
  });
});
