#!/usr/bin/env node
/**
 * Generates the exercise artwork this project owns, from text alone.
 *
 *   npm run art:probe                       one image, to see the house style
 *   npm run art -- --limit 10               the trial, on the default provider
 *   npm run art -- --limit 10 --provider huggingface
 *   npm run art:sheet                       build the side-by-side review page
 *   npm run art -- --all --provider cloudflare
 *
 * WHY THIS EXISTS
 * The photographs the app shows come from a dataset whose maintainer never said where he got
 * them, and whose public-domain dedication cannot cover material he did not own. Fine to link
 * to, not fine to build a paid product on. This makes the replacement.
 *
 * THE ONE RULE, AND THE REASON FOR EVERY DESIGN CHOICE BELOW
 * **The original photographs are never an input.** Not to the image model, not to the scorer,
 * not as a similarity target, not as something a loop converges towards. Feeding them in - image
 * to image, "inspired by", or a loop measuring how close the output is to theirs - produces a
 * derivative work, which is one of the exclusive rights of whoever owns them. Transformation is
 * not laundering, and a pipeline that optimises for similarity is a machine whose success
 * criterion is the legal test for infringement.
 *
 * The reference is instead a WRITTEN SPEC of how the movement is performed, derived from the
 * catalog's structured facts. How a bench press works is a procedure, and procedures are outside
 * copyright. The spec is ours, the prompt is ours, the output is ours.
 *
 *     spec  ->  generate  ->  score against spec  ->  amend prompt  ->  accept
 *
 * The loop asks "is this a correct depiction of this spec", never "is this close to their
 * picture". Same convergence; the target was the only thing that was ever wrong.
 *
 * WHAT IT DELIBERATELY DOES NOT READ
 * `images` and `instructions` from the catalog. The first is the material being replaced. The
 * second came from the same source with the same broken chain of title, so specs built from it
 * would reintroduce the problem through the back door. Everything the spec is built from is a
 * fact: name, equipment, mechanic, force, level, and which muscles the movement targets.
 *
 * WHY THE MODEL LICENCE MATTERS AS MUCH AS THE PROVIDER
 * FLUX.1-schnell is Apache 2.0 and explicitly permits commercial use. FLUX.1-dev does NOT: it
 * is non-commercial, it is the better-looking model, and it is the default in half the tutorials
 * online. Reaching for it would recreate exactly the problem this script exists to solve. Every
 * provider below is pinned to schnell for that reason and no other.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = resolve(ROOT, 'assets/data/exercises.json');
const OUT_DIR = resolve(ROOT, 'assets/generated');

/** Both dev hosts reply with a URL rather than the bytes, so fetch it and inline it. */
async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetching generated image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return { data: buf.toString('base64'), mime };
}

// ---------------------------------------------------------------------------- providers

/**
 * Where the pixels come from. Ordered by what to try first.
 *
 * Scoring and spec-writing always run on Gemini's FREE text tier, whichever of these renders
 * the image: only Gemini's *image* generation costs money, and its text and vision calls do not.
 * So cloudflare + gemini-for-scoring is a pipeline that costs nothing at all.
 */
const PROVIDERS = {
  /*
   * 10,000 neurons a day free, and schnell is 4.8 neurons per 512x512 tile. That is about
   * 2,000 images a day, so the whole catalog fits inside one day's free allowance.
   */
  cloudflare: {
    label: 'Cloudflare Workers AI, FLUX.1-schnell (Apache 2.0)',
    env: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    usdPerImage: 0,
    async render(prompt) {
      const account = process.env.CLOUDFLARE_ACCOUNT_ID;
      const model = process.env.CF_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-1-schnell';
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'content-type': 'application/json',
          },
          // steps caps at 8 on schnell; it is a 4-step distilled model, so 8 is the ceiling
          // and also the best quality it has.
          body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 8 }),
        },
      );
      if (!res.ok) throw new Error(`cloudflare ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const body = await res.json();
      const b64 = body?.result?.image ?? body?.image;
      if (!b64) throw new Error(`cloudflare: no image in reply: ${JSON.stringify(body).slice(0, 300)}`);
      return { data: b64, mime: 'image/jpeg' };
    },
  },

  /* Roughly a thousand requests a day free. Same model, so the same licence position. */
  huggingface: {
    label: 'Hugging Face Inference, FLUX.1-schnell (Apache 2.0)',
    env: ['HF_TOKEN'],
    usdPerImage: 0,
    async render(prompt) {
      const model = process.env.HF_IMAGE_MODEL ?? 'black-forest-labs/FLUX.1-schnell';
      const base = process.env.HF_ENDPOINT ?? 'https://api-inference.huggingface.co/models';
      const res = await fetch(`${base}/${model}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.HF_TOKEN}`,
          'content-type': 'application/json',
          accept: 'image/png',
        },
        body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
      });
      if (!res.ok) throw new Error(`huggingface ${res.status}: ${(await res.text()).slice(0, 400)}`);
      // Returns raw bytes rather than JSON.
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`huggingface: reply too small to be an image: ${buf.toString().slice(0, 200)}`);
      return { data: buf.toString('base64'), mime: 'image/png' };
    },
  },

  /*
   * Your own RTX 3050. Free and unlimited, so retries cost time rather than money, which is
   * what makes it the right home for the stubborn tail of the catalog.
   *
   * Needs a local server on LOCAL_IMAGE_URL accepting {"prompt": "..."} and replying with
   * either raw image bytes or {"image": "<base64>"}. See docs/IMAGE-LICENCE.md for how to
   * stand one up on 6GB of VRAM.
   */
  local: {
    label: 'Local FLUX.1-schnell (Apache 2.0)',
    env: ['LOCAL_IMAGE_URL'],
    usdPerImage: 0,
    async render(prompt) {
      const res = await fetch(process.env.LOCAL_IMAGE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, steps: 4 }),
      });
      if (!res.ok) throw new Error(`local ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const type = res.headers.get('content-type') ?? '';
      if (type.startsWith('image/')) {
        return { data: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: type };
      }
      const body = await res.json();
      if (!body.image) throw new Error('local: reply had no image field');
      return { data: body.image, mime: body.mime ?? 'image/png' };
    },
  },

  /*
   * FLUX.1-dev through a host that has licensed it. The quality ceiling.
   *
   * READ THIS BEFORE ASSUMING dev IS OFF LIMITS. The Apache-2.0 model is schnell; dev ships
   * under a NON-COMMERCIAL licence, which is true of the weights you download and NOT of every
   * route to the model. fal.ai and Replicate hold commercial licences from Black Forest Labs
   * and pass those rights to the outputs you generate through them. So dev is usable here, via
   * these hosts and only via these hosts. Downloading the dev weights and running them locally
   * for this project would not be.
   */
  fal: {
    label: 'fal.ai, FLUX.1-dev (commercially licensed by the host)',
    env: ['FAL_KEY'],
    // $0.025 per megapixel, rounded up. 768x768 is 0.59MP, so one megapixel's worth.
    usdPerImage: 0.025,
    async render(prompt) {
      const res = await fetch(process.env.FAL_MODEL_URL ?? 'https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: { width: 768, height: 768 },
          num_images: 1,
          // dev is a guidance-distilled model; 28 steps is its usual sweet spot.
          num_inference_steps: 28,
        }),
      });
      if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const body = await res.json();
      const url = body?.images?.[0]?.url;
      if (!url) throw new Error(`fal: no image url: ${JSON.stringify(body).slice(0, 300)}`);
      return fetchImage(url);
    },
  },

  replicate: {
    label: 'Replicate, FLUX.1-dev (commercially licensed by the host)',
    env: ['REPLICATE_API_TOKEN'],
    usdPerImage: 0.03,
    async render(prompt) {
      const model = process.env.REPLICATE_MODEL ?? 'black-forest-labs/flux-dev';
      const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'content-type': 'application/json',
          // Blocks until the prediction finishes, so there is no polling loop to get wrong.
          prefer: 'wait',
        },
        body: JSON.stringify({
          input: { prompt, aspect_ratio: '1:1', output_format: 'jpg', num_outputs: 1 },
        }),
      });
      if (!res.ok) throw new Error(`replicate ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const body = await res.json();
      const url = Array.isArray(body?.output) ? body.output[0] : body?.output;
      if (typeof url !== 'string') {
        throw new Error(`replicate: no output url (status ${body?.status}): ${JSON.stringify(body).slice(0, 300)}`);
      }
      return fetchImage(url);
    },
  },

  /* The paid fallback for whatever the free three cannot get right. Best prompt adherence. */
  gemini: {
    label: 'Gemini image (paid, best anatomy)',
    env: ['GEMINI_API_KEY'],
    usdPerImage: 0.039,
    async render(prompt) {
      const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
      const payload = await gemini(model, { contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      const image = firstImage(payload);
      if (!image) throw new Error(`gemini: no image; got ${allText(payload).slice(0, 200)}`);
      return image;
    },
  },
};

// ---------------------------------------------------------------------------- style

/**
 * The house style, applied identically to every frame.
 *
 * This paragraph is why the output will look like a set rather than a scrapbook. It is the one
 * thing neither Wikimedia nor a stock library can offer at any price, and it is also the only
 * knob worth turning if the trial comes out ugly: change this, rerun, compare.
 *
 * Describes a NEUTRAL studio. No named athlete, no brand, and no reproduction of any particular
 * photograph's framing or lighting.
 */
/**
 * Which athlete the frame depicts.
 *
 * Half the catalog is drawn female and half male, assigned deterministically from the exercise
 * id, so an app whose owner declined to state a sex is not shown 896 men. Mirrors
 * src/lib/figure.ts exactly, including the hash, so the generated photograph and the drawn
 * fallback glyph never disagree about the same exercise.
 */
function figureFor(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2 === 0 ? 'female' : 'male';
}

const STYLE = [
  'Semi-realistic 3D-rendered instructional illustration of a single anonymous athlete.',
  'Neutral matte mid-grey seamless studio background, no room, no windows, and no equipment',
  'except what the exercise requires. Soft even three-point studio lighting, no harsh shadows.',
  'Plain unbranded charcoal athletic clothing: fitted shorts and a plain fitted top.',
  'Neutral generic facial features, no recognisable individual.',
  'Full body in frame with a small margin, camera at chest height.',
  'Clean, calm, anatomically accurate. No text, no logos, no watermarks, no motion blur.',
].join(' ');

// ---------------------------------------------------------------------------- args

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const value = (f, d) => {
  const at = argv.indexOf(f);
  return at === -1 || at === argv.length - 1 ? d : argv[at + 1];
};

const PROVIDER = value('--provider', 'cloudflare');
const LIMIT = has('--all') ? Infinity : Number(value('--limit', 10));
const MAX_ATTEMPTS = Number(value('--attempts', 3));
const ONLY = value('--only', null);
const DRY = has('--dry-run');

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-flash';

let spent = 0;
let made = 0;

// ---------------------------------------------------------------------------- gemini (text + vision, free tier)

async function gemini(model, body) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

const partsOf = (p) => p?.candidates?.[0]?.content?.parts ?? [];
function firstImage(payload) {
  for (const part of partsOf(payload)) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) return { data: inline.data, mime: inline.mimeType ?? inline.mime_type ?? 'image/png' };
  }
  return null;
}
const allText = (p) => partsOf(p).map((x) => x.text ?? '').join('').trim();

function parseJson(text, what) {
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = clean.indexOf('{');
  const b = clean.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error(`${what}: no JSON:\n${text.slice(0, 250)}`);
  return JSON.parse(clean.slice(a, b + 1));
}

// ---------------------------------------------------------------------------- stage 1: spec

function specPrompt(e) {
  return `You are a strength coach writing a precise, factual description of how one exercise is
performed, so an illustrator who has never seen it can draw it correctly.

Exercise name: ${e.name}
Equipment: ${e.equipment ?? 'bodyweight'}
Force: ${e.force ?? 'unspecified'}
Mechanic: ${e.mechanic ?? 'unspecified'}
Level: ${e.level}
Primary muscles: ${e.primaryMuscles.join(', ') || 'unspecified'}
Secondary muscles: ${e.secondaryMuscles.join(', ') || 'none'}

Describe the START and END positions as two separate still frames. Be concrete about body
orientation, joint angles, limb positions, grip, stance width and where the load sits. Describe
only the athlete and the equipment: say nothing about clothing, lighting, background, setting or
camera style, which are fixed elsewhere.

Reply with JSON only:
{
  "summary": "one sentence naming the movement pattern",
  "equipment": "exactly what apparatus must appear, or 'none'",
  "view": "the camera angle showing this most clearly: 'side', 'three-quarter', 'front' or 'rear'",
  "start": "one paragraph describing the start frame",
  "end": "one paragraph describing the end frame",
  "mustShow": ["3 to 5 short checkable facts"]
}`;
}

async function writeSpec(e) {
  const payload = await gemini(TEXT_MODEL, {
    contents: [{ role: 'user', parts: [{ text: specPrompt(e) }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  return parseJson(allText(payload), `spec ${e.id}`);
}

// ---------------------------------------------------------------------------- stage 2: render

function framePrompt(spec, frame, critique, figure = 'male') {
  return [
    STYLE,
    `The athlete is ${figure}.`,
    `Camera: ${spec.view} view.`,
    `Equipment that must be present: ${spec.equipment}.`,
    `Depict this exact position: ${frame === 'start' ? spec.start : spec.end}`,
    `The image must clearly show: ${(spec.mustShow ?? []).join('; ')}.`,
    critique ? `Correct these faults from the previous attempt: ${critique}` : '',
  ].filter(Boolean).join('\n');
}

async function render(provider, prompt) {
  const image = await PROVIDERS[provider].render(prompt);
  spent += PROVIDERS[provider].usdPerImage;
  made += 1;
  return image;
}

// ---------------------------------------------------------------------------- stage 3: score

/**
 * Marks the render against the spec, and against nothing else.
 *
 * The image it sees is the one we just made; the standard is our own written spec. No original
 * photograph enters this comparison, which is exactly what separates this loop from one that
 * would get us sued.
 */
async function score(image, spec, frame) {
  const prompt = `You are checking whether an instructional exercise illustration is correct.

It should show the ${frame.toUpperCase()} position of: ${spec.summary}

Required position: ${frame === 'start' ? spec.start : spec.end}
Required equipment: ${spec.equipment}
Must clearly show: ${(spec.mustShow ?? []).join('; ')}

Also check for anatomical errors: wrong number of limbs or digits, impossible joint angles,
floating or merged equipment, a second person, visible text or logos.

Reply with JSON only:
{"ok": true|false, "issues": ["short specific faults"], "promptFix": "one sentence for the illustrator"}`;

  const payload = await gemini(TEXT_MODEL, {
    contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.data } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  return parseJson(allText(payload), `score ${spec.summary}`);
}

// ---------------------------------------------------------------------------- the loop

async function buildFrame(provider, spec, frame, figure) {
  let critique = '';
  const attempts = [];
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const image = await render(provider, framePrompt(spec, frame, critique, figure));
    const verdict = await score(image, spec, frame);
    attempts.push({ attempt: n, ok: verdict.ok, issues: verdict.issues ?? [] });
    if (verdict.ok) return { image, attempts, accepted: true };
    critique = verdict.promptFix || (verdict.issues ?? []).join('; ');
    console.log(`      ${frame} attempt ${n} rejected: ${(verdict.issues ?? []).join('; ') || '?'}`);
  }
  // Out of attempts: the row falls back to the licensed tier or the drawn glyph. That path
  // already exists and is already tested, so a miss costs a picture, not a broken screen.
  return { image: null, attempts, accepted: false };
}

// ---------------------------------------------------------------------------- review page

/**
 * A side-by-side page of everything generated so far, grouped by exercise, one column per
 * provider. Quality is the whole question, and it cannot be answered from a manifest.
 */
function buildSheet() {
  const providers = readdirSync(OUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name in PROVIDERS)
    .map((d) => d.name);
  if (providers.length === 0) return console.log('nothing generated yet');

  const ids = new Set();
  for (const p of providers) {
    for (const d of readdirSync(resolve(OUT_DIR, p), { withFileTypes: true })) {
      if (d.isDirectory()) ids.add(d.name);
    }
  }

  const cell = (p, id, frame) => {
    const rel = `${p}/${id}/${frame}.png`;
    return existsSync(resolve(OUT_DIR, rel))
      ? `<img src="${rel}" alt="${id} ${frame}">`
      : `<div class="miss">no ${frame}</div>`;
  };

  const rows = [...ids].sort().map((id) => {
    const cols = providers
      .map((p) => `<td><div class="pair">${cell(p, id, 'start')}${cell(p, id, 'end')}</div></td>`)
      .join('');
    return `<tr><th>${id.replace(/_/g, ' ')}</th>${cols}</tr>`;
  });

  const html = `<!doctype html><meta charset="utf-8"><title>GRam artwork review</title>
<style>
 body{font:14px system-ui;margin:24px;background:#0B1220;color:#E8EDF7}
 h1{font-size:20px} p{color:#93A1BA}
 table{border-collapse:collapse;width:100%} th,td{border-bottom:1px solid #26334A;padding:10px;vertical-align:top}
 th{text-align:left;color:#93A1BA;font-weight:600;width:150px}
 thead th{color:#4ADE80}
 .pair{display:flex;gap:8px} .pair img{width:190px;height:auto;border-radius:8px;background:#fff}
 .miss{width:190px;height:120px;display:grid;place-items:center;color:#64748B;border:1px dashed #26334A;border-radius:8px}
</style>
<h1>GRam artwork review</h1>
<p>Same spec, same style paragraph, one column per provider. Left image is the start frame, right is the end frame.</p>
<table><thead><tr><th>Exercise</th>${providers.map((p) => `<th>${PROVIDERS[p].label}</th>`).join('')}</tr></thead>
<tbody>${rows.join('\n')}</tbody></table>`;

  const file = resolve(OUT_DIR, 'review.html');
  writeFileSync(file, html);
  console.log(`wrote ${file}\n${ids.size} exercises, ${providers.length} provider(s): ${providers.join(', ')}`);
}

// ---------------------------------------------------------------------------- main

async function probe() {
  const p = PROVIDERS[PROVIDER];
  console.log(`${p.label}\n`);
  const image = await render(
    PROVIDER,
    `${STYLE}\nCamera: side view.\nEquipment that must be present: a flat bench and a barbell.\n` +
      'Depict this exact position: an athlete lying supine on a flat bench, feet flat on the floor, ' +
      'holding a barbell at arms length above the chest with a shoulder-width grip.',
  );
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `probe-${PROVIDER}.png`);
  writeFileSync(file, Buffer.from(image.data, 'base64'));
  console.log(`wrote ${file}`);
}

function checkEnv() {
  const p = PROVIDERS[PROVIDER];
  if (!p) throw new Error(`unknown provider "${PROVIDER}". One of: ${Object.keys(PROVIDERS).join(', ')}`);
  const missing = [...p.env, 'GEMINI_API_KEY'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `${p.label}\n\nMissing: ${missing.join(', ')}\n\n` +
        'GEMINI_API_KEY is needed whichever provider renders: the spec writing and the scoring\n' +
        'run on Gemini text and vision, which are on the free tier.\n' +
        'See docs/IMAGE-LICENCE.md for where each token comes from.\n',
    );
    process.exit(1);
  }
}

async function main() {
  if (has('--sheet')) return buildSheet();
  checkEnv();
  if (has('--probe')) return probe();

  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  let queue = ONLY ? catalog.filter((e) => e.id === ONLY) : catalog;
  if (queue.length === 0) throw new Error(`nothing matches --only ${ONLY}`);

  /*
   * Trial order is deliberate: the most commonly logged movements first, then some awkward
   * ones. A style that survives a squat, a cable fly and a plank will survive most of the
   * catalog; one judged only on easy exercises tells you nothing.
   */
  const HEAD = [
    'Barbell_Full_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Deadlift', 'Pullups',
    'Barbell_Curl', 'Plank', 'Cable_Crossover', 'Dumbbell_Bench_Press',
    'Standing_Military_Press', 'Romanian_Deadlift',
  ];
  const rank = (e) => (HEAD.indexOf(e.id) === -1 ? HEAD.length : HEAD.indexOf(e.id));
  queue = queue.sort((a, b) => rank(a) - rank(b)).slice(0, LIMIT);

  const provDir = resolve(OUT_DIR, PROVIDER);
  const manifestFile = resolve(provDir, 'manifest.json');
  console.log(
    `${PROVIDERS[PROVIDER].label}\n${queue.length} exercises x 2 frames, up to ${MAX_ATTEMPTS} attempts.\n` +
      (PROVIDERS[PROVIDER].usdPerImage === 0
        ? 'free tier, no per-image charge\n'
        : `about $${(queue.length * 2 * PROVIDERS[PROVIDER].usdPerImage).toFixed(2)} best case\n`),
  );
  if (DRY) return queue.forEach((e) => console.log(`  would build ${e.id}`));

  mkdirSync(provDir, { recursive: true });
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};

  for (const e of queue) {
    if (manifest[e.id]?.complete) {
      console.log(`  skip  ${e.id}`);
      continue;
    }
    console.log(`  build ${e.id}`);
    const dir = resolve(provDir, e.id);
    try {
      const spec = await writeSpec(e);
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'spec.json'), JSON.stringify(spec, null, 2));

      const figure = figureFor(e.id);
      const record = { provider: PROVIDER, spec, figure, frames: {}, complete: false };
      for (const frame of ['start', 'end']) {
        const { image, attempts, accepted } = await buildFrame(PROVIDER, spec, frame, figure);
        if (image) writeFileSync(resolve(dir, `${frame}.png`), Buffer.from(image.data, 'base64'));
        record.frames[frame] = { accepted, attempts };
        console.log(`      ${frame}: ${accepted ? 'accepted' : 'FELL BACK'} after ${attempts.length}`);
      }
      record.complete = Object.values(record.frames).every((f) => f.accepted);
      manifest[e.id] = record;
    } catch (error) {
      console.error(`      failed: ${error.message}`);
      manifest[e.id] = { error: String(error.message), complete: false };
    }
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  }

  const done = Object.values(manifest).filter((r) => r.complete).length;
  console.log(
    `\n${done}/${Object.keys(manifest).length} complete, ${made} images` +
      (spent > 0 ? `, about $${spent.toFixed(2)}` : ', free') +
      `\n\nNow run:  npm run art:sheet   and open ${resolve(OUT_DIR, 'review.html')}`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
