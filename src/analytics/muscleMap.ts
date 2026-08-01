import type { Slug } from 'react-native-body-highlighter';
import { MUSCLES, type Muscle } from '@/catalog';

/**
 * The catalog's 17 muscles onto the body model's slugs.
 *
 * Two lossy cases, both unavoidable because the SVG has no distinct region for them:
 *   - lats and "middle back" both render as upper-back
 *   - abductors (glute medius/minimus, TFL) render on the gluteal region
 * The per-muscle breakdown under the figure always shows the true 17 numbers, so nothing
 * is hidden from the user - only the colouring is coarser than the data.
 */
export const MUSCLE_TO_SLUGS: Record<Muscle, Slug[]> = {
  neck: ['neck'],
  traps: ['trapezius'],
  shoulders: ['deltoids'],
  chest: ['chest'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  lats: ['upper-back'],
  'middle back': ['upper-back'],
  'lower back': ['lower-back'],
  abdominals: ['abs'],
  glutes: ['gluteal'],
  quadriceps: ['quadriceps'],
  hamstrings: ['hamstring'],
  adductors: ['adductors'],
  abductors: ['gluteal'],
  calves: ['calves'],
};

/** Display names for the breakdown list. */
export const MUSCLE_LABEL: Record<Muscle, string> = {
  neck: 'Neck',
  traps: 'Traps',
  shoulders: 'Shoulders',
  chest: 'Chest',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  'middle back': 'Mid back',
  'lower back': 'Lower back',
  abdominals: 'Abs',
  glutes: 'Glutes',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves: 'Calves',
};

/**
 * Collapses per-muscle values onto body slugs, taking the max where several muscles share a
 * slug. Max rather than sum: the colour means "how hard was this region worked", and summing
 * lats + mid back would double-count a row that trains one back.
 */
export function toSlugValues(values: Record<Muscle, number>): Map<Slug, number> {
  const out = new Map<Slug, number>();
  for (const muscle of MUSCLES) {
    const value = values[muscle];
    if (!value) continue;
    for (const slug of MUSCLE_TO_SLUGS[muscle]) {
      out.set(slug, Math.max(out.get(slug) ?? 0, value));
    }
  }
  return out;
}
