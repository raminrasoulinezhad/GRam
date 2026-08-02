import { EXERCISES } from './data';
import { scoreQuery } from './search';
import type { Exercise, Muscle } from './types';

export * from './generated';
export * from './types';
export { EXERCISES };

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
  muscle?: Muscle | null;
  equipment?: string | null;
  category?: string | null;
  level?: string | null;
};

/**
 * Filters the catalog. Matching a muscle counts both primary and secondary involvement so
 * that "show me everything that hits triceps" includes bench press, which is what a lifter means.
 *
 * The text query is scored rather than substring-matched (see search.ts); when one is present
 * the results come back best-first instead of alphabetically.
 */
export function searchExercises(filters: CatalogFilters): Exercise[] {
  const scores = scoreQuery(filters.query ?? '');
  const out: Exercise[] = [];

  for (let i = 0; i < EXERCISES.length; i++) {
    const e = EXERCISES[i];
    if (scores !== null && !scores.has(e.id)) continue;
    if (filters.muscle) {
      if (
        !e.primaryMuscles.includes(filters.muscle) &&
        !e.secondaryMuscles.includes(filters.muscle)
      ) {
        continue;
      }
    }
    if (filters.equipment && e.equipment !== filters.equipment) continue;
    if (filters.category && e.category !== filters.category) continue;
    if (filters.level && e.level !== filters.level) continue;
    out.push(e);
  }

  // EXERCISES is already name-sorted, so with no query the natural order is alphabetical.
  if (scores !== null) out.sort((a, b) => scores.get(b.id)! - scores.get(a.id)!);
  return out;
}
