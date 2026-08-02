import { EXERCISES, getExercise, implementWord, isPerSideLoad, loadMultiplier } from '@/catalog';

const at = (id: string) => getExercise(id)!;

describe('which exercises load one hand at a time', () => {
  it.each([
    ['Dumbbell_Bench_Press', 'a dumbbell in each hand'],
    ['Dumbbell_Bicep_Curl', 'the plainest case there is'],
    ['Dumbbell_Lunges', 'a leg exercise, but the load is still one bell per hand'],
    ['Dumbbell_Shrug', ''],
    ['Alternate_Hammer_Curl', 'alternating still means two bells are held'],
    ['Double_Kettlebell_Jerk', 'two kettlebells, said in the name'],
    ['Two-Arm_Kettlebell_Row', ''],
  ])('%s is per hand — %s', (id) => {
    expect(isPerSideLoad(at(id))).toBe(true);
    expect(loadMultiplier(at(id))).toBe(2);
  });

  it.each([
    ['Barbell_Bench_Press_-_Medium_Grip', 'one bar carries the whole load'],
    ['Barbell_Full_Squat', ''],
    ['Plank', 'no external load at all'],
    ['One-Arm_Dumbbell_Row', 'one bell, one side working'],
    ['One_Arm_Dumbbell_Bench_Press', ''],
    ['Straight-Arm_Dumbbell_Pullover', 'one bell, both hands on it'],
    ['Goblet_Squat', 'one kettlebell held at the chest'],
    ['Concentration_Curls', 'one arm at a time, braced on the thigh'],
    ['Calf_Raise_On_A_Dumbbell', 'the dumbbell is the step, not the load'],
    ['Kettlebell_Hang_Clean', 'a kettlebell is one bell unless the name says otherwise'],
  ])('%s is not — %s', (id) => {
    expect(isPerSideLoad(at(id))).toBe(false);
    expect(loadMultiplier(at(id))).toBe(1);
  });
});

describe('the rule as applied to the whole catalog', () => {
  const perSide = EXERCISES.filter(isPerSideLoad);

  it('only ever says yes to something held in the hand', () => {
    for (const e of perSide) {
      expect(['dumbbell', 'kettlebells']).toContain(e.equipment);
    }
  });

  it('never says yes to an exercise whose name says one arm or one leg', () => {
    for (const e of perSide) {
      expect(e.name).not.toMatch(/one[-\s]?(arm|leg|hand)|single[-\s]?arm/i);
    }
  });

  it('covers a real part of the catalog without running away with it', () => {
    // Sanity rails rather than a golden number: a rule that matched almost nothing would be
    // pointless, and one that matched hundreds would be catching barbells by mistake.
    expect(perSide.length).toBeGreaterThan(80);
    expect(perSide.length).toBeLessThan(130);
  });

  it('leaves every barbell, machine and cable exercise alone', () => {
    for (const e of EXERCISES) {
      if (['barbell', 'machine', 'cable', 'body only', 'e-z curl bar'].includes(e.equipment ?? '')) {
        expect(isPerSideLoad(e)).toBe(false);
      }
    }
  });
});

describe('implementWord', () => {
  it('names a kettlebell a kettlebell', () => {
    expect(implementWord(at('Double_Kettlebell_Jerk'))).toBe('kettlebell');
  });

  it('names anything else a dumbbell, which is the only other case it is asked about', () => {
    expect(implementWord(at('Dumbbell_Bench_Press'))).toBe('dumbbell');
  });
});
