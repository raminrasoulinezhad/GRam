import { EXERCISES } from './data';
import { MUSCLES, type Muscle } from './generated';

/**
 * Forgiving text search over the catalog.
 *
 * The naive version - lowercase the name, check `includes` for every word - fails on almost
 * everything a person actually types. "pushup" misses "Push-Up" because of the hyphen. "bicep"
 * misses "Biceps". "db curl" misses "Dumbbell Curl". "chest" finds only the eleven exercises
 * with the word chest in their title and none of the two hundred that train it.
 *
 * So a term here is matched against four things - the name, the muscles, the equipment, and the
 * category - through a chain that gets progressively looser: exact word, prefix, stem,
 * punctuation-free run, synonym, and finally a one- or two-character typo. Every rung scores
 * lower than the one above it, results are ranked by the total, and an exercise is only dropped
 * when a term matches nothing at all.
 *
 * The ranking is what makes searching by muscle usable: type "chest" and the exercises named
 * for it come first, then everything that has chest as a primary muscle, then the assistance
 * work. All of it is there, in the order you would want it.
 */

/** Splits on anything that is not a letter or digit, so "Push-Up" and "push up" agree. */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** All punctuation removed: "push-up" and "pushup" both become "pushup". */
function squash(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Crude suffix stripping - enough to make singular and plural agree, which is the only case
 * that matters here. Both the query and the catalog go through it, so "curls" -> "curl" and
 * "Curls" -> "curl" meet in the middle. Irregulars (calf/calves) are handled as synonyms.
 */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * What people type on the left, what the catalog calls it on the right.
 *
 * Each entry is a list of alternative phrases; a phrase matches only when all of its words do,
 * so "ohp" -> "overhead press" requires both. Several alternatives means any one will do, which
 * is how "legs" reaches four separate muscles.
 */
const SYNONYMS: Record<string, string[]> = {
  // Kit shorthand.
  db: ['dumbbell'],
  bb: ['barbell'],
  kb: ['kettlebells'],
  ez: ['e z curl bar'],
  bw: ['body only'],
  bodyweight: ['body only'],
  calisthenics: ['body only'],
  band: ['bands'],
  smith: ['smith machine'],

  // Lift shorthand.
  ohp: ['overhead press', 'shoulder press'],
  rdl: ['romanian deadlift'],
  sldl: ['stiff leg deadlift'],
  dl: ['deadlift'],
  bp: ['bench press'],
  gm: ['good morning'],
  hspu: ['handstand push up'],
  amrap: [],

  // Muscles as a lifter names them.
  ab: ['abdominals'],
  abs: ['abdominals'],
  core: ['abdominals'],
  stomach: ['abdominals'],
  belly: ['abdominals'],
  oblique: ['abdominals'],
  bi: ['biceps'],
  bis: ['biceps'],
  bicep: ['biceps'],
  tri: ['triceps'],
  tris: ['triceps'],
  tricep: ['triceps'],
  delt: ['shoulders'],
  delts: ['shoulders'],
  deltoid: ['shoulders'],
  deltoids: ['shoulders'],
  shoulder: ['shoulders'],
  pec: ['chest'],
  pecs: ['chest'],
  pectoral: ['chest'],
  pectorals: ['chest'],
  lat: ['lats'],
  latissimus: ['lats'],
  back: ['lats', 'middle back', 'lower back'],
  quad: ['quadriceps'],
  quads: ['quadriceps'],
  thigh: ['quadriceps', 'hamstrings'],
  thighs: ['quadriceps', 'hamstrings'],
  ham: ['hamstrings'],
  hams: ['hamstrings'],
  hammy: ['hamstrings'],
  hamstring: ['hamstrings'],
  glute: ['glutes'],
  butt: ['glutes'],
  bum: ['glutes'],
  hip: ['glutes', 'abductors', 'adductors'],
  hips: ['glutes', 'abductors', 'adductors'],
  calf: ['calves'],
  trap: ['traps'],
  trapezius: ['traps'],
  forearm: ['forearms'],
  wrist: ['forearms'],
  wrists: ['forearms'],
  grip: ['forearms'],
  leg: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  arm: ['biceps', 'triceps', 'forearms'],
  arms: ['biceps', 'triceps', 'forearms'],
  upperbody: ['chest', 'lats', 'shoulders'],

  // Categories under everyday names.
  stretch: ['stretching'],
  mobility: ['stretching'],
  flexibility: ['stretching'],
  plyo: ['plyometrics'],
  oly: ['olympic weightlifting'],
  olympic: ['olympic weightlifting'],
  conditioning: ['cardio'],
  aerobic: ['cardio'],
  novice: ['beginner'],
  easy: ['beginner'],
  advanced: ['expert'],
  hard: ['expert'],
};

type Doc = {
  /** Words of the name, e.g. ["incline", "dumbbell", "press"]. */
  name: string[];
  nameStems: string[];
  /** Letter set per name word, for the typo prefilter. */
  nameMasks: number[];
  /** The whole name, punctuation removed, for "pushup" -> "push-up". */
  squashed: string;
  primary: string[];
  primaryStems: string[];
  secondary: string[];
  secondaryStems: string[];
  equipment: string[];
  /** category, level, force, mechanic - the low-value facets. */
  facets: string[];
};

/**
 * Names the dataset does not use for movements people look up by a different one.
 *
 * This is per exercise on purpose. The word-level SYNONYMS table below cannot express these:
 * mapping "plank" to "bridge" would make a search for planks return glute bridges, and mapping
 * "bicycle" to "air" is nonsense outside this one entry. The alias is attached to the exercise
 * it actually describes.
 *
 * Only for a genuinely different name for the same movement - not for near-misses. If a search
 * returns the wrong exercise because of ranking rather than vocabulary, that is a scoring
 * problem and belongs in SCORE, not here.
 */
const ALSO_KNOWN_AS: Record<string, string[]> = {
  // The dataset's word is "bridge"; everyone else's is "plank".
  Side_Bridge: ['side plank'],
  // Not the fan bike - this one is lying on the floor. The cardio machine is FitRam_Fan_Bike,
  // and confusing the two is easy enough that the alias is worth having.
  Air_Bike: ['bicycle crunch', 'bicycle kicks'],
  // "Butterfly" is the dataset's name for the machine everyone calls the pec deck.
  Butterfly: ['pec deck', 'chest fly machine'],
  Thigh_Adductor: ['inner thigh', 'adductor machine'],
  Thigh_Abductor: ['outer thigh', 'abductor machine'],
  Hyperextensions_Back_Extensions: ['hyperextension', 'roman chair'],
  'Lying_T-Bar_Row': ['t bar row'],
  Cable_Crossover: ['cable fly', 'cable flye'],
  Standing_Military_Press: ['overhead press', 'ohp', 'strict press'],
  Lying_Triceps_Press: ['skull crusher', 'skullcrusher'],
  'Chin-Up': ['chinup'],
  Pullups: ['pull up', 'pullup'],
  Barbell_Full_Squat: ['back squat'],
  Bent_Over_Barbell_Row: ['barbell row', 'bent over row'],
};

/** An exercise's searchable words: its own name, plus any alias, without repeats. */
function withAliases(id: string, name: string[]): string[] {
  const extra = ALSO_KNOWN_AS[id];
  if (extra === undefined) return name;
  // Deduped so a word appearing in both the name and an alias is not scored twice.
  return [...new Set([...name, ...extra.flatMap(tokenize)])];
}

/**
 * Built once at module load, with every stem precomputed.
 *
 * Everything in here exists so that the per-keystroke pass does no string allocation at all:
 * scoring a query walks arrays of already-lowercased, already-stemmed strings and compares
 * them, and nothing inside the loop over 879 exercises calls stem() or squash().
 */
const DOCS: Doc[] = EXERCISES.map((e) => {
  const name = withAliases(e.id, tokenize(e.name));
  const primary = e.primaryMuscles.flatMap((m) => [m, ...tokenize(m)]);
  const secondary = e.secondaryMuscles.flatMap((m) => [m, ...tokenize(m)]);
  return {
    name,
    nameStems: name.map(stem),
    nameMasks: name.map(letterMask),
    squashed: squash(e.name),
    primary,
    primaryStems: primary.map(stem),
    secondary,
    secondaryStems: secondary.map(stem),
    equipment: e.equipment ? tokenize(e.equipment) : [],
    facets: [e.category, e.level, e.force, e.mechanic].filter(Boolean).flatMap((v) => tokenize(v!)),
  };
});

const SCORE = {
  exactWord: 100,
  prefix: 82,
  stemmed: 76,
  squashed: 60,
  equipment: 46,
  primaryMuscle: 44,
  facet: 34,
  secondaryMuscle: 28,
  typo: 16,
} as const;

/**
 * A 26-bit set of the letters a word contains.
 *
 * Used to reject hopeless typo candidates before paying for Levenshtein. One edit changes the
 * letter set by at most two bits - a substitution can drop one letter and introduce another -
 * so two words differing by more than 2*max bits cannot be within `max` edits. Most of the
 * catalog is thrown out by this before a matrix is ever allocated.
 */
function letterMask(word: string): number {
  let mask = 0;
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - 97;
    if (c >= 0 && c < 26) mask |= 1 << c;
  }
  return mask;
}

function bitCount(n: number): number {
  let v = n - ((n >> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  return (((v + (v >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

/** True when `a` and `b` differ by at most `max` insertions, deletions or substitutions. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;

  // Bounded Levenshtein, single row. Bails as soon as the whole row exceeds the budget.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

/** A query word with its derived forms computed once, not once per exercise. */
type Word = { raw: string; stem: string; squashed: string; mask: number };

function prepare(raw: string): Word {
  return { raw, stem: stem(raw), squashed: squash(raw), mask: letterMask(raw) };
}

/** A query term: the word as typed, plus the synonym phrases it may also stand for. */
type Term = { word: Word; alts: Word[][] };

function prepareTerms(query: string): Term[] {
  return tokenize(query).map((raw) => ({
    word: prepare(raw),
    alts: (SYNONYMS[raw] ?? []).map((phrase) => phrase.split(' ').map(prepare)),
  }));
}

function matchesAny(list: string[], stems: string[], w: Word): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === w.raw || stems[i] === w.stem) return true;
  }
  return false;
}

/** How well one word of the query fits one exercise. 0 means it does not fit at all. */
function wordScore(w: Word, doc: Doc, allowTypo: boolean): number {
  let best = 0;
  for (let i = 0; i < doc.name.length; i++) {
    const t = doc.name[i];
    if (t === w.raw) return SCORE.exactWord;
    if (t.startsWith(w.raw)) {
      if (SCORE.prefix > best) best = SCORE.prefix;
    } else if (doc.nameStems[i] === w.stem) {
      if (SCORE.stemmed > best) best = SCORE.stemmed;
    }
  }
  if (best > 0) return best;

  if (w.raw.length >= 3 && doc.squashed.includes(w.squashed)) return SCORE.squashed;

  for (const t of doc.equipment) if (t === w.raw || t.startsWith(w.raw)) return SCORE.equipment;
  if (matchesAny(doc.primary, doc.primaryStems, w)) return SCORE.primaryMuscle;
  for (const t of doc.facets) if (t === w.raw || t.startsWith(w.raw)) return SCORE.facet;
  if (matchesAny(doc.secondary, doc.secondaryStems, w)) return SCORE.secondaryMuscle;

  if (allowTypo && w.raw.length >= 4) {
    const max = w.raw.length >= 7 ? 2 : 1;
    for (let i = 0; i < doc.name.length; i++) {
      if (bitCount(doc.nameMasks[i] ^ w.mask) > 2 * max) continue;
      if (within(doc.name[i], w.raw, max)) return SCORE.typo;
    }
  }
  return 0;
}

/**
 * How well one term fits, taking the best reading of it. A synonym phrase only counts when
 * every word of it matches, and scores as its weakest word.
 */
function termScore(term: Term, doc: Doc, allowTypo: boolean): number {
  let best = wordScore(term.word, doc, allowTypo);
  if (best === SCORE.exactWord) return best;

  for (const phrase of term.alts) {
    let weakest = Infinity;
    for (const word of phrase) {
      // Never fuzzy-match a synonym: a near-miss on a word we guessed is guessing twice.
      const s = wordScore(word, doc, false);
      if (s === 0) {
        weakest = 0;
        break;
      }
      if (s < weakest) weakest = s;
    }
    // A synonym is a guess about intent, so it never outranks a literal hit.
    if (weakest > 0 && weakest !== Infinity && weakest - 2 > best) best = weakest - 2;
  }
  return best;
}

/** One scoring pass over the catalog. `allowTypo` is the expensive half. */
function pass(terms: Term[], wholeSquashed: string, allowTypo: boolean): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < EXERCISES.length; i++) {
    const doc = DOCS[i];
    let total = 0;
    let matched = true;
    for (const term of terms) {
      const s = termScore(term, doc, allowTypo);
      if (s === 0) {
        matched = false;
        break;
      }
      total += s;
    }
    if (!matched) continue;

    // "bench pr" should put Bench Press above Bench Sprint: reward the query reading as the
    // opening of the name, and prefer the shorter of two otherwise equal names.
    if (doc.squashed.startsWith(wholeSquashed)) total += 50;
    total -= Math.min(20, doc.name.length);

    out.set(EXERCISES[i].id, total);
  }
  return out;
}

export function scoreQuery(query: string): Map<string, number> | null {
  const terms = prepareTerms(query);
  if (terms.length === 0) return null;

  const wholeSquashed = squash(query);

  // Typo correction is the only expensive rung - a bounded Levenshtein against every word of
  // every name - and it is also the only one that can be skipped on evidence. If the query
  // matched anything at all when read literally, the user did not make a typo, so we never pay
  // for it. That is the overwhelmingly common case, and it keeps a keystroke off the main
  // thread's critical path on a phone.
  const literal = pass(terms, wholeSquashed, false);
  if (literal.size > 0) return literal;

  return pass(terms, wholeSquashed, true);
}

const MUSCLE_SET: ReadonlySet<string> = new Set(MUSCLES);
const MUSCLE_STEMS: ReadonlyMap<string, Muscle> = new Map(MUSCLES.map((m) => [stem(m), m]));

/**
 * The muscles a query is asking about, if any.
 *
 * "chest", "pecs" and "legs" are all muscle searches; "bench press" is not. This is what turns
 * on the recommendation ordering, so it deliberately only fires on words that name a muscle -
 * an exercise name that merely happens to train something does not count.
 */
export function muscleTermsIn(query: string): Muscle[] {
  const found = new Set<Muscle>();
  for (const raw of tokenize(query)) {
    if (MUSCLE_SET.has(raw)) {
      found.add(raw as Muscle);
      continue;
    }
    const byStem = MUSCLE_STEMS.get(stem(raw));
    if (byStem) found.add(byStem);
    // "abs" -> abdominals, "legs" -> four separate muscles.
    for (const phrase of SYNONYMS[raw] ?? []) {
      if (MUSCLE_SET.has(phrase)) found.add(phrase as Muscle);
    }
  }
  return [...found];
}
