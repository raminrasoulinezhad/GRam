import raw from '../../assets/data/exercises.json';
import type { Exercise, Muscle } from './types';

export * from './generated';
export * from './types';

export const EXERCISES = raw as Exercise[];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Lowercased names, index-aligned with EXERCISES, so search never re-lowercases 873 strings. */
const SEARCH_INDEX = EXERCISES.map((e) => e.name.toLowerCase());

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

/** Never throws - a plan referencing a since-removed exercise degrades to a placeholder row. */
export function exerciseName(id: string): string {
  return BY_ID.get(id)?.name ?? 'Unknown exercise';
}

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
 */
export function searchExercises(filters: CatalogFilters): Exercise[] {
  const q = filters.query?.trim().toLowerCase() ?? '';
  const terms = q.length > 0 ? q.split(/\s+/) : [];
  const out: Exercise[] = [];

  for (let i = 0; i < EXERCISES.length; i++) {
    const e = EXERCISES[i];
    if (terms.length > 0) {
      const haystack = SEARCH_INDEX[i];
      let matched = true;
      for (const t of terms) {
        if (!haystack.includes(t)) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
    }
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
  return out;
}
