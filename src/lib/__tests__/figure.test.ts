import { EXERCISES } from '@/catalog';
import { femaleShare, figureFor } from '../figure';

/**
 * Who the app draws when nobody said.
 *
 * "Unspecified" is a real answer, and it used to be handled as a missing one: picking it set the
 * body figure to male, so the single option a person chooses in order not to be assumed about
 * produced exactly that assumption, silently. These hold the repair in place.
 */
describe('a stated sex is respected everywhere', () => {
  it.each(['male', 'female'] as const)('draws %s on every exercise', (sex) => {
    for (const e of EXERCISES.slice(0, 200)) expect(figureFor(sex, e.id)).toBe(sex);
  });
});

describe('an unspecified sex splits the catalog', () => {
  it('comes out close to half and half across all 896', () => {
    const share = femaleShare(EXERCISES.map((e) => e.id));
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });

  it('never silently falls back to male', () => {
    // The actual bug. A hash that skewed hard, or a fallback that returned 'male' on anything
    // unexpected, would reintroduce it while still passing a naive "returns a gender" test.
    const ids = EXERCISES.map((e) => e.id);
    expect(ids.some((id) => figureFor('unspecified', id) === 'female')).toBe(true);
    expect(ids.some((id) => figureFor('unspecified', id) === 'male')).toBe(true);
  });

  it('gives the same exercise the same figure every time', () => {
    // A figure that flips between openings reads as a bug, and nothing is stored to remember
    // it, so the function itself has to be the memory.
    for (const e of EXERCISES.slice(0, 50)) {
      expect(figureFor('unspecified', e.id)).toBe(figureFor('unspecified', e.id));
    }
  });

  it('is stable across reinstalls, devices and restored backups', () => {
    // Pure function of the id, so there is nothing to lose. These literals are the contract:
    // changing the hash silently reassigns every exercise in the catalog.
    expect(figureFor('unspecified', 'Barbell_Full_Squat')).toBe('female');
    expect(figureFor('unspecified', 'Barbell_Bench_Press_-_Medium_Grip')).toBe('male');
    expect(figureFor('unspecified', 'Plank')).toBe('male');
  });

  it('handles an id it has never seen, or no id at all', () => {
    // The undefined case is not hypothetical: a route with no param reaches here, and an
    // unguarded hash took the whole exercise page down with it.
    expect(['male', 'female']).toContain(figureFor('unspecified', ''));
    expect(['male', 'female']).toContain(figureFor('unspecified', 'Not_An_Exercise'));
    expect(['male', 'female']).toContain(figureFor('unspecified', undefined));
  });
});

describe('the generated artwork agrees with the drawn figure', () => {
  it('uses the same hash the art pipeline uses', () => {
    // scripts/build-exercise-art.mjs carries a copy, because a build script cannot import from
    // src. If the two drift, an exercise gets a female photograph and a male glyph underneath.
    const fromScript = (id: string) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0) % 2 === 0 ? 'female' : 'male';
    };
    for (const e of EXERCISES.slice(0, 300)) {
      expect([e.id, figureFor('unspecified', e.id)]).toEqual([e.id, fromScript(e.id)]);
    }
  });
});
