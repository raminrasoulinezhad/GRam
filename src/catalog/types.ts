import type { Category, Equipment, Force, Level, Mechanic, Muscle } from './generated';

/**
 * Which numbers a set of a given exercise records. Chosen so that planks and sprints
 * are first-class rather than weight x reps rows with blank cells.
 */
export type SetKind = 'weight_reps' | 'reps' | 'time' | 'distance_time';

export const SET_KIND_LABEL: Record<SetKind, string> = {
  weight_reps: 'Weight x Reps',
  reps: 'Reps',
  time: 'Time',
  distance_time: 'Distance + Time',
};

/** An entry in the bundled, read-only catalog. Shape is produced by scripts/build-catalog.mjs. */
export type Exercise = {
  id: string;
  name: string;
  category: Category;
  level: Level;
  force: Force | null;
  mechanic: Mechanic | null;
  equipment: Equipment | null;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  instructions: string[];
  /** Repo-relative image paths, e.g. "Barbell_Curl/0.jpg". Resolve with imageUrl(). */
  images: string[];
  kind: SetKind;
};

export type { Category, Equipment, Force, Level, Mechanic, Muscle };
