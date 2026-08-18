#!/usr/bin/env node
/**
 * Generates the exercise artwork this project owns, from text alone.
 *
 *   npm run art:models          list the image models your key can reach
 *   npm run art:probe           one image, end to end, to prove the wiring
 *   npm run art -- --limit 10   the trial: ten exercises, both frames
 *   npm run art -- --all        the full catalog
 *
 * WHY THIS EXISTS
 * The photographs the app shows today come from a dataset whose maintainer never said where he
 * got them, and whose public-domain dedication cannot cover material he did not own. That is
 * fine to link to and not fine to build a paid product on. This script replaces them with a set
 * that has no such question hanging over it, because we made it.
 *
 * THE ONE RULE, AND THE REASON FOR EVERY DESIGN CHOICE BELOW
 * **The original photographs are never an input.** Not to the image model, not to the scoring
 * model, not as a similarity target, not as a reference the loop converges towards. Feeding
 * them in - image to image, "inspired by", or a loop that measures how close the output is to
 * theirs - produces a derivative work, which is one of the exclusive rights of whoever owns
 * them. Transformation is not laundering: a stylised copy of a copy still traces back, and a
 * pipeline that optimises for similarity is a machine whose success criterion is the legal test
 * for infringement.
 *
 * So the reference here is a WRITTEN SPEC of how the movement is performed, derived from the
 * catalog's structured facts. How a bench press works is not anyone's property: it is a
 * procedure, and procedures are outside copyright. The spec is ours, the prompt is ours, the
 * output is ours.
 *
 * WHAT THE LOOP OPTIMISES FOR
 * Not "is this close to their picture" - we never have their picture to compare against. It is
 * "is this a correct depiction of the movement this spec describes". Same convergence, and the
 * target is the only thing that was ever the problem.
 *
 *     spec  ->  generate  ->  score against spec  ->  amend prompt  ->  accept
 *
 * WHAT IT DELIBERATELY DOES NOT READ
 * `images` and `instructions` from the catalog. The first is the material being replaced. The
 * second came from the same source with the same broken chain of title, so building a spec out
 * of it would reintroduce the problem through the back door. Everything the spec is built from
 * is a fact: name, equipment, mechanic, force, level, and which muscles the movement targets.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = resolve(ROOT, 'assets/data/exercises.json');
const OUT_DIR = resolve(ROOT, 'assets/generated');
const MANIFEST = resolve(OUT_DIR, 'manifest.json');

const API = 'https://generativelanguage.googleapis.com/v1beta';
const KEY = process.env.GEMINI_API_KEY ?? '';

/*
 * Overridable because Google renames these faster than anyone can keep a comment accurate.
 * `npm run art:models` prints what your key can actually reach; set the env var to match.
 */
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-flash';

/** Published standard-tier price per generated image, for the running cost estimate. */
const USD_PER_IMAGE = 0.039;

/**
 * The house style, applied identically to all 1,792 frames.
 *
 * This paragraph is why the set will look like a set. The single biggest failing of the
 * free-licensed alternatives is that every picture is a different person in a different gym
 * shot by a different photographer; one fixed style paragraph is the thing neither Wikimedia
 * nor a stock library can offer at any price.
 *
 * Deliberately describes a NEUTRAL studio, not any existing photograph. No named athlete, no
 * brand, no reproduction of a particular shot's framing or lighting.
 */
const STYLE = [
  'Semi-realistic 3D-rendered instructional illustration of a single anonymous athlete.',
  'Neutral matte mid-grey seamless studio background, no room, no windows, no equipment except',
  'what the exercise requires. Soft even three-point studio lighting, no harsh shadows.',
  'Plain unbranded charcoal athletic clothing: fitted shorts and a plain fitted top.',
  'Neutral generic facial features, no recognisable individual.',
  'Full body in frame with a small margin, camera at chest height, straight-on three-quarter view',
  'unless the spec names a different angle. Clean, calm, anatomically accurate, no text,',
  'no logos, no watermarks, no motion blur, no lens flare.',
].join(' ');

// ---------------------------------------------------------------------------- args

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const value = (flag, fallback) => {
  const at = argv.indexOf(flag);
  return at === -1 || at === argv.length - 1 ? fallback : argv[at + 1];
};

const LIMIT = has('--all') ? Infinity : Number(value('--limit', 10));
const MAX_ATTEMPTS = Number(value('--attempts', 3));
const BUDGET_USD = Number(value('--budget', 5));
const ONLY = value('--only', null);
const DRY = has('--dry-run');

// ---------------------------------------------------------------------------- api

let spent = 0;
let imagesMade = 0;

function assertKey() {
  if (KEY === '') {
    console.error(
      'No GEMINI_API_KEY in the environment.\n\n' +
        '  1. Create a key at https://aistudio.google.com/apikey\n' +
        '  2. Image generation is NOT on the free tier, so the project needs billing enabled.\n' +
        '  3. export GEMINI_API_KEY=...\n',
    );
    process.exit(1);
  }
}

async function callModel(model, body) {
  const res = await fetch(`${API}/models/${model}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${model} -> ${res.status} ${res.statusText}\n${(await res.text()).slice(0, 600)}`);
  }
  return res.json();
}

/** Both spellings appear in the wild depending on endpoint version, so accept either. */
function partsOf(payload) {
  return payload?.candidates?.[0]?.content?.parts ?? [];
}
function firstImage(payload) {
  for (const part of partsOf(payload)) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) return { data: inline.data, mime: inline.mimeType ?? inline.mime_type ?? 'image/png' };
  }
  return null;
}
function allText(payload) {
  return partsOf(payload)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
}

/** Pulls a JSON object out of a model reply, tolerating ``` fences and stray prose. */
function parseJson(text, what) {
  const fenced = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`${what}: no JSON in reply:\n${text.slice(0, 300)}`);
  return JSON.parse(fenced.slice(start, end + 1));
}

// ---------------------------------------------------------------------------- stage 1: spec

/**
 * A written description of how the movement is performed.
 *
 * Built ONLY from facts: the name, what it is done with, which muscles it targets, whether it
 * pushes or pulls, whether it is compound or isolation. Those are catalog fields, not prose
 * anyone wrote. The model supplies the biomechanics from its own knowledge of lifting, which is
 * the same knowledge any coach has and nobody owns.
 */
function specPrompt(exercise) {
  return `You are a strength coach writing a precise, factual description of how one exercise is
performed, so an illustrator who has never seen it can draw it correctly.

Exercise name: ${exercise.name}
Equipment: ${exercise.equipment ?? 'bodyweight'}
Force: ${exercise.force ?? 'unspecified'}
Mechanic: ${exercise.mechanic ?? 'unspecified'}
Level: ${exercise.level}
Primary muscles: ${exercise.primaryMuscles.join(', ') || 'unspecified'}
Secondary muscles: ${exercise.secondaryMuscles.join(', ') || 'none'}

Describe the START position and the END position as two separate still frames. Be concrete about
body orientation, joint angles, limb positions, grip, stance width, and where the load sits.
Describe only the athlete and the equipment. Say nothing about clothing, lighting, background,
setting, mood, or camera style: those are fixed elsewhere.

Reply with JSON only:
{
  "summary": "one sentence naming the movement pattern",
  "equipment": "exactly what apparatus must appear, or 'none'",
  "view": "the camera angle that shows this movement most clearly: 'side', 'three-quarter', 'front', or 'rear'",
  "start": "one paragraph describing the start frame",
  "end": "one paragraph describing the end frame",
  "mustShow": ["3 to 5 short checkable facts, e.g. 'barbell held overhead', 'knees bent past 90 degrees'"]
}`;
}

async function writeSpec(exercise) {
  const payload = await callModel(TEXT_MODEL, {
    contents: [{ role: 'user', parts: [{ text: specPrompt(exercise) }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  return parseJson(allText(payload), `spec for ${exercise.id}`);
}

// ---------------------------------------------------------------------------- stage 2: render

function framePrompt(spec, frame, critique) {
  const body = frame === 'start' ? spec.start : spec.end;
  return [
    STYLE,
    `Camera: ${spec.view} view.`,
    `Equipment that must be present: ${spec.equipment}.`,
    `Depict this exact position: ${body}`,
    `The image must clearly show: ${(spec.mustShow ?? []).join('; ')}.`,
    critique ? `Correct these faults from the previous attempt: ${critique}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function renderFrame(prompt) {
  const payload = await callModel(IMAGE_MODEL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const image = firstImage(payload);
  if (!image) throw new Error(`no image in reply; got: ${allText(payload).slice(0, 200)}`);
  spent += USD_PER_IMAGE;
  imagesMade += 1;
  return image;
}

// ---------------------------------------------------------------------------- stage 3: score

/**
 * Marks the render against the spec, and against nothing else.
 *
 * The image it is shown is the one we just made. The standard it is held to is our own written
 * spec. At no point does an original photograph enter this comparison, which is precisely what
 * separates this loop from the one that would get us sued.
 */
async function score(image, spec, frame) {
  const prompt = `You are checking whether an instructional exercise illustration is correct.

It is meant to show the ${frame.toUpperCase()} position of: ${spec.summary}

Required position: ${frame === 'start' ? spec.start : spec.end}
Required equipment: ${spec.equipment}
Must clearly show: ${(spec.mustShow ?? []).join('; ')}

Check for anatomical errors too: wrong number of limbs or digits, impossible joint angles,
floating or merged equipment, a second person, visible text or logos.

Reply with JSON only:
{
  "ok": true or false,
  "issues": ["short, specific faults; empty when ok"],
  "promptFix": "one sentence telling the illustrator what to change; empty when ok"
}`;

  const payload = await callModel(TEXT_MODEL, {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.data } }],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  return parseJson(allText(payload), `score for ${spec.summary}`);
}

// ---------------------------------------------------------------------------- the loop

async function buildFrame(exercise, spec, frame) {
  let critique = '';
  const attempts = [];

  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    if (spent + USD_PER_IMAGE > BUDGET_USD) {
      throw new Error(`budget of $${BUDGET_USD} reached; stopping before spending more`);
    }
    const prompt = framePrompt(spec, frame, critique);
    const image = await renderFrame(prompt);
    const verdict = await score(image, spec, frame);
    attempts.push({ attempt: n, ok: verdict.ok, issues: verdict.issues ?? [] });

    if (verdict.ok) return { image, attempts, accepted: true };

    critique = verdict.promptFix || (verdict.issues ?? []).join('; ');
    console.log(`      attempt ${n} rejected: ${(verdict.issues ?? []).join('; ') || 'unspecified'}`);
  }

  // Out of attempts. The row falls back to the licensed tier or the drawn glyph; that path
  // already exists and is already tested, so a miss here costs a picture, not a broken screen.
  return { image: null, attempts, accepted: false };
}

// ---------------------------------------------------------------------------- helpers

async function listModels() {
  assertKey();
  const res = await fetch(`${API}/models?key=${KEY}&pageSize=200`);
  const { models = [] } = await res.json();
  const rows = models
    .filter((m) => /image|flash|pro/.test(m.name))
    .map((m) => ({ id: m.name.replace('models/', ''), methods: (m.supportedGenerationMethods ?? []).join(',') }));
  for (const r of rows) console.log(`${r.id.padEnd(42)} ${r.methods}`);
  console.log(`\n${rows.length} models. Set GEMINI_IMAGE_MODEL to whichever generates images.`);
}

async function probe() {
  assertKey();
  console.log(`image model: ${IMAGE_MODEL}\ntext model:  ${TEXT_MODEL}\n`);
  const image = await renderFrame(
    `${STYLE}\nCamera: side view.\nEquipment that must be present: a flat bench and a barbell.\n` +
      'Depict this exact position: an athlete lying supine on a flat bench, feet flat on the floor, ' +
      'holding a barbell at arms length above the chest with a shoulder-width grip.',
  );
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, 'probe.png');
  writeFileSync(file, Buffer.from(image.data, 'base64'));
  console.log(`wrote ${file} (${image.mime})\nspent so far: $${spent.toFixed(3)}`);
}

// ---------------------------------------------------------------------------- main

async function main() {
  if (has('--models')) return listModels();
  if (has('--probe')) return probe();
  assertKey();

  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  let queue = ONLY ? catalog.filter((e) => e.id === ONLY) : catalog;
  if (queue.length === 0) throw new Error(`no exercise matches --only ${ONLY}`);

  /*
   * Trial order is deliberate: the most commonly logged movements first, then a couple of
   * awkward ones. A style that survives a barbell squat, a cable fly and a plank will survive
   * most of the catalog; one judged only on easy exercises tells you nothing.
   */
  const HEAD = [
    'Barbell_Full_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Deadlift', 'Pullups',
    'Barbell_Curl', 'Plank', 'Cable_Crossover', 'Dumbbell_Bench_Press',
    'Standing_Military_Press', 'Romanian_Deadlift',
  ];
  const rank = (e) => (HEAD.indexOf(e.id) === -1 ? HEAD.length : HEAD.indexOf(e.id));
  queue = queue.sort((a, b) => rank(a) - rank(b)).slice(0, LIMIT);

  console.log(
    `${queue.length} exercises x 2 frames, up to ${MAX_ATTEMPTS} attempts each.\n` +
      `budget $${BUDGET_USD} at $${USD_PER_IMAGE}/image (best case $${(queue.length * 2 * USD_PER_IMAGE).toFixed(2)})\n`,
  );
  if (DRY) {
    for (const e of queue) console.log(`  would build ${e.id}`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

  for (const exercise of queue) {
    const dir = resolve(OUT_DIR, exercise.id);
    if (manifest[exercise.id]?.complete) {
      console.log(`  skip  ${exercise.id} (already done)`);
      continue;
    }
    console.log(`  build ${exercise.id}`);

    try {
      const spec = await writeSpec(exercise);
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'spec.json'), JSON.stringify(spec, null, 2));

      const record = { spec, frames: {}, complete: false, source: 'generated' };
      for (const frame of ['start', 'end']) {
        const { image, attempts, accepted } = await buildFrame(exercise, spec, frame);
        if (accepted && image) writeFileSync(resolve(dir, `${frame}.png`), Buffer.from(image.data, 'base64'));
        record.frames[frame] = { accepted, attempts };
        console.log(`      ${frame}: ${accepted ? 'accepted' : 'FELL BACK'} after ${attempts.length}`);
      }
      record.complete = Object.values(record.frames).every((f) => f.accepted);
      manifest[exercise.id] = record;
    } catch (error) {
      console.error(`      failed: ${error.message}`);
      manifest[exercise.id] = { error: String(error.message), complete: false };
      if (/budget/.test(error.message)) break;
    }

    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }

  const done = Object.values(manifest).filter((r) => r.complete).length;
  console.log(
    `\n${done}/${Object.keys(manifest).length} complete. ` +
      `${imagesMade} images, about $${spent.toFixed(2)}.\n` +
      `Look at ${OUT_DIR} before generating any more.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
