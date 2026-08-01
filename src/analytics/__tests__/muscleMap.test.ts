import { bodyBack } from 'react-native-body-highlighter/dist/assets/bodyBack';
import { bodyFront } from 'react-native-body-highlighter/dist/assets/bodyFront';
import { EXERCISES, MUSCLES } from '@/catalog';
import { MUSCLE_LABEL, MUSCLE_TO_SLUGS, TRACKED_SLUGS, toSlugValues } from '@/analytics/muscleMap';
import { emptyTotals } from '@/analytics/volume';

const RENDERABLE = new Set([
  ...bodyFront.map((p) => p.slug),
  ...bodyBack.map((p) => p.slug),
]);

describe('muscle map coverage', () => {
  it('maps every catalog muscle', () => {
    expect(Object.keys(MUSCLE_TO_SLUGS).sort()).toEqual([...MUSCLES].sort());
  });

  it('labels every catalog muscle', () => {
    expect(Object.keys(MUSCLE_LABEL).sort()).toEqual([...MUSCLES].sort());
    for (const m of MUSCLES) expect(MUSCLE_LABEL[m].length).toBeGreaterThan(0);
  });

  it('only targets slugs the body model can actually draw', () => {
    for (const muscle of MUSCLES) {
      const slugs = MUSCLE_TO_SLUGS[muscle];
      expect(slugs.length).toBeGreaterThan(0);
      for (const slug of slugs) {
        expect(RENDERABLE.has(slug)).toBe(true);
      }
    }
  });

  it('leaves no exercise in the catalog unrenderable', () => {
    for (const e of EXERCISES) {
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
        expect(MUSCLE_TO_SLUGS[m]).toBeDefined();
      }
    }
  });
});

describe('toSlugValues', () => {
  it('drops zero-valued muscles so untrained regions stay default-filled', () => {
    expect(toSlugValues(emptyTotals()).size).toBe(0);
  });

  it('projects a single muscle onto its slug', () => {
    const totals = emptyTotals();
    totals.chest = 8;
    expect(toSlugValues(totals).get('chest')).toBe(8);
  });

  it('takes the max where two muscles share one region', () => {
    const totals = emptyTotals();
    totals.lats = 4;
    totals['middle back'] = 9;
    // Summing would report 13 sets of back work for a single row - max keeps the colour honest.
    expect(toSlugValues(totals).get('upper-back')).toBe(9);
  });

  it('folds abductors into the gluteal region without erasing glutes', () => {
    const totals = emptyTotals();
    totals.glutes = 3;
    totals.abductors = 7;
    expect(toSlugValues(totals).get('gluteal')).toBe(7);
  });

  it('never emits a slug the model cannot draw', () => {
    const totals = emptyTotals();
    for (const m of MUSCLES) totals[m] = 5;
    for (const slug of toSlugValues(totals).keys()) {
      expect(RENDERABLE.has(slug)).toBe(true);
    }
  });
});

describe('TRACKED_SLUGS', () => {
  it('covers every slug any catalog muscle can map to', () => {
    const expected = new Set(MUSCLES.flatMap((m) => MUSCLE_TO_SLUGS[m]));
    expect(new Set(TRACKED_SLUGS)).toEqual(expected);
  });

  it('contains no duplicates, so no path is painted twice', () => {
    expect(TRACKED_SLUGS).toHaveLength(new Set(TRACKED_SLUGS).size);
  });

  it('only names slugs the body model can draw', () => {
    for (const slug of TRACKED_SLUGS) expect(RENDERABLE.has(slug)).toBe(true);
  });
});
