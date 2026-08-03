/**
 * The easier movement to work on when the one you picked is out of reach today.
 *
 * WHY THIS IS A HAND-WRITTEN LIST AND NOT A RULE
 * The obvious approach is to derive it: same primary muscle, same push/pull, one step down the
 * catalog's `level` field. That was tried and measured before this file existed, and it fails on
 * the data rather than on the idea. `level` labels pull-ups, chin-ups, dips and the barbell bench
 * press "beginner" - the four movements people most need a stand-in for - so a rule keyed on it
 * says nothing at all about them. It also collapses: of 291 pairs it produced, all 291 chains
 * were one step long and 66 of them pointed at the same two exercises, with Bodyweight Squat
 * offered as the answer for 35 unrelated movements. And it produced confident nonsense -
 * "instead of a deadlift, try back extensions", "instead of a power clean, try a Smith machine
 * stiff-legged deadlift". The measurements are written up in docs/STUDY.md.
 *
 * So every edge below was read from a published progression and carries its source. The shape
 * that comes out is a set of ladders, one per movement pattern: follow `easier` repeatedly and
 * you walk down from the barbell lift to something anybody can do.
 *
 * WHAT THIS IS NOT
 * Not a claim that the easier movement trains the same thing as well - a lat pulldown is not a
 * pull-up. It is the answer to "I cannot do this today, what gets me there".
 *
 * ADDING TO IT
 * One rule: no edge without a source you have actually read. A plausible guess is exactly what
 * the derived version produced, and the whole point of the list is to be better than that.
 */

/** Where a pairing came from. Kept as a constant so the same study is cited identically. */
export const SOURCES = {
  bwf: 'https://redditbwf.github.io/wiki/recommended_routine.html',
  fitbodPullup: 'https://fitbod.me/blog/pull-up-progression/',
  squatProgressions: 'https://www.wg-fit.com/post/the-squat-progressions-and-or-regressions',
  nhsscaSquat: 'https://nhssca.us/wp-content/uploads/2017/10/Squat-Teaching-Progression-Regression.pdf',
  eliteftsSquat: 'https://elitefts.com/blogs/training/squat-progressions-for-college-athletes',
  rdlFirst:
    'https://athleticinstitute.com.au/progressing-from-basic-to-advance-stick-romanian-deadlift-to-the-deadlift/',
  nscaRdl: 'https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/',
  deadliftProgressions: 'https://powerliftingtechnique.com/deadlift-progressions/',
  benchProgressions: 'https://powerliftingtechnique.com/bench-press-progressions/',
  benchFirst:
    'https://www.clientel3.com/blog/2021/09/03/exercise-progressions-to-work-up-to-your-first-bench-press/',
  floorPress: 'https://www.living.fit/blogs/news/dumbbell-floor-press-or-movement-breakdown',
  pressAlternatives: 'https://powerliftingtechnique.com/overhead-press-alternatives/',
  catalystHang: 'https://www.catalystathletics.com/video/1573/Snatch-Clean-Hang-Positions/',
} as const;

export type Regression = {
  /** Catalog id of the easier movement. */
  easier: string;
  /** One line, shown to the user. Says what the easier movement gives you. */
  why: string;
  /** The published progression this pairing came from. */
  source: string;
};

/**
 * Keyed by the harder exercise. Following `easier` repeatedly walks down a ladder, so a
 * complete beginner landing on a barbell bench press can be taken all the way to an incline
 * push-up in four steps.
 */
export const REGRESSIONS: Record<string, Regression> = {
  // ---------------------------------------------------------------- vertical pull
  'Muscle_Up': {
    easier: 'Pullups',
    why: 'A muscle-up is a pull-up that keeps going. Own the pull-up first.',
    source: SOURCES.bwf,
  },
  'Kipping_Muscle_Up': {
    easier: 'Pullups',
    why: 'A muscle-up is a pull-up that keeps going. Own the pull-up first.',
    source: SOURCES.bwf,
  },
  'Wide-Grip_Rear_Pull-Up': {
    easier: 'Pullups',
    why: 'Pulling behind the neck asks for shoulder mobility a standard pull-up does not.',
    source: SOURCES.bwf,
  },
  'V-Bar_Pullup': {
    easier: 'Pullups',
    why: 'Same movement on a neutral grip. Get the standard one first.',
    source: SOURCES.bwf,
  },
  'Pullups': {
    easier: 'Band_Assisted_Pull-Up',
    why: 'A band carries part of your weight, so you train the whole movement instead of half of one.',
    source: SOURCES.fitbodPullup,
  },
  'Chin-Up': {
    easier: 'Band_Assisted_Pull-Up',
    why: 'A band carries part of your weight, so you train the whole movement instead of half of one.',
    source: SOURCES.fitbodPullup,
  },
  'Band_Assisted_Pull-Up': {
    easier: 'Scapular_Pull-Up',
    why: 'Teaches the back to start the pull. Beginners pull with the arms and the lats never switch on.',
    source: SOURCES.bwf,
  },
  'Scapular_Pull-Up': {
    easier: 'Close-Grip_Front_Lat_Pulldown',
    why: 'The same pull with a weight you choose, so you can start well below your bodyweight.',
    source: SOURCES.fitbodPullup,
  },

  // -------------------------------------------------------------- horizontal pull
  'Bent_Over_Barbell_Row': {
    easier: 'One-Arm_Dumbbell_Row',
    why: 'One arm at a time with your other hand on the bench, so the low back is not holding you up.',
    source: SOURCES.bwf,
  },
  'One-Arm_Dumbbell_Row': {
    easier: 'Seated_Cable_Rows',
    why: 'Seated and supported: all you have to do is row.',
    source: SOURCES.bwf,
  },
  'Inverted_Row': {
    easier: 'Seated_Cable_Rows',
    why: 'A row where you pick the weight, rather than one fixed at a share of your bodyweight.',
    source: SOURCES.bwf,
  },

  // -------------------------------------------------------------- horizontal push
  'Handstand_Push-Ups': {
    easier: 'Dumbbell_Shoulder_Press',
    why: 'The same overhead press without holding a handstand up at the same time.',
    source: SOURCES.pressAlternatives,
  },
  'Decline_Push-Up': {
    easier: 'Pushups',
    why: 'Feet on the floor puts less of your weight through your hands.',
    source: SOURCES.bwf,
  },
  'Clock_Push-Up': {
    easier: 'Pushups',
    why: 'Walking your hands round adds balance to a movement worth owning flat first.',
    source: SOURCES.bwf,
  },
  'Pushups_Close_and_Wide_Hand_Positions': {
    easier: 'Pushups',
    why: 'Changing hand width is a variation on the push-up, not a way into it.',
    source: SOURCES.bwf,
  },
  'Push_Up_to_Side_Plank': {
    easier: 'Pushups',
    why: 'Two movements in one. Get the push-up on its own first.',
    source: SOURCES.bwf,
  },
  'Close-Grip_Push-Up_off_of_a_Dumbbell': {
    easier: 'Pushups',
    why: 'A narrow grip hands most of the work to the triceps. The standard push-up shares it out.',
    source: SOURCES.bwf,
  },
  'Pushups': {
    easier: 'Incline_Push-Up',
    why: 'Hands on a bench or a wall. The higher the surface, the less of you there is to press.',
    source: SOURCES.bwf,
  },
  'Incline_Push-Up_Close-Grip': {
    easier: 'Incline_Push-Up',
    why: 'A narrow grip is harder on the triceps. Widen your hands first.',
    source: SOURCES.bwf,
  },

  // ----------------------------------------------------------------- bench press
  'Bench_Press_-_Powerlifting': {
    easier: 'Barbell_Bench_Press_-_Medium_Grip',
    why: 'The competition setup - arched, tucked, paused - is a technique on top of the lift.',
    source: SOURCES.benchProgressions,
  },
  'Barbell_Guillotine_Bench_Press': {
    easier: 'Barbell_Bench_Press_-_Medium_Grip',
    why: 'Lowering to the neck is a shoulder position to earn, not to start with.',
    source: SOURCES.benchProgressions,
  },
  'Wide-Grip_Barbell_Bench_Press': {
    easier: 'Barbell_Bench_Press_-_Medium_Grip',
    why: 'A wide grip loads the shoulder harder at the bottom.',
    source: SOURCES.benchProgressions,
  },
  'Barbell_Bench_Press_-_Medium_Grip': {
    easier: 'Dumbbell_Bench_Press',
    why: 'Dumbbells let each arm find its own path, and you can drop them if a rep stalls.',
    source: SOURCES.benchFirst,
  },
  'Close-Grip_Barbell_Bench_Press': {
    easier: 'Smith_Machine_Close-Grip_Bench_Press',
    why: 'The bar path is fixed, so you can push hard without steering.',
    source: SOURCES.benchProgressions,
  },
  'Decline_Barbell_Bench_Press': {
    easier: 'Decline_Dumbbell_Bench_Press',
    why: 'Dumbbells let each arm find its own path, and you can drop them if a rep stalls.',
    source: SOURCES.benchFirst,
  },
  'Barbell_Incline_Bench_Press_-_Medium_Grip': {
    easier: 'Incline_Dumbbell_Press',
    why: 'Dumbbells let each arm find its own path, and you can drop them if a rep stalls.',
    source: SOURCES.benchFirst,
  },
  'Dumbbell_Bench_Press': {
    easier: 'Dumbbell_Floor_Press',
    why: 'The floor stops the weight before your shoulder reaches its end range.',
    source: SOURCES.floorPress,
  },
  'Dumbbell_Floor_Press': {
    easier: 'Pushups',
    why: 'The same press with nothing to load and nothing to set up.',
    source: SOURCES.benchFirst,
  },

  // ------------------------------------------------------------------------ dips
  'Dips_-_Triceps_Version': {
    easier: 'Bench_Dips',
    why: 'Feet on the floor, so you choose how much of your weight to press.',
    source: SOURCES.bwf,
  },
  'Dips_-_Chest_Version': {
    easier: 'Bench_Dips',
    why: 'Feet on the floor, so you choose how much of your weight to press.',
    source: SOURCES.bwf,
  },
  'Weighted_Bench_Dip': {
    easier: 'Bench_Dips',
    why: 'Drop the added weight before adding more of it.',
    source: SOURCES.bwf,
  },

  // ----------------------------------------------------------------------- squat
  'Barbell_Squat': {
    easier: 'Goblet_Squat',
    why: 'Holding the weight at your chest keeps you upright without being told to.',
    source: SOURCES.squatProgressions,
  },
  'Barbell_Full_Squat': {
    easier: 'Goblet_Squat',
    why: 'Holding the weight at your chest keeps you upright without being told to.',
    source: SOURCES.squatProgressions,
  },
  'Front_Barbell_Squat': {
    easier: 'Goblet_Squat',
    why: 'The same front-loaded squat without a rack, a grip to learn, or a bar on your throat.',
    source: SOURCES.nhsscaSquat,
  },
  'Front_Squat_Clean_Grip': {
    easier: 'Front_Barbell_Squat',
    why: 'The clean grip needs wrist and shoulder mobility the crossed-arm version does not.',
    source: SOURCES.nhsscaSquat,
  },
  'Frankenstein_Squat': {
    easier: 'Front_Barbell_Squat',
    why: 'Holding the bar with no hands is a balance drill on top of a front squat.',
    source: SOURCES.nhsscaSquat,
  },
  'Smith_Machine_Squat': {
    easier: 'Goblet_Squat',
    why: 'A fixed bar path takes balance out, but it also fixes yours. Learn the pattern free.',
    source: SOURCES.eliteftsSquat,
  },
  'Goblet_Squat': {
    easier: 'Bodyweight_Squat',
    why: 'Nothing to hold. Get the depth and the knees before you add load.',
    source: SOURCES.squatProgressions,
  },
  'Bodyweight_Squat': {
    easier: 'Chair_Squat',
    why: 'A chair behind you gives the depth a target and something to catch you.',
    source: SOURCES.squatProgressions,
  },
  'Kettlebell_Pistol_Squat': {
    easier: 'Split_Squats',
    why: 'Two feet down, one leg doing most of the work. A pistol is one foot and all of it.',
    source: SOURCES.bwf,
  },
  'Smith_Machine_Pistol_Squat': {
    easier: 'Split_Squats',
    why: 'Two feet down, one leg doing most of the work. A pistol is one foot and all of it.',
    source: SOURCES.bwf,
  },
  'Split_Squats': {
    easier: 'Bodyweight_Squat',
    why: 'Both feet side by side is a steadier place to learn to bend your knees.',
    source: SOURCES.bwf,
  },
  'Barbell_Lunge': {
    easier: 'Bodyweight_Walking_Lunge',
    why: 'A bar on your back turns a balance problem into a balance problem under load.',
    source: SOURCES.nhsscaSquat,
  },
  'Barbell_Walking_Lunge': {
    easier: 'Bodyweight_Walking_Lunge',
    why: 'A bar on your back turns a balance problem into a balance problem under load.',
    source: SOURCES.nhsscaSquat,
  },
  'Dumbbell_Lunges': {
    easier: 'Bodyweight_Walking_Lunge',
    why: 'Put the weights down until the step itself is steady.',
    source: SOURCES.nhsscaSquat,
  },
  'Bodyweight_Walking_Lunge': {
    easier: 'Split_Squats',
    why: 'Feet planted, so nothing has to be caught between reps.',
    source: SOURCES.bwf,
  },
  'Barbell_Step_Ups': {
    easier: 'Dumbbell_Step_Ups',
    why: 'Weights at your sides sit lower than a bar on your back, so balance is easier.',
    source: SOURCES.nhsscaSquat,
  },

  // ----------------------------------------------------------------------- hinge
  'Barbell_Deadlift': {
    easier: 'Trap_Bar_Deadlift',
    why: 'Standing inside the bar puts the weight in line with you and asks less of the low back.',
    source: SOURCES.deadliftProgressions,
  },
  'Sumo_Deadlift': {
    easier: 'Trap_Bar_Deadlift',
    why: 'Standing inside the bar puts the weight in line with you and asks less of the low back.',
    source: SOURCES.deadliftProgressions,
  },
  'Deficit_Deadlift': {
    easier: 'Barbell_Deadlift',
    why: 'Standing on a plate adds range at the hardest part. Pull from the floor first.',
    source: SOURCES.deadliftProgressions,
  },
  'Trap_Bar_Deadlift': {
    easier: 'Rack_Pulls',
    why: 'Starting from mid-shin cuts out the range where most backs round.',
    source: SOURCES.deadliftProgressions,
  },
  'Rack_Pulls': {
    easier: 'Romanian_Deadlift',
    why: 'The hinge itself, taught before the pull. Hips back, back flat, no lift off the floor.',
    source: SOURCES.rdlFirst,
  },
  'Romanian_Deadlift_from_Deficit': {
    easier: 'Romanian_Deadlift',
    why: 'Standing on a plate adds range at the bottom, where the hamstrings are already longest.',
    source: SOURCES.nscaRdl,
  },
  'Stiff-Legged_Barbell_Deadlift': {
    easier: 'Stiff-Legged_Dumbbell_Deadlift',
    why: 'Dumbbells travel beside your legs, so the bar cannot drift away from you.',
    source: SOURCES.nscaRdl,
  },
  'Stiff-Legged_Dumbbell_Deadlift': {
    easier: 'Romanian_Deadlift',
    why: 'A soft knee lets the hips move back instead of the low back rounding.',
    source: SOURCES.nscaRdl,
  },
  'Good_Morning': {
    easier: 'Romanian_Deadlift',
    why: 'Same hinge with the weight in your hands rather than on your back.',
    source: SOURCES.nscaRdl,
  },
  'Romanian_Deadlift': {
    easier: 'Hyperextensions_Back_Extensions',
    why: 'Supported, unloaded, and it trains the same extension at the top of the hinge.',
    source: SOURCES.nscaRdl,
  },
  'Glute_Ham_Raise': {
    easier: 'Floor_Glute-Ham_Raise',
    why: 'On the floor you can push out of the bottom with your hands.',
    source: SOURCES.bwf,
  },
  'Natural_Glute_Ham_Raise': {
    easier: 'Floor_Glute-Ham_Raise',
    why: 'On the floor you can push out of the bottom with your hands.',
    source: SOURCES.bwf,
  },
  'Barbell_Hip_Thrust': {
    easier: 'Barbell_Glute_Bridge',
    why: 'From the floor rather than a bench: shorter range, no bench to set up against.',
    source: SOURCES.rdlFirst,
  },

  // --------------------------------------------------------------- overhead press
  'Push_Press': {
    easier: 'Standing_Military_Press',
    why: 'A push press adds a leg drive to time. Press it strictly first.',
    source: SOURCES.pressAlternatives,
  },
  'Push_Press_-_Behind_the_Neck': {
    easier: 'Push_Press',
    why: 'Behind the neck needs shoulder mobility that pressing in front does not.',
    source: SOURCES.pressAlternatives,
  },
  'Standing_Military_Press': {
    easier: 'Seated_Barbell_Military_Press',
    why: 'A back rest stops the lower back arching to make up for the shoulders.',
    source: SOURCES.pressAlternatives,
  },
  'Barbell_Shoulder_Press': {
    easier: 'Dumbbell_Shoulder_Press',
    why: 'Dumbbells let each shoulder press on its own line instead of the bar dictating one.',
    source: SOURCES.pressAlternatives,
  },
  'Seated_Barbell_Military_Press': {
    easier: 'Dumbbell_Shoulder_Press',
    why: 'Dumbbells let each shoulder press on its own line instead of the bar dictating one.',
    source: SOURCES.pressAlternatives,
  },
  'Arnold_Dumbbell_Press': {
    easier: 'Dumbbell_Shoulder_Press',
    why: 'The rotation is an extra thing to control. Press straight up first.',
    source: SOURCES.pressAlternatives,
  },
  'Standing_Dumbbell_Press': {
    easier: 'Seated_Dumbbell_Press',
    why: 'Sitting down takes the balancing out and leaves the pressing.',
    source: SOURCES.pressAlternatives,
  },
  'Dumbbell_Shoulder_Press': {
    easier: 'Leverage_Shoulder_Press',
    why: 'A machine holds the path for you, so you can press without steering.',
    source: SOURCES.pressAlternatives,
  },

  // -------------------------------------------------------------- olympic lifting
  'Clean_and_Jerk': {
    easier: 'Power_Clean',
    why: 'Two lifts joined together. Learn the clean before the jerk is bolted on.',
    source: SOURCES.catalystHang,
  },
  'Clean': {
    easier: 'Power_Clean',
    why: 'Catching high means you never have to receive it in a full squat.',
    source: SOURCES.catalystHang,
  },
  'Split_Clean': {
    easier: 'Power_Clean',
    why: 'Catching high means you never have to receive it in a split.',
    source: SOURCES.catalystHang,
  },
  'Power_Clean': {
    easier: 'Hang_Clean',
    why: 'Starting from the hang removes the pull off the floor, which is the fiddly half.',
    source: SOURCES.catalystHang,
  },
  'Clean_from_Blocks': {
    easier: 'Hang_Clean',
    why: 'The hang gives the same shortened pull without needing blocks.',
    source: SOURCES.catalystHang,
  },
  'Power_Clean_from_Blocks': {
    easier: 'Hang_Clean',
    why: 'The hang gives the same shortened pull without needing blocks.',
    source: SOURCES.catalystHang,
  },
  'Hang_Clean_-_Below_the_Knees': {
    easier: 'Hang_Clean',
    why: 'Above the knee is the shorter, simpler starting position.',
    source: SOURCES.catalystHang,
  },
  'Hang_Clean': {
    easier: 'Clean_Pull',
    why: 'The pull with no catch: all of the power, none of the turnover under the bar.',
    source: SOURCES.catalystHang,
  },
  'Clean_Pull': {
    easier: 'Clean_Deadlift',
    why: 'The same start position pulled slowly, so the back angle can be learned before speed.',
    source: SOURCES.catalystHang,
  },
  'Snatch': {
    easier: 'Power_Snatch',
    why: 'Catching high means you never have to receive it in a full overhead squat.',
    source: SOURCES.catalystHang,
  },
  'Split_Snatch': {
    easier: 'Power_Snatch',
    why: 'Catching high means you never have to receive it in a split.',
    source: SOURCES.catalystHang,
  },
  'Snatch_from_Blocks': {
    easier: 'Hang_Snatch',
    why: 'The hang gives the same shortened pull without needing blocks.',
    source: SOURCES.catalystHang,
  },
  'Power_Snatch_from_Blocks': {
    easier: 'Hang_Snatch',
    why: 'The hang gives the same shortened pull without needing blocks.',
    source: SOURCES.catalystHang,
  },
  'Power_Snatch': {
    easier: 'Hang_Snatch',
    why: 'Starting from the hang removes the pull off the floor, which is the fiddly half.',
    source: SOURCES.catalystHang,
  },
  'Hang_Snatch_-_Below_Knees': {
    easier: 'Hang_Snatch',
    why: 'Above the knee is the shorter, simpler starting position.',
    source: SOURCES.catalystHang,
  },
  'Muscle_Snatch': {
    easier: 'Snatch_Pull',
    why: 'Pressing it out overhead needs the pull to be good first.',
    source: SOURCES.catalystHang,
  },
  'Hang_Snatch': {
    easier: 'Snatch_Pull',
    why: 'The pull with no catch: all of the power, none of the turnover under the bar.',
    source: SOURCES.catalystHang,
  },
  'Snatch_Pull': {
    easier: 'Snatch_Deadlift',
    why: 'The same start position pulled slowly, so the back angle can be learned before speed.',
    source: SOURCES.catalystHang,
  },
  'Squat_Jerk': {
    easier: 'Split_Jerk',
    why: 'A split is a far more forgiving place to receive a bar overhead than a squat.',
    source: SOURCES.catalystHang,
  },
  'Split_Jerk': {
    easier: 'Push_Press',
    why: 'The same drive with no feet to move and nothing to catch.',
    source: SOURCES.catalystHang,
  },
  'Power_Jerk': {
    easier: 'Push_Press',
    why: 'The same drive with no feet to move and nothing to catch.',
    source: SOURCES.catalystHang,
  },
  'Jerk_Balance': {
    easier: 'Push_Press',
    why: 'A footwork drill. The drive underneath it is the push press.',
    source: SOURCES.catalystHang,
  },

  // ------------------------------------------------------------------------ core
  'Barbell_Ab_Rollout': {
    easier: 'Barbell_Ab_Rollout_-_On_Knees',
    why: 'From your knees the lever is half as long, which is most of the difficulty.',
    source: SOURCES.bwf,
  },
  'Barbell_Ab_Rollout_-_On_Knees': {
    easier: 'Plank',
    why: 'Holding the position is the whole skill. A rollout is that, moving.',
    source: SOURCES.bwf,
  },
  'Hanging_Pike': {
    easier: 'Hanging_Leg_Raise',
    why: 'Legs to horizontal before legs to the bar.',
    source: SOURCES.bwf,
  },
  'Hanging_Leg_Raise': {
    easier: 'Flat_Bench_Lying_Leg_Raise',
    why: 'Lying down, so your grip is not what ends the set.',
    source: SOURCES.bwf,
  },
  'Pallof_Press_With_Rotation': {
    easier: 'Pallof_Press',
    why: 'Resisting the twist comes before adding one.',
    source: SOURCES.bwf,
  },
  'Decline_Crunch': {
    easier: 'Crunches',
    why: 'Flat on the floor, without gravity added to the top of every rep.',
    source: SOURCES.bwf,
  },
  'Weighted_Crunches': {
    easier: 'Crunches',
    why: 'Put the plate down until the reps are clean.',
    source: SOURCES.bwf,
  },
  'Sit-Up': {
    easier: '3_4_Sit-Up',
    why: 'Stopping short keeps the tension on the abs instead of handing it to the hip flexors.',
    source: SOURCES.bwf,
  },
  'Janda_Sit-Up': {
    easier: 'Sit-Up',
    why: 'The Janda variation adds a hamstring cue to a movement worth owning plainly first.',
    source: SOURCES.bwf,
  },
};

/** The easier movement for `exerciseId`, or null when nothing is listed. */
export function regressionFor(exerciseId: string): Regression | null {
  return REGRESSIONS[exerciseId] ?? null;
}

/**
 * The whole ladder below an exercise, easiest last.
 *
 * Walks `easier` until it runs out. Guards against a cycle rather than trusting the data:
 * a bad edit here would otherwise hang the screen that renders it, and a test catches the
 * cycle but only if the code it is testing returns.
 */
export function regressionLadder(exerciseId: string, limit = 8): Regression[] {
  const out: Regression[] = [];
  const seen = new Set<string>([exerciseId]);
  let at = exerciseId;
  while (out.length < limit) {
    const step = REGRESSIONS[at];
    if (!step || seen.has(step.easier)) break;
    out.push(step);
    seen.add(step.easier);
    at = step.easier;
  }
  return out;
}
