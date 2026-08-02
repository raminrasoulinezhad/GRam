import { EXERCISES } from './data';
import { recommendedRanks } from './recommended';
import { muscleTermsIn, scoreQuery } from './search';
import type { Exercise, Muscle } from './types';

export * from './generated';
export * from './perSide';
export * from './recommended';
export * from './types';
export { EXERCISES, muscleTermsIn };

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

/** Never throws - a plan referencing a since-removed exercise degrades to a placeholder row. */
export function exerciseName(id: string): string {
  return BY_ID.get(id)?.name ?? 'Unknown exercise';
}

/**
 * Demonstration photographs, served from the upstream repository at runtime.
 * Their licence is unresolved - see THIRD-PARTY-NOTICES.md.
 */
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export function imageUrl(path: string): string {
  return IMAGE_BASE + path;
}

export type CatalogFilters = {
  query?: string;
  /**
   * Keeps only exercises whose PRIMARY muscle this is. Several may be given, which is how a
   * group like "back" works - the dataset splits it into lats and middle back, and nobody
   * filters for one without the other.
   *
   * Deliberately stricter than the text search, which also matches assistance work and ranks it
   * lower. The chip is a shortcut to "show me chest exercises", and answering it with the
   * hundred movements that merely involve the chest makes it useless as a shortcut. If you want
   * the wider set, type the muscle instead.
   */
  muscle?: Muscle | Muscle[] | null;
  equipment?: string | null;
  category?: string | null;
  level?: string | null;
  /**
   * exerciseId -> how many sets of it the user has recorded. Only consulted for a muscle
   * search, where it decides the order below the recommended picks. Omit it and the ordering
   * simply falls through to relevance.
   */
  history?: ReadonlyMap<string, number> | null;
};

/**
 * Filters the catalog. Matching a muscle counts both primary and secondary involvement so
 * that "show me everything that hits triceps" includes bench press, which is what a lifter means.
 *
 * The text query is scored rather than substring-matched (see search.ts); when one is present
 * the results come back best-first instead of alphabetically.
 *
 * A search that names a muscle - the chip, or a word like "chest" or "quads" - is ordered
 * differently, in three bands: the two exercises the evidence recommends for that muscle, then
 * whatever the user has actually recorded, most-trained first, then everything else by
 * relevance. Ordinary name searches are left alone; "bench press" should answer with bench
 * presses, not with a coach's opinion.
 */
export function searchExercises(filters: CatalogFilters): Exercise[] {
  const scores = scoreQuery(filters.query ?? '');
  const chosen = asMuscles(filters.muscle);
  const focus = focusMuscles(filters);
  const ranks = focus.length > 0 ? recommendedRanks(focus) : null;
  const out: Exercise[] = [];

  for (let i = 0; i < EXERCISES.length; i++) {
    const e = EXERCISES[i];
    if (scores !== null && !scores.has(e.id)) continue;
    // The primary-muscle rule has one exception: a recommended pick always shows up in its own
    // muscle's list. The Romanian deadlift is one of the two best glute exercises and the
    // dataset files glutes as secondary to hamstrings; hiding it from the Glutes chip would be
    // the classification winning an argument it should not be in.
    if (
      chosen.length > 0 &&
      !e.primaryMuscles.some((m) => chosen.includes(m)) &&
      !ranks?.has(e.id)
    ) {
      continue;
    }
    if (filters.equipment && e.equipment !== filters.equipment) continue;
    if (filters.category && e.category !== filters.category) continue;
    if (filters.level && e.level !== filters.level) continue;
    out.push(e);
  }

  if (ranks !== null) {
    const history = filters.history;
    // Array.prototype.sort is stable, so exercises equal on all three keys keep the
    // alphabetical order EXERCISES already has.
    out.sort((a, b) => {
      const ra = ranks.get(a.id) ?? Infinity;
      const rb = ranks.get(b.id) ?? Infinity;
      if (ra !== rb) return ra - rb;

      const ha = history?.get(a.id) ?? 0;
      const hb = history?.get(b.id) ?? 0;
      if (ha !== hb) return hb - ha;

      return (scores?.get(b.id) ?? 0) - (scores?.get(a.id) ?? 0);
    });
    return out;
  }

  // EXERCISES is already name-sorted, so with no query the natural order is alphabetical.
  if (scores !== null) out.sort((a, b) => scores.get(b.id)! - scores.get(a.id)!);
  return out;
}

/** Normalises the one-or-many muscle filter to a list. */
function asMuscles(value: Muscle | Muscle[] | null | undefined): Muscle[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Which muscles this search is about: the filter chip, plus any muscle named in the text. */
export function focusMuscles(filters: CatalogFilters): Muscle[] {
  const fromQuery = muscleTermsIn(filters.query ?? '');
  const chosen = asMuscles(filters.muscle).filter((m) => !fromQuery.includes(m));
  return [...chosen, ...fromQuery];
}
