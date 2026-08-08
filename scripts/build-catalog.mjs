#!/usr/bin/env node
/**
 * Builds the bundled exercise catalog from free-exercise-db (public domain / Unlicense).
 *
 *   npm run build:catalog
 *
 * Writes two committed artifacts so the app builds with no network:
 *   assets/data/exercises.json  - the normalised catalog
 *   src/catalog/generated.ts    - enums + facet lists derived from the data
 *
 * Re-run this only when you want to pick up upstream changes; the diff is reviewable.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

/** Every muscle the upstream dataset uses. Order is anatomical-ish, for stable UI listing. */
const MUSCLES = [
  'neck',
  'traps',
  'shoulders',
  'chest',
  'biceps',
  'triceps',
  'forearms',
  'lats',
  'middle back',
  'lower back',
  'abdominals',
  'glutes',
  'quadriceps',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
];

const CATEGORIES = [
  'strength',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
  'plyometrics',
  'stretching',
  'cardio',
];

const LEVELS = ['beginner', 'intermediate', 'expert'];
const FORCES = ['push', 'pull', 'static'];
const MECHANICS = ['compound', 'isolation'];

/**
 * Everyday movements the upstream dataset does not have.
 *
 * free-exercise-db is thorough on barbell and machine work and thin on conditioning: fourteen
 * cardio entries out of eight hundred and seventy-three, with no incline walking, no swimming
 * and no loaded carry on foot. Those are things people do and want to log, so they are added
 * here and merged into the same catalog.
 *
 * Rules for anything you add:
 *   - `id` must not collide with an upstream id, and the name must be unique. The FitRam_
 *     prefix keeps both true and makes our own entries obvious in a diff. It kept the old
 *     brand name through the GRam rebrand on purpose: these ids are written into user plans
 *     and session logs, so renaming them turns every incline walk anyone has ever planned
 *     into "Unknown exercise". Keep the prefix; new entries use it too.
 *   - `images` stays empty. There is no photograph of these that would be ours to use, and the
 *     app falls back to the drawn muscle glyph, so an entry without one still reads correctly.
 *   - muscle attributions should be conservative. They feed the heatmap and the fatigue model,
 *     so an over-generous secondary list quietly makes the whole body look trained.
 *   - instructions are written here, in the same imperative voice as the dataset.
 */
const SUPPLEMENT = [
  {
    id: 'FitRam_Incline_Walk_Treadmill',
    name: 'Incline Walk, Treadmill',
    category: 'cardio',
    level: 'beginner',
    force: null,
    mechanic: 'compound',
    equipment: 'machine',
    // Raising the belt shifts the work rearward - the glutes become a driver rather than an
    // assistant, which is the whole reason to walk uphill instead of on the flat.
    primaryMuscles: ['glutes', 'quadriceps'],
    secondaryMuscles: ['hamstrings', 'calves'],
    instructions: [
      'Set the treadmill to a walking pace you can hold a conversation at, then raise the incline. Anywhere from 5 to 15 percent is usual.',
      'Stand tall and let go of the handrails. Holding on takes load off your legs and makes the effort easier than the numbers on the display suggest.',
      'Walk with a full stride, rolling from heel to toe, and let your hips extend behind you at the end of each step.',
      'Keep your torso upright rather than leaning into the belt.',
      'Record the time and the distance covered.',
    ],
  },
  {
    id: 'FitRam_Hiking',
    name: 'Hiking',
    category: 'cardio',
    level: 'beginner',
    force: null,
    mechanic: 'compound',
    equipment: null,
    primaryMuscles: ['glutes', 'quadriceps'],
    secondaryMuscles: ['hamstrings', 'calves', 'lower back'],
    instructions: [
      'Walk over varied and rising ground at a pace you can sustain.',
      'Shorten your stride on steep climbs and let your legs, not your back, do the lifting.',
      'On descents keep the knees soft and control the drop rather than falling into each step.',
      'Record the total time and the distance.',
    ],
  },
  {
    id: 'FitRam_Rucking',
    name: 'Rucking (Weighted Walk)',
    category: 'cardio',
    level: 'beginner',
    force: null,
    mechanic: 'compound',
    equipment: 'other',
    primaryMuscles: ['glutes', 'quadriceps'],
    secondaryMuscles: ['hamstrings', 'calves', 'traps', 'lower back'],
    instructions: [
      'Load a backpack with a weight you can carry for the whole distance and tighten the straps so it sits high on your back and does not swing.',
      'Walk at a brisk, steady pace with your torso upright.',
      'Keep your shoulders back rather than letting the load round them forward.',
      'Record the time and distance. Increase the load or the distance, not both at once.',
    ],
  },
  {
    id: 'FitRam_Swimming',
    name: 'Swimming',
    category: 'cardio',
    level: 'intermediate',
    force: null,
    mechanic: 'compound',
    equipment: 'other',
    primaryMuscles: ['lats', 'shoulders'],
    secondaryMuscles: ['chest', 'triceps', 'abdominals', 'glutes'],
    instructions: [
      'Swim continuous lengths at a steady effort, or intervals with a fixed rest between them.',
      'Keep your body flat and high in the water; letting the hips drop is what makes swimming feel harder than it is.',
      'Breathe on a regular rhythm rather than whenever you need to.',
      'Record the time in the water and the distance swum.',
    ],
  },
  {
    id: 'FitRam_Fan_Bike',
    name: 'Fan Bike (Air Bike)',
    category: 'cardio',
    level: 'beginner',
    force: null,
    mechanic: 'compound',
    equipment: 'machine',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['shoulders', 'lats', 'hamstrings', 'calves'],
    instructions: [
      'Set the seat so your knee stays slightly bent at the bottom of the pedal stroke.',
      'Drive with the legs and push and pull the handles along with them, rather than letting the arms go for the ride.',
      'The fan means resistance rises with effort, so pace yourself - the machine will let you go far harder than you can hold.',
      'Record the time and the distance shown on the console.',
    ],
  },
  {
    id: 'FitRam_Battle_Ropes',
    name: 'Battle Ropes',
    category: 'cardio',
    level: 'intermediate',
    force: null,
    mechanic: 'compound',
    equipment: 'other',
    // Timed, not measured in metres - overrides the cardio default of distance + time.
    kind: 'time',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['abdominals', 'forearms', 'lats'],
    instructions: [
      'Hold one end of the rope in each hand and step back until there is only a little slack.',
      'Sit into a quarter squat with a flat back and brace your midsection.',
      'Drive the ropes up and down in alternating waves, moving from the shoulders rather than the wrists.',
      'Work in short intervals - twenty to thirty seconds is plenty - and record the total working time.',
    ],
  },

  /*
   * ------------------------------------------------------------------ the second gap
   *
   * The dataset is a bodybuilding-era catalogue, and it shows in what it does not have. It is
   * exhaustive on barbell and machine variations - five sumo deadlifts, eight kinds of dip -
   * and missing a whole class of movement everyone programmes now: bodyweight isometrics,
   * unilateral leg work, and the plain bar hang.
   *
   * Two things it is NOT missing, which caught me out and are worth writing down so nobody adds
   * a duplicate: the side plank is in there as "Side Bridge", and the pistol squat is there
   * twice, under kettlebell and Smith machine. Search the catalog before adding to it.
   */
  {
    id: 'FitRam_Dead_Hang',
    name: 'Dead Hang',
    category: 'strength',
    level: 'beginner',
    force: 'static',
    mechanic: 'compound',
    equipment: 'body only',
    kind: 'time',
    /*
     * Primary is forearms, not lats. Hanging loads the grip to failure long before it does much
     * for the back - what ends the set is the hands opening. The lats are working, but
     * isometrically and well short of what a pulling set asks, so they are secondary.
     */
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['lats', 'shoulders', 'abdominals'],
    instructions: [
      'Take an overhand grip on a pull-up bar, hands about shoulder-width apart.',
      'Step or jump off and let your arms straighten completely, feet clear of the floor.',
      'Let your shoulders rise towards your ears at first, then gently pull them down away from them - that is the difference between hanging off the joint and hanging under control.',
      'Keep your ribs down and your legs still rather than swinging.',
      'Hold until your grip is nearly gone, and record the time.',
    ],
  },
  {
    id: 'FitRam_Negative_Pull-Up',
    name: 'Negative Pull-Up',
    category: 'strength',
    level: 'beginner',
    force: 'pull',
    mechanic: 'compound',
    equipment: 'body only',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'middle back', 'forearms'],
    instructions: [
      'Stand on a box so your chin already clears the bar, and take an overhand grip.',
      'Step off and hold yourself at the top with your chest close to the bar.',
      'Lower yourself as slowly as you can - three to five seconds is the target - until your arms are straight.',
      'Step back up to the top rather than trying to pull up. Only the lowering half is the exercise.',
      'End the set when you can no longer control the descent, rather than when you cannot hold on.',
    ],
  },
  {
    id: 'FitRam_Bulgarian_Split_Squat',
    name: 'Bulgarian Split Squat',
    category: 'strength',
    level: 'intermediate',
    force: 'push',
    mechanic: 'compound',
    equipment: 'dumbbell',
    primaryMuscles: ['quadriceps', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors', 'calves'],
    instructions: [
      'Stand a stride in front of a bench and rest the top of one foot on it behind you.',
      'Hold a dumbbell in each hand at your sides.',
      'Lower straight down until your front thigh is roughly parallel to the floor and your back knee is close to it.',
      'Keep your weight through the middle of the front foot. If the front knee runs a long way past the toes, step further forward.',
      'Drive up through the front leg. Finish all the reps on one side before swapping.',
    ],
  },
  {
    id: 'FitRam_Reverse_Lunge',
    name: 'Reverse Lunge',
    category: 'strength',
    level: 'beginner',
    force: 'push',
    mechanic: 'compound',
    equipment: 'dumbbell',
    primaryMuscles: ['quadriceps', 'glutes'],
    secondaryMuscles: ['hamstrings', 'calves'],
    instructions: [
      'Stand tall with a dumbbell in each hand.',
      'Step one foot well back and lower until both knees are bent to about a right angle.',
      'Keep your torso upright and your weight on the front foot rather than the back one.',
      'Push through the front heel to bring the back foot level again.',
      'Alternate sides, or finish all the reps on one leg before swapping.',
    ],
  },
  {
    id: 'FitRam_Single-Leg_Romanian_Deadlift',
    name: 'Single-Leg Romanian Deadlift',
    category: 'strength',
    level: 'intermediate',
    force: 'pull',
    mechanic: 'compound',
    equipment: 'dumbbell',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes', 'lower back', 'abductors'],
    instructions: [
      'Hold a dumbbell in one hand and stand on the opposite leg.',
      'Hinge at the hip, letting the free leg swing straight back as a counterweight.',
      'Lower the weight towards the floor with a flat back and only a slight bend in the standing knee.',
      'Stop when you feel a strong stretch in the standing hamstring, then drive the hip forward to stand.',
      'Balance is part of the exercise - go lighter than you would on a two-legged Romanian deadlift.',
    ],
  },
  {
    id: 'FitRam_Nordic_Hamstring_Curl',
    name: 'Nordic Hamstring Curl',
    category: 'strength',
    level: 'expert',
    force: 'pull',
    mechanic: 'isolation',
    equipment: 'body only',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes', 'calves'],
    instructions: [
      'Kneel on a pad with your ankles held down - under a loaded barbell, by a partner, or in a machine.',
      'Keep your hips straight and your body in one line from knee to head.',
      'Lower yourself forward as slowly as you can, resisting the whole way with your hamstrings.',
      'Catch yourself on your hands when you can no longer hold, then push back just enough to return.',
      'Almost nobody can do these unassisted at first. Lowering under control for even two seconds is the whole exercise.',
    ],
  },
  {
    id: 'FitRam_Hollow_Body_Hold',
    name: 'Hollow Body Hold',
    category: 'strength',
    level: 'intermediate',
    force: 'static',
    mechanic: 'isolation',
    equipment: 'body only',
    kind: 'time',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: ['quadriceps'],
    instructions: [
      'Lie on your back with your arms overhead and your legs straight.',
      'Press your lower back flat into the floor and keep it there - that is the whole point of the position.',
      'Lift your shoulders and legs a few inches off the floor.',
      'Lower the arms and legs only as far as you can without the lower back lifting. Bend the knees or keep the arms at your sides to make it easier.',
      'Hold and record the time.',
    ],
  },
  {
    id: 'FitRam_L-Sit',
    name: 'L-Sit',
    category: 'strength',
    level: 'expert',
    force: 'static',
    mechanic: 'compound',
    equipment: 'body only',
    kind: 'time',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: ['triceps', 'shoulders', 'quadriceps'],
    instructions: [
      'Sit on the floor between two parallettes, low bars or blocks, legs straight in front of you.',
      'Press down hard through straight arms and lift your seat clear of the floor.',
      'Push your shoulders down away from your ears and lift your legs until they are level with your hips.',
      'Bend the knees to a tuck if you cannot hold the legs straight - the tuck is the same exercise, scaled.',
      'Hold and record the time.',
    ],
  },
  {
    id: 'FitRam_Wall_Sit',
    name: 'Wall Sit',
    category: 'strength',
    level: 'beginner',
    force: 'static',
    mechanic: 'isolation',
    equipment: 'body only',
    kind: 'time',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'calves'],
    instructions: [
      'Stand with your back flat against a wall and walk your feet forward about two steps.',
      'Slide down until your thighs are parallel to the floor and your knees are above your ankles.',
      'Keep your whole back in contact with the wall and your weight in your heels.',
      'Rest your hands on your thighs, or hold them off the legs for more work.',
      'Hold and record the time.',
    ],
  },
  {
    id: 'FitRam_Bird_Dog',
    name: 'Bird Dog',
    category: 'strength',
    level: 'beginner',
    force: 'static',
    mechanic: 'compound',
    equipment: 'body only',
    primaryMuscles: ['abdominals', 'lower back'],
    secondaryMuscles: ['glutes', 'shoulders'],
    instructions: [
      'Start on hands and knees, hands under shoulders and knees under hips.',
      'Brace your midsection and reach one arm forward while extending the opposite leg back.',
      'Stop when both are level with your torso, and do not let your back arch or your hips tip.',
      'Hold for a breath or two, return under control, and swap sides.',
      'Slow is the point - speed here only hides the hips rotating.',
    ],
  },
  {
    id: 'FitRam_Copenhagen_Plank',
    name: 'Copenhagen Plank',
    category: 'strength',
    level: 'intermediate',
    force: 'static',
    mechanic: 'isolation',
    equipment: 'body only',
    kind: 'time',
    primaryMuscles: ['adductors'],
    secondaryMuscles: ['abdominals', 'glutes'],
    instructions: [
      'Lie on your side with your forearm on the floor and a bench beside you.',
      'Rest the inside of your top foot on the bench, roughly level with your hip.',
      'Lift your hips until your body is a straight line, holding yourself up on the top leg.',
      'Rest the bottom knee on the bench as well to take out much of the load - that is the version to start with.',
      'Hold and record the time, then swap sides.',
    ],
  },
  {
    id: 'FitRam_Pike_Push-Up',
    name: 'Pike Push-Up',
    category: 'strength',
    level: 'intermediate',
    force: 'push',
    mechanic: 'compound',
    equipment: 'body only',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'chest'],
    instructions: [
      'Start in a push-up position and walk your feet in until your hips are high and your body makes an inverted V.',
      'Put your hands a little wider than your shoulders, head between your arms.',
      'Bend your elbows and lower the crown of your head towards the floor between your hands.',
      'Press back up until your arms are straight.',
      'Raising the feet onto a step makes it harder and closer to a handstand press.',
    ],
  },
  {
    id: 'FitRam_Ab_Wheel_Rollout',
    name: 'Ab Wheel Rollout',
    category: 'strength',
    level: 'intermediate',
    force: 'static',
    mechanic: 'compound',
    equipment: 'other',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: ['lats', 'shoulders', 'lower back'],
    instructions: [
      'Kneel on a pad holding an ab wheel under your shoulders.',
      'Tuck your hips slightly so your lower back is rounded rather than arched, and hold it there.',
      'Roll the wheel forward, letting your body extend, and go only as far as you can without the lower back arching.',
      'Pull back to the start using your midsection rather than your hips.',
      'The moment the back arches is the end of your range, whatever distance that turns out to be.',
    ],
  },
  {
    id: 'FitRam_Pendlay_Row',
    name: 'Pendlay Row',
    category: 'strength',
    level: 'intermediate',
    force: 'pull',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['middle back'],
    secondaryMuscles: ['lats', 'biceps', 'shoulders', 'lower back'],
    instructions: [
      'Set a loaded barbell on the floor and take an overhand grip just outside your knees.',
      'Bend at the hips until your torso is parallel to the floor, with a flat back and knees slightly bent.',
      'Pull the bar explosively to your lower chest, keeping the torso still.',
      'Lower it all the way back to the floor and let it settle before the next rep - that dead stop is what separates this from a bent-over row.',
      'If your torso rises to help the bar up, the weight is too heavy.',
    ],
  },
  {
    id: 'FitRam_Tibialis_Raise',
    name: 'Tibialis Raise',
    category: 'strength',
    level: 'beginner',
    force: 'pull',
    mechanic: 'isolation',
    equipment: 'body only',
    /*
     * Filed under calves, which is wrong anatomically - the tibialis anterior opposes the calf.
     * But the dataset has no shin muscle, and lighting the lower leg on the heatmap is right
     * even when the specific muscle is not in the list. The alternative, quadriceps, would be
     * worse: they do nothing here.
     */
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    instructions: [
      'Stand with your back against a wall and walk your feet out about a foot.',
      'Lean back so your weight is on your heels.',
      'Pull your toes up towards your shins as far as they will go.',
      'Lower them slowly rather than letting them drop.',
      'Walking the feet further out makes it harder.',
    ],
  },
  {
    id: 'FitRam_Burpee',
    name: 'Burpee',
    category: 'plyometrics',
    level: 'beginner',
    force: 'push',
    mechanic: 'compound',
    equipment: 'body only',
    primaryMuscles: ['quadriceps', 'chest'],
    secondaryMuscles: ['shoulders', 'triceps', 'glutes', 'abdominals', 'hamstrings'],
    instructions: [
      'Stand tall, then squat down and put your hands on the floor in front of your feet.',
      'Jump or step your feet back into a push-up position.',
      'Lower your chest to the floor and press back up.',
      'Jump or step the feet back in towards your hands.',
      'Stand and jump, reaching overhead. Stepping instead of jumping at either end is the easier version.',
    ],
  },
  {
    id: 'FitRam_Rowing_Machine',
    name: 'Rowing Machine (Erg)',
    category: 'cardio',
    level: 'beginner',
    force: 'pull',
    mechanic: 'compound',
    equipment: 'machine',
    primaryMuscles: ['quadriceps', 'lats'],
    secondaryMuscles: ['glutes', 'hamstrings', 'middle back', 'biceps', 'lower back'],
    instructions: [
      'Strap your feet in and sit forward with your shins vertical, arms straight, holding the handle.',
      'Drive with the legs first, keeping the arms straight - most of the power in a rowing stroke comes from the legs.',
      'As the legs finish, swing the torso back slightly, then pull the handle to your lower ribs.',
      'Return in the opposite order: arms away, body forward, then bend the knees.',
      'Record the time and the distance shown on the console.',
    ],
  },
];

/**
 * Which numbers a set of this exercise records.
 * Derived so that planks and sprints aren't forced into a weight x reps shape.
 * Overridable per plan item in the app.
 */
function defaultSetKind(exercise) {
  // A static force is an isometric hold - planks, side bridges, plate pinches, most
  // stretches. You count seconds, not reps. This has to be checked before category,
  // because the dataset files Plank under "strength".
  if (exercise.force === 'static') return 'time';

  switch (exercise.category) {
    case 'cardio':
      return 'distance_time';
    case 'stretching':
      return 'time';
    case 'plyometrics':
      return 'reps';
    default:
      return exercise.equipment === 'body only' && exercise.category === 'strength'
        ? 'reps'
        : 'weight_reps';
  }
}

function assertEnum(value, allowed, field, exerciseId) {
  if (value === null || value === undefined) return null;
  if (!allowed.includes(value)) {
    throw new Error(`${exerciseId}: unexpected ${field} "${value}"`);
  }
  return value;
}

async function main() {
  process.stdout.write(`Fetching ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching source dataset`);
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Source dataset is empty');

  const seenIds = new Set();
  const seenNames = new Set();
  const equipmentSet = new Set();

  const exercises = [...raw, ...SUPPLEMENT].map((e) => {
    if (!e.id || !e.name) throw new Error(`Exercise missing id/name: ${JSON.stringify(e).slice(0, 120)}`);
    if (seenIds.has(e.id)) throw new Error(`Duplicate exercise id "${e.id}"`);
    // Names must be unique too: a supplement entry that duplicates an upstream name would give
    // the user two indistinguishable rows to choose between.
    if (seenNames.has(e.name)) throw new Error(`Duplicate exercise name "${e.name}"`);
    seenIds.add(e.id);
    seenNames.add(e.name);

    for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
      if (!MUSCLES.includes(m)) throw new Error(`${e.id}: unknown muscle "${m}"`);
    }
    assertEnum(e.category, CATEGORIES, 'category', e.id);
    assertEnum(e.level, LEVELS, 'level', e.id);
    assertEnum(e.force, FORCES, 'force', e.id);
    assertEnum(e.mechanic, MECHANICS, 'mechanic', e.id);
    if (e.equipment) equipmentSet.add(e.equipment);

    // Nine upstream entries (Clean and Press, Barbell Step Ups, ...) list a muscle as both
    // primary and secondary. Left alone, one set would credit that muscle 1.0 + 0.5 = 1.5
    // effective sets and quietly inflate the heatmap. Primary always wins.
    const primary = [...new Set(e.primaryMuscles)];
    const secondary = [...new Set(e.secondaryMuscles)].filter((m) => !primary.includes(m));

    const normalised = {
      id: e.id,
      name: e.name,
      category: e.category,
      level: e.level,
      force: e.force ?? null,
      mechanic: e.mechanic ?? null,
      equipment: e.equipment ?? null,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      instructions: e.instructions ?? [],
      images: e.images ?? [],
    };
    // Supplement entries may state their own kind; the derivation is a guess from category and
    // force, and a rope wave is timed rather than measured in metres.
    normalised.kind = e.kind ?? defaultSetKind(normalised);
    return normalised;
  });

  exercises.sort((a, b) => a.name.localeCompare(b.name));

  const equipment = [...equipmentSet].sort();

  mkdirSync(resolve(ROOT, 'assets/data'), { recursive: true });
  writeFileSync(resolve(ROOT, 'assets/data/exercises.json'), JSON.stringify(exercises));

  const ts = `// GENERATED by scripts/build-catalog.mjs - do not edit by hand.
// Source: ${SOURCE} (Unlicense / public domain)
// ${exercises.length} exercises.

export const MUSCLES = ${JSON.stringify(MUSCLES, null, 2)} as const;
export const CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)} as const;
export const LEVELS = ${JSON.stringify(LEVELS, null, 2)} as const;
export const FORCES = ${JSON.stringify(FORCES, null, 2)} as const;
export const MECHANICS = ${JSON.stringify(MECHANICS, null, 2)} as const;
export const EQUIPMENT = ${JSON.stringify(equipment, null, 2)} as const;

export type Muscle = (typeof MUSCLES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Level = (typeof LEVELS)[number];
export type Force = (typeof FORCES)[number];
export type Mechanic = (typeof MECHANICS)[number];
export type Equipment = (typeof EQUIPMENT)[number];
`;
  writeFileSync(resolve(ROOT, 'src/catalog/generated.ts'), ts);

  const withoutInstructions = exercises.filter((e) => e.instructions.length === 0).length;
  process.stdout.write(
    `Wrote ${exercises.length} exercises (${raw.length} upstream + ${SUPPLEMENT.length} added ` +
      `here), ${equipment.length} equipment types, ${MUSCLES.length} muscles ` +
      `(${withoutInstructions} lack instructions).\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`build-catalog failed: ${err.message}\n`);
  process.exit(1);
});
