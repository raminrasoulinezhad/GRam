/**
 * Demonstration videos from named coaches, for exercises where a still photograph is not enough.
 *
 * WHY EVERY ENTRY CARRIES ITS EVIDENCE
 * Nobody here can watch a video. A link cannot be vouched for by looking at it, so each one is
 * accepted on three things that *can* be checked, and all three are recorded below so the next
 * person can re-check them rather than trust this file:
 *
 *   1. **A named coach with a verified account.** Not an aggregator, not a reposter. The
 *      shortlist is at the bottom of this comment and nothing outside it goes in.
 *   2. **A caption that names the movement.** "3 most common bench press mistakes" is evidence
 *      about content; a link found by searching "bench press" is not. A caption about the
 *      barbell bench does not qualify a link filed under the dumbbell bench - the searches
 *      return the wrong variation constantly, and that is the mistake this rule exists to stop.
 *   3. **Engagement in the tens of thousands.** A weak video from a good coach exists; one that
 *      six figures of people liked and four hundred commented on is unlikely to be teaching the
 *      movement wrongly without someone saying so.
 *
 * WHY THE LIST IS SHORT
 * Coverage runs out fast. The head of the catalog - squat, bench, deadlift, pull-up - is served
 * well by several coaches. The tail is not served at all: a search for "dumbbell lying
 * pronation" returns SEO landing pages, and one for "spell caster", which is a real exercise
 * here, returns literal witchcraft. Those exercises get nothing, which is correct. An exercise
 * with no link shows no card.
 *
 * ADDING TO IT
 * Find the post, open it, and record what you actually saw in `caption`, `likes` and
 * `checkedOn`. If the page will not load its metadata - roughly half the time it will not -
 * the entry does not go in. A link nobody has confirmed is exactly what this file exists to
 * avoid, because a bad demonstration recommended by the app is worse than no demonstration.
 *
 * THE SHORTLIST
 * Jeff Nippard, Jeremy Ethier, Squat University (Aaron Horschig), Renaissance Periodization
 * (Mike Israetel), Athlean-X (Jeff Cavaliere), Alan Thrall, Barbell Medicine.
 */

export type CoachingVideo = {
  /** The coach, as they are known. */
  coach: string;
  /** Instagram handle, without the @. */
  handle: string;
  url: string;
  /** The post's own caption, quoted, as the evidence that it covers this movement. */
  caption: string;
  /** Likes at the time it was checked, or null when the page would not show them. */
  likes: number | null;
  /** ISO date the link and its caption were last confirmed to load. */
  checkedOn: string;
};

/**
 * Keyed by exercise id. Two per exercise is the target; one is shipped rather than padding it
 * with a link nobody has opened.
 */
export const COACHING_VIDEOS: Record<string, readonly CoachingVideo[]> = {
  Barbell_Full_Squat: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/CxdXhspLeAl/',
      caption: "Here's 5 of the most common squat mistakes and how to fix them",
      likes: 199_500,
      checkedOn: '2026-08-02',
    },
  ],
  Barbell_Squat: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/CxdXhspLeAl/',
      caption: "Here's 5 of the most common squat mistakes and how to fix them",
      likes: 199_500,
      checkedOn: '2026-08-02',
    },
  ],
  'Barbell_Bench_Press_-_Medium_Grip': [
    {
      coach: 'Jeff Nippard',
      handle: 'jeffnippard',
      url: 'https://www.instagram.com/jeffnippard/reel/C-sdW8EP7hv/',
      caption: '3 most common bench press mistakes',
      likes: 89_900,
      checkedOn: '2026-08-02',
    },
  ],
  Barbell_Deadlift: [
    {
      coach: 'Jeff Nippard',
      handle: 'jeffnippard',
      url: 'https://www.instagram.com/jeffnippard/reel/C5Bu0Sjp0Mi/',
      caption: 'Deadlift checklist! If you tick all 5, you have a perfect deadlift',
      // The page served the caption and the verified handle but withheld the like count.
      likes: null,
      checkedOn: '2026-08-02',
    },
  ],
};

/** Every coach whose work may be linked. Anything outside this list is rejected by a test. */
export const APPROVED_COACHES: ReadonlyMap<string, string> = new Map([
  ['jeffnippard', 'Jeff Nippard'],
  ['jeremyethier', 'Jeremy Ethier'],
  ['squat_university', 'Squat University'],
  ['rpstrength', 'Renaissance Periodization'],
  ['athleanx', 'Athlean-X'],
  ['alan_thrall', 'Alan Thrall'],
  ['barbell_medicine', 'Barbell Medicine'],
]);

/** Demonstrations for an exercise, or an empty list when none has been vetted. */
export function coachingVideos(exerciseId: string): readonly CoachingVideo[] {
  return COACHING_VIDEOS[exerciseId] ?? [];
}
