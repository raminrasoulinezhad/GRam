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
 * Whenever someone wants to, and not on any schedule. Up to 1.9.4 a test failed the build
 * unless the stamp below matched the minor series in package.json, so no feature release could
 * ship without a review. That gate is gone by decision.
 *
 * It was removed because of what it actually produced. Four releases in a row were re-stamped
 * within a day of each other - see the 1.5-to-1.8 note below - which established that the
 * evidence could not have moved rather than that anyone had looked. A check that fires more
 * often than the thing it is checking changes teaches people to clear it without thinking, and
 * a re-stamp made that way is worse than an honest old date.
 *
 * The stamp stays as a record, so anyone reading these picks can see how old the judgement is.
 * To redo it: repeat the research (sources and criteria in docs/STUDY.md §6), change the picks
 * where the evidence has moved, update the comment saying why, and set both constants below.
 */
/*
 * 1.5 through 1.8: re-examined, nothing moved any time. All four fell within a day of the
 * substantive 1.4 review, so they establish only that the evidence *could not* have moved, not
 * that it did not - and the note left behind said so, and said the next release landing in a
 * different week owed this file a real reading rather than another note like it.
 *
 * 1.9 is that reading, and it changed a pick: see `glutes` below, where the barbell hip thrust
 * is out. Two other things were checked and left alone, which is worth recording so the next
 * reviewer knows what has already been looked at.
 *
 *   - The 2026 systematic review and meta-analysis on partial repetitions at long versus short
 *     muscle length found significantly greater hypertrophy at the longer length (ES 0.283,
 *     p = 0.036). That is the criterion this file already weights above all others, so it
 *     confirms picks rather than moving them - the incline curl, the overhead triceps
 *     extension, the RDL and the seated leg curl are all here because of it.
 *   - Nippard's overall ranking now opens with squat, pull-up, incline bench press, RDL and
 *     chest-supported T-bar row. All five are already picks below.
 */
export const RECOMMENDED_REVIEWED_FOR = '1.9';

/** Calendar date of the last review, so staleness is visible even between version bumps. */
export const RECOMMENDED_REVIEWED_ON = '2026-08-11';

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

  /*
   * Changed at the 1.3 review. Nippard's back ranking crowns the chest-supported row as the
   * best all-around back exercise and puts a chest-supported T-bar row in his top five
   * movements overall, so the catalog's lying T-bar row takes first place from the seated cable
   * row, which stays second as the version every gym has. The bent-over barbell row drops: it
   * tops the EMG comparisons but the torso is held up by the lower back, and the whole reason
   * the braced version wins is that nothing else has to hold you there.
   */
  'middle back': ['Lying_T-Bar_Row', 'Seated_Cable_Rows'],

  // Back extension is the direct one; the deadlift is the loaded one.
  'lower back': ['Hyperextensions_Back_Extensions', 'Barbell_Deadlift'],

  /*
   * Changed at the 1.4 review, because the catalog gained the movement that should have been
   * here. The cable crunch keeps first place - it is the ab exercise you can most easily add
   * weight to. Second goes to the ab wheel rollout, taking it from the bicycle crunch: the
   * rollout loads the abs in the lengthened, overhead position and scales by how far you roll,
   * which is exactly the pair of criteria this file weights above activation. The bicycle
   * topped the ACE study, but that measures one set rather than months of growth, and it has
   * nowhere to go once you can do it.
   */
  abdominals: ['Cable_Crunch', 'FitRam_Ab_Wheel_Rollout'],

  /*
   * Changed at the 1.9 review, and the first pick this file has ever demoted rather than
   * refined. The barbell hip thrust was first here on the strength of peak tension at full hip
   * extension and a large EMG advantage. Both of those held up; what did not is the conclusion
   * drawn from them.
   *
   * Nippard's glute ranking now places the barbell hip thrust in B tier - it trains all three
   * glute muscles but is awkward to load past a few plates and uncomfortable to set up - and
   * names the walking dumbbell lunge the best glute exercise overall, S tier. Independently,
   * the controlled trial comparing nine weeks of squatting against nine weeks of hip thrusting
   * found similar glute hypertrophy from both despite the hip thrust's much higher activation.
   * That is this file's stated rule doing exactly what it is for: EMG breaks ties, it does not
   * settle them, and here the growth data declined to follow the electrode.
   *
   * The catalog has no walking dumbbell lunge, so the dumbbell reverse lunge takes the place.
   * It was chosen over the catalog's plain Dumbbell Lunges for a reason that is about this app
   * rather than about training: the FIRST pick for a muscle is what the week review offers when
   * a group is untrained, so it has to list that muscle as primary or the suggested fix would
   * not close the issue it was offered for (balance.test.ts enforces this). Dumbbell Lunges
   * files quadriceps alone. The reverse lunge files quadriceps and glutes, and the longer step
   * makes it the more hip-dominant of the two anyway.
   *
   * The RDL keeps second place for the reason it always had: the lengthened position at the hip.
   */
  glutes: ['FitRam_Reverse_Lunge', 'Romanian_Deadlift'],

  /*
   * Reviewed at 1.4 and left alone, but the reasoning was never written down. The squat loads
   * the vastii heavily and carries the whole leg; the leg extension is the only common movement
   * that trains the rectus femoris, which crosses the hip and is therefore slackened by every
   * squat pattern. The Bulgarian split squat, new to the catalog this release, was considered
   * and not taken: it is an excellent quad exercise but it is a harder version of what the
   * squat already does, where the extension covers something the squat cannot.
   */
  quadriceps: ['Barbell_Squat', 'Leg_Extensions'],

  // A 2023 study found the seated curl grows hamstrings more than the lying one - the hip is
  // flexed, so the muscle starts pre-stretched. The RDL covers the hip-extension function.
  hamstrings: ['Seated_Leg_Curl', 'Romanian_Deadlift'],

  /*
   * Changed at the 1.4 review. The machine keeps first place as the loadable one. Second goes
   * to the Copenhagen plank, taking it from band hip adductions - the band version is a warm-up
   * with nowhere to progress, and the Copenhagen is the adductor exercise with actual trial
   * evidence behind it (Harøy 2019 in footballers; Ishøi 2016 on eccentric adduction strength).
   * It also scales properly: bottom knee on the bench, then straight leg, then add weight.
   */
  adductors: ['Thigh_Adductor', 'FitRam_Copenhagen_Plank'],

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
