import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXERCISES, getExercise, imageUrl } from '@/catalog';
import { DEFAULT_SETTINGS } from '@/store/migrations';

/**
 * The legal notices, checked against the app they describe.
 *
 * This exists because they drifted apart and nobody noticed for months. THIRD-PARTY-NOTICES.md
 * §2 was headed "removed, deliberately" and stated that the exercise photographs were "not
 * bundled, not linked, and not fetched at runtime", while the shipped app requested one per row
 * from raw.githubusercontent.com by default. It even listed three enforcement mechanisms, none
 * of which existed: the build script kept the field, and both tests asserted the opposite.
 *
 * A stale comment is untidy. A stale licence notice is a false statement about what the
 * software does, in the file a reuser is told to rely on, for an app that is publicly linked.
 * So the claims in that section are now assertions here, and the file cannot rot silently
 * again: change the behaviour and this fails until the notice is changed with it.
 */

const NOTICES = readFileSync(resolve(__dirname, '..', '..', 'THIRD-PARTY-NOTICES.md'), 'utf8');
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';

describe('what the notices say about the photographs', () => {
  it('does not claim they are unused, because they are used', () => {
    // The exact sentence that was wrong. Kept as a literal so the failure names the problem.
    expect(NOTICES).not.toContain('not bundled, not linked, and not fetched at runtime');
    expect(NOTICES).not.toContain('removed, deliberately');
  });

  it('describes the arrangement that actually ships: referenced, never redistributed', () => {
    expect(NOTICES).toContain('referenced, never redistributed');
  });

  it('names the host the device really contacts', () => {
    const host = 'raw.githubusercontent.com/yuhonas/free-exercise-db';
    expect(imageUrl('Barbell_Curl/0.jpg')).toContain(host);
    expect(NOTICES).toContain(host);
  });

  it('is right that the catalog holds paths rather than image files', () => {
    // The whole basis of the position. A path is a reference; a file would be redistribution.
    const photo = getExercise(BENCH)!.images[0];
    expect(photo).toBe('Barbell_Bench_Press_-_Medium_Grip/0.jpg');
    expect(photo.startsWith('http')).toBe(false);
  });

  it('is right that the switch exists and defaults to on', () => {
    // Both halves are load-bearing. The notice offers the switch as the mitigation, and admits
    // it is on by default rather than implying the photographs are opt-in.
    expect(DEFAULT_SETTINGS.showExercisePhotos).toBe(true);
    expect(NOTICES).toContain('showExercisePhotos');
    expect(NOTICES).toContain('defaults to on');
  });

  it('is right about how many exercises carry no photograph at all', () => {
    const without = EXERCISES.filter((e) => e.images.length === 0);
    // Our own additions, which have no photograph that would be ours to use.
    expect(without.every((e) => e.id.startsWith('FitRam_'))).toBe(true);
    expect(NOTICES).toContain(`${without.length} exercises`);
  });

  it('points a reuser at instructions that match the code', () => {
    // A notice telling someone to change a line that is not there is worse than no notice.
    const build = readFileSync(
      resolve(__dirname, '..', '..', 'scripts', 'build-catalog.mjs'),
      'utf8',
    );
    expect(build).toContain('images: e.images ?? []');
    expect(NOTICES).toContain('images: e.images ?? []');
  });
});
