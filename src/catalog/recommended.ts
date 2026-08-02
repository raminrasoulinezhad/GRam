import { MUSCLES, type Muscle } from './generated';

/**
 * The two most-recommended exercises per muscle, used to order a search by muscle.
 *
 * WHY THIS EXISTS
 * Searching "chest" used to lead with Chest Push (multiple response), a plyometric drill,
 * because it happens to have the word in its name. The catalog has no notion of which of its
 * two hundred chest exercises anyone should actually do. This file supplies that judgement.
 *
 * HOW THE PICKS WERE MADE
 * Two bodies of evidence, weighted in this order:
 *
 *   1. Current hypertrophy coaching consensus - Jeff Nippard and Brad Schoenfeld's 2024
 *      narrative review on training technique, and Nippard's per-muscle rankings, which score
 *      an exercise on tension through a long muscle length, joint comfort, and how well it
 *      takes progressive overload. This is the primary source because it reflects what
 *      actually drives growth rather than what lights up an electrode.
 *   2. ACE-sponsored EMG studies (biceps 2014, triceps, abdominals, glutes) as corroboration.
 *      EMG measures activation during one set, not growth over months, so it breaks ties
 *      rather than settling them.
 *
 * Where the two disagreed, consensus won. Where a source named kit most people do not have -
 * Nippard's top chest pick is a Smith machine incline, his top biceps pick a Bayesian cable
 * curl - the nearest widely available equivalent in the catalog was chosen instead, because a
 * recommendation you cannot perform is not a recommendation.
 *
 * Sources are listed in docs/STUDY.md.
 *
 * WHEN TO REDO THIS
 * The stamp below is a MINOR series - "1.2", not "1.2.0" - and a test requires it to match the
 * major.minor of package.json. So every minor release fails the build until someone has
 * revisited these picks, and the patch releases in between do not, which is what keeps the
 * check meaningful: a prompt on every commit is a prompt nobody reads. The evidence moves, and
 * a list frozen in 2026 would quietly become folklore.
 *
 * To redo it: repeat the research (sources and criteria in docs/STUDY.md §6), change the picks
 * where the evidence has moved, update the comment saying why, and set both constants below.
 */
export const RECOMMENDED_REVIEWED_FOR = '1.2';

/** Calendar date of the last review, so staleness is visible even between version bumps. */
export const RECOMMENDED_REVIEWED_ON = '2026-08-01';

/** Exactly two exercise ids per muscle, best first. */
export const RECOMMENDED: Record<Muscle, readonly [string, string]> = {
  // Head harness and plate work are the only progressively loadable neck training there is;
  // everything else in the catalog is isometric or a stretch.
  neck: ['Seated_Head_Harness_Neck_Resistance', 'Lying_Face_Up_Plate_Neck_Resistance'],

  // The shrug is the one movement every source names for upper traps, and it loads heavily.
  traps: ['Barbell_Shrug', 'Dumbbell_Shrug'],

  // A press for the front head and a lateral raise for the side head - the side delt gets
  // almost nothing from pressing, so isolating it is not optional. Nippard's pick is the cable
  // version; the dumbbell one is here because everyone has dumbbells.
  shoulders: ['Dumbbell_Shoulder_Press', 'Side_Lateral_Raise'],

  // Nippard's top chest pick is an incline press: it grows the upper chest, which the flat
  // press neglects, without giving up the lower chest. Flat barbell second for sheer loadability.
  chest: ['Incline_Dumbbell_Press', 'Barbell_Bench_Press_-_Medium_Grip'],

  // Concentration curl took the ACE study by a wide margin. Incline curl puts the long head in
  // a stretched position, which is where the current consensus says the growth is.
  biceps: ['Concentration_Curls', 'Incline_Dumbbell_Curl'],

  // Overhead extension is the only common movement that trains the long head - two thirds of
  // the triceps - at length. Close-grip bench is the loadable compound.
  triceps: ['Cable_Rope_Overhead_Triceps_Extension', 'Close-Grip_Barbell_Bench_Press'],

  // Carries train grip and every forearm compartment under real load; wrist curls isolate the
  // flexors. Both are named in RP's forearm guidance.
  forearms: ['Farmers_Walk', 'Seated_Palm-Up_Barbell_Wrist_Curl'],

  // Close-grip pulldown is Nippard's runner-up for back and the most controllable lat movement.
  lats: ['Close-Grip_Front_Lat_Pulldown', 'Pullups'],

  // Nippard's number one for back is a chest-supported row - torso braced, no momentum. The
  // seated cable row is the version most gyms have; the barbell row tops the EMG comparisons.
  'middle back': ['Seated_Cable_Rows', 'Bent_Over_Barbell_Row'],

  // Back extension is the direct one; the deadlift is the loaded one.
  'lower back': ['Hyperextensions_Back_Extensions', 'Barbell_Deadlift'],

  // The cable crunch is the only common ab exercise you can progressively load, which is why
  // it outranks the bicycle despite the bicycle topping the ACE activation study.
  abdominals: ['Cable_Crunch', 'Air_Bike'],

  // Hip thrust puts peak tension at full hip extension; the RDL is Nippard's pick for the lower
  // glute and loads the stretched position.
  glutes: ['Barbell_Hip_Thrust', 'Romanian_Deadlift'],

  quadriceps: ['Barbell_Squat', 'Leg_Extensions'],

  // A 2023 study found the seated curl grows hamstrings more than the lying one - the hip is
  // flexed, so the muscle starts pre-stretched. The RDL covers the hip-extension function.
  hamstrings: ['Seated_Leg_Curl', 'Romanian_Deadlift'],

  adductors: ['Thigh_Adductor', 'Band_Hip_Adductions'],

  // Machine hip abduction is S-tier in Nippard's 2025 glute ranking for the upper glute.
  abductors: ['Thigh_Abductor', 'Monster_Walk'],

  // Standing beats seated for the gastrocnemius - the knee is straight, so it is not slackened.
  // Seated is kept second because it is the better soleus movement, not as a consolation.
  calves: ['Standing_Calf_Raises', 'Seated_Calf_Raise'],
};

/** exerciseId -> best (lowest) rank across the muscles being looked at. */
export function recommendedRanks(muscles: readonly Muscle[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const muscle of muscles) {
    const picks = RECOMMENDED[muscle];
    if (!picks) continue;
    for (let rank = 0; rank < picks.length; rank++) {
      const existing = out.get(picks[rank]);
      if (existing === undefined || rank < existing) out.set(picks[rank], rank);
    }
  }
  return out;
}

/** Every recommended id, for validation and tests. */
export const ALL_RECOMMENDED_IDS: string[] = MUSCLES.flatMap((m) => [...RECOMMENDED[m]]);
