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
