import raw from '../../assets/data/exercises.json';
import type { Exercise } from './types';

/**
 * The bundled catalog. Lives in its own module so that `index.ts` and `search.ts` can both
 * read it without importing each other - a cycle would leave one of them holding `undefined`
 * at module-evaluation time, which is exactly when the search index is built.
 */
export const EXERCISES = raw as Exercise[];
