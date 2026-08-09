import { EXERCISES } from '@/catalog';
import { slopeFor } from '@/catalog/slope';

/**
 * The bench angle for exercises whose name only says "incline" or "decline".
 *
 * The point of the whole file is that the same word means different benches, so most of what
 * is worth asserting is that it does NOT answer with one number for everything.
 */

describe('the angle a bench should be set to', () => {
  it('puts an incline press at 30 degrees, not 45', () => {
    // The mistake this exists to prevent: 45 turns a chest press into a shoulder press.
    expect(slopeFor('Incline_Dumbbell_Press')?.degrees).toBe('30°');
    expect(slopeFor('Barbell_Incline_Bench_Press_-_Medium_Grip')?.degrees).toBe('30°');
  });

  it('puts an incline curl steeper than an incline press', () => {
    // Same word, different bench. Curls want the arm hanging behind the body.
    expect(slopeFor('Incline_Dumbbell_Curl')?.degrees).toBe('45-60°');
    expect(slopeFor('Incline_Dumbbell_Curl')?.degrees).not.toBe(
      slopeFor('Incline_Dumbbell_Press')?.degrees,
    );
  });

  it('answers for declines too', () => {
    expect(slopeFor('Decline_Barbell_Bench_Press')?.degrees).toBe('15-30°');
    expect(slopeFor('Decline_Crunch')?.degrees).toBe('15-30°');
  });

  it('says nothing for an exercise with no slope in its name', () => {
    expect(slopeFor('Barbell_Bench_Press_-_Medium_Grip')).toBeNull();
    expect(slopeFor('Barbell_Squat')).toBeNull();
  });

  it('says nothing for an id that is not an exercise', () => {
    expect(slopeFor('not-a-real-id')).toBeNull();
  });
});

describe('the senses of "incline" that are not a bench angle', () => {
  /*
   * Three different meanings live in this catalog. Getting these wrong would be worse than
   * saying nothing: "set the bench to about 30°" on a press-up is an instruction you cannot
   * follow, and it would undermine the ones that are right.
   */
  it('says nothing about a press-up, where the body is on the slope', () => {
    for (const id of [
      'Incline_Push-Up',
      'Incline_Push-Up_Wide',
      'Incline_Push-Up_Close-Grip',
      'Decline_Push-Up',
    ]) {
      expect([id, slopeFor(id)]).toEqual([id, null]);
    }
  });

  it('says nothing about a cable line or a treadmill gradient', () => {
    expect(slopeFor('Cable_Incline_Pushdown')).toBeNull();
    expect(slopeFor('FitRam_Incline_Walk_Treadmill')).toBeNull();
  });
});

describe('coverage across the catalog', () => {
  const named = EXERCISES.filter((e) => /\b(incline|decline)\b/i.test(e.name));

  it('finds the exercises that are named for a slope', () => {
    // A guard on the derivation itself: if the name pattern stopped matching, every assertion
    // above would still pass while the feature silently did nothing.
    expect(named.length).toBeGreaterThan(40);
  });

  it('answers for all but the handful that have no angle to give', () => {
    const silent = named.filter((e) => slopeFor(e.id) === null).map((e) => e.id);
    // Exactly the press-ups, the cable pushdown and the treadmill - nothing else may drift in
    // without someone deciding it should.
    expect(silent.sort()).toEqual(
      [
        'Cable_Incline_Pushdown',
        'Decline_Push-Up',
        'FitRam_Incline_Walk_Treadmill',
        'Incline_Push-Up',
        'Incline_Push-Up_Close-Grip',
        'Incline_Push-Up_Depth_Jump',
        'Incline_Push-Up_Medium',
        'Incline_Push-Up_Reverse_Grip',
        'Incline_Push-Up_Wide',
      ].sort(),
    );
  });

  it('gives every answer a reason, short enough to read', () => {
    for (const e of named) {
      const slope = slopeFor(e.id);
      if (slope === null) continue;
      expect([e.id, slope.why.length > 30 && slope.why.length <= 200]).toEqual([e.id, true]);
      expect([e.id, /°/.test(slope.degrees)]).toEqual([e.id, true]);
    }
  });
});
