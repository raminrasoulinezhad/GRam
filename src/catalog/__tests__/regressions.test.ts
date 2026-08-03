import { getExercise } from '@/catalog';
import {
  REGRESSIONS,
  regressionFor,
  regressionLadder,
  SOURCES,
  type Regression,
} from '@/catalog/regressions';

const entries = Object.entries(REGRESSIONS);
const sourceUrls = new Set<string>(Object.values(SOURCES));

describe('every regression points at something real', () => {
  it.each(entries)('%s is an exercise in the catalog', (id) => {
    expect(getExercise(id)).toBeDefined();
  });

  it.each(entries)('%s points at an exercise in the catalog', (_id, r) => {
    expect(getExercise((r as Regression).easier)).toBeDefined();
  });

  it('never points an exercise at itself', () => {
    for (const [id, r] of entries) expect(r.easier).not.toBe(id);
  });
});

describe('every regression is accounted for', () => {
  it.each(entries)('%s cites a source from the list', (_id, r) => {
    // A URL typed inline is a URL nobody re-reads. Citing through SOURCES means the same study
    // is referenced identically everywhere and there is one place to fix a dead link.
    expect(sourceUrls.has((r as Regression).source)).toBe(true);
  });

  it.each(entries)('%s explains itself in one readable line', (_id, r) => {
    const why = (r as Regression).why;
    expect(why.length).toBeGreaterThan(20);
    expect(why.length).toBeLessThan(120);
    expect(why[0]).toBe(why[0].toUpperCase());
    expect(why.endsWith('.')).toBe(true);
  });

  it('cites every source it declares, so the list does not rot', () => {
    const used = new Set(entries.map(([, r]) => r.source));
    for (const [name, url] of Object.entries(SOURCES)) {
      expect(used.has(url) ? name : `${name} is declared but never cited`).toBe(name);
    }
  });
});

describe('the ladders', () => {
  it('never loops', () => {
    for (const [id] of entries) {
      const ladder = regressionLadder(id, 50);
      const ids = ladder.map((r) => r.easier);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('bottoms out at something a beginner can do', () => {
    // Every chain has to end. A ladder that hit the limit would mean an edge was added without
    // an easier end, and the user would be walked in circles.
    for (const [id] of entries) expect(regressionLadder(id, 50).length).toBeLessThan(12);
  });

  it('walks a barbell bench press all the way down to an incline push-up', () => {
    const ladder = regressionLadder('Barbell_Bench_Press_-_Medium_Grip');
    expect(ladder.map((r) => r.easier)).toEqual([
      'Dumbbell_Bench_Press',
      'Dumbbell_Floor_Press',
      'Pushups',
      'Incline_Push-Up',
    ]);
  });

  it('walks a pull-up down to a lat pulldown', () => {
    expect(regressionLadder('Pullups').map((r) => r.easier)).toEqual([
      'Band_Assisted_Pull-Up',
      'Scapular_Pull-Up',
      'Close-Grip_Front_Lat_Pulldown',
    ]);
  });

  it('walks a barbell squat down to a chair squat', () => {
    expect(regressionLadder('Barbell_Full_Squat').map((r) => r.easier)).toEqual([
      'Goblet_Squat',
      'Bodyweight_Squat',
      'Chair_Squat',
    ]);
  });

  it('teaches the hinge before the pull, which is the whole point of the deadlift ladder', () => {
    const ladder = regressionLadder('Barbell_Deadlift').map((r) => r.easier);
    expect(ladder).toContain('Romanian_Deadlift');
    expect(ladder.indexOf('Romanian_Deadlift')).toBeGreaterThan(ladder.indexOf('Rack_Pulls'));
  });

  it('takes a clean and jerk apart into a clean, a hang clean, a pull and a deadlift', () => {
    expect(regressionLadder('Clean_and_Jerk').map((r) => r.easier)).toEqual([
      'Power_Clean',
      'Hang_Clean',
      'Clean_Pull',
      'Clean_Deadlift',
    ]);
  });
});

describe('regressionFor', () => {
  it('answers with null for an exercise nothing is listed for', () => {
    expect(regressionFor('Barbell_Curl')).toBeNull();
  });

  it('answers with null for an id that is not an exercise at all', () => {
    expect(regressionFor('not-a-real-id')).toBeNull();
  });

  it('covers the movements a beginner most often cannot do', () => {
    // The derived rule this list replaced said nothing about any of these, because the dataset
    // labels them "beginner". That gap is the reason the list is hand-written.
    for (const id of [
      'Pullups',
      'Chin-Up',
      'Dips_-_Triceps_Version',
      'Barbell_Bench_Press_-_Medium_Grip',
      'Pushups',
      'Barbell_Deadlift',
      'Barbell_Full_Squat',
    ]) {
      expect(regressionFor(id)).not.toBeNull();
    }
  });
});
