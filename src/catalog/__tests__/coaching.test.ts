import { getExercise } from '@/catalog';
import { APPROVED_COACHES, COACHING_VIDEOS, coachingVideos } from '@/catalog/coaching';

const rows = Object.entries(COACHING_VIDEOS).flatMap(([id, vids]) =>
  vids.map((v) => [id, v] as const),
);

describe('every linked video is accounted for', () => {
  it.each(Object.keys(COACHING_VIDEOS))('%s is an exercise in the catalog', (id) => {
    expect(getExercise(id)).toBeDefined();
  });

  it.each(rows)('%s links a coach from the shortlist', (_id, v) => {
    expect(APPROVED_COACHES.get(v.handle)).toBe(v.coach);
  });

  it.each(rows)('%s links straight to that coach on Instagram over https', (_id, v) => {
    // The handle has to be in the path. A bare /reel/<id> link cannot be tied to an account by
    // looking at it, which is the whole basis on which these are trusted.
    expect(v.url.startsWith(`https://www.instagram.com/${v.handle}/`)).toBe(true);
  });

  it.each(rows)('%s quotes the caption that proves what it covers', (_id, v) => {
    expect(v.caption.length).toBeGreaterThan(10);
  });

  it.each(rows)('%s records when it was last confirmed to load', (_id, v) => {
    expect(v.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(rows)('%s has real engagement behind it, or none recorded at all', (_id, v) => {
    // Never a small number: a link is accepted partly because a great many people saw it and
    // nobody shouted. A null means the page withheld the count, which is honest; a 12 would
    // mean the bar had been quietly lowered.
    if (v.likes !== null) expect(v.likes).toBeGreaterThan(10_000);
  });

  it('never lists the same video twice for one exercise', () => {
    for (const [, vids] of Object.entries(COACHING_VIDEOS)) {
      expect(new Set(vids.map((v) => v.url)).size).toBe(vids.length);
    }
  });

  it('never lists more than the two a description has room for', () => {
    for (const [, vids] of Object.entries(COACHING_VIDEOS)) {
      expect(vids.length).toBeGreaterThan(0);
      expect(vids.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('coachingVideos', () => {
  it('returns nothing for an exercise with no vetted link', () => {
    // The tail of the catalog has no expert coverage and is meant to show no card at all.
    expect(coachingVideos('Spell_Caster')).toEqual([]);
  });

  it('returns nothing for an id that is not an exercise', () => {
    expect(coachingVideos('not-a-real-id')).toEqual([]);
  });

  it('covers the lifts a beginner is most likely to get wrong', () => {
    for (const id of ['Barbell_Full_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Deadlift']) {
      expect(coachingVideos(id).length).toBeGreaterThan(0);
    }
  });
});
