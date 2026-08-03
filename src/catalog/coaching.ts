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
 * WHY THE LIST IS SHORT, AND WHERE IT TOPS OUT
 * Coverage runs out fast, and it is worth writing down how fast so nobody spends another
 * afternoon rediscovering it.
 *
 * The head of the catalog - squat, bench, deadlift, row, pull-up - is served well. The tail is
 * not served at all: a search for "dumbbell lying pronation" returns SEO landing pages, and one
 * for "spell caster", which is a real exercise here, returns literal witchcraft.
 *
 * The middle is the surprise. **Nobody credible makes an Instagram reel about the leg press,
 * the leg extension, the seated leg curl, calf raises, the adductor machine, wrist curls or
 * neck work.** Those videos do not exist, rather than being hard to find, and widening the
 * coach shortlist does not change that - a round of searching the four approved coaches who had
 * not been tried yielded exactly one usable link. What comes back instead is small unknown
 * coaches and CrossFit affiliates, which fail the first test.
 *
 * What each coach is actually good for, measured rather than assumed:
 *   - **Jeremy Ethier** - a "the perfect X" series covering the compound lifts one at a time.
 *     By far the richest source; most of this file is his.
 *   - **Jeff Nippard** - mistake breakdowns for the big lifts, and the occasional isolation cue.
 *   - **Squat University** - rehab and fault-fixing rather than tutorials, so his posts are
 *     often about one patient and fall under the engagement bar.
 *
 * The realistic ceiling on Instagram is somewhere around fifteen to twenty exercises. Getting
 * past that means YouTube, where the same coaches post per-exercise videos and the transcripts
 * are public - which would also allow checking what the coach actually says, the one thing this
 * file cannot currently do.
 *
 * A practical note for whoever searches next: the query shape that works is the caption, not
 * the exercise. `jeremyethier instagram reel "the perfect ..."` finds posts;
 * `<coach> <exercise> form` mostly finds aggregators. And a fetch that returns a login wall is
 * worth retrying later - roughly one in five fail, and the same URL usually works on a second
 * attempt once the fifteen-minute cache has expired.
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
  /**
   * Comments at the time it was checked, or null when the page would not show them.
   *
   * Recorded because a comment thread is the closest thing to a review this has. A coach
   * demonstrating something badly in front of a hundred thousand people gets told so, and a
   * post with hundreds of comments and a good reputation has survived that.
   */
  comments: number | null;
  /** ISO date the link and its caption were last confirmed to load. */
  checkedOn: string;
};

/*
 * A few posts cover a movement the catalog splits into several ids - one squat video serves
 * both squat entries, one pulldown video serves the close and wide grips. Declared once and
 * shared, so a dead link is fixed in one place rather than found in two.
 */
const SQUAT_ETHIER: CoachingVideo = {
  coach: 'Jeremy Ethier',
  handle: 'jeremyethier',
  url: 'https://www.instagram.com/jeremyethier/reel/CxdXhspLeAl/',
  caption: "Here's 5 of the most common squat mistakes and how to fix them",
  likes: 199_500,
  comments: 421,
  checkedOn: '2026-08-02',
};

const PULLDOWN_ETHIER: CoachingVideo = {
  coach: 'Jeremy Ethier',
  handle: 'jeremyethier',
  url: 'https://www.instagram.com/jeremyethier/reel/C-QVWiVPsus/',
  caption: 'These are the 3 most common mistakes I see with the lat pulldown',
  likes: 44_400,
  comments: 149,
  checkedOn: '2026-08-02',
};

/**
 * Keyed by exercise id. Two per exercise is the target; one is shipped rather than padding it
 * with a link nobody has opened.
 */
export const COACHING_VIDEOS: Record<string, readonly CoachingVideo[]> = {
  // -------------------------------------------------------------- the barbell lifts
  Barbell_Full_Squat: [SQUAT_ETHIER],
  Barbell_Squat: [SQUAT_ETHIER],

  'Barbell_Bench_Press_-_Medium_Grip': [
    {
      coach: 'Jeff Nippard',
      handle: 'jeffnippard',
      url: 'https://www.instagram.com/jeffnippard/reel/C-sdW8EP7hv/',
      caption: '3 most common bench press mistakes',
      likes: 89_900,
      comments: 389,
      checkedOn: '2026-08-02',
    },
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/CxYlXsDvJBn/',
      caption:
        "If you feel more of your shoulders working rather than your chest during the bench press, then you're probably making this mistake",
      likes: 45_500,
      comments: 133,
      checkedOn: '2026-08-02',
    },
  ],

  Dumbbell_Bench_Press: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/Chm5l_JJkK6/',
      caption:
        'The dumbbell bench press is arguably the best exercise for building your chest! But to better target the chest and avoid shoulder injury, you want to avoid making this mistake',
      likes: 45_000,
      comments: 216,
      checkedOn: '2026-08-02',
    },
  ],

  Barbell_Deadlift: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/DBeWH-FvYtD/',
      caption: 'How to do the perfect deadlift, in 5 easy steps',
      likes: 199_700,
      comments: 426,
      checkedOn: '2026-08-02',
    },
    {
      coach: 'Jeff Nippard',
      handle: 'jeffnippard',
      url: 'https://www.instagram.com/jeffnippard/reel/C5Bu0Sjp0Mi/',
      caption: 'Deadlift checklist! If you tick all 5, you have a perfect deadlift',
      // The page served the verified handle and the caption but withheld both counts.
      likes: null,
      comments: null,
      checkedOn: '2026-08-02',
    },
  ],

  Barbell_Hip_Thrust: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/C4MBXjRyl8K/',
      caption:
        "Here's how to do the perfect hip thrust, and how to fix some of the most common mistakes people make",
      likes: 27_800,
      comments: 117,
      checkedOn: '2026-08-02',
    },
  ],

  // ------------------------------------------------------------------- pulling
  Pullups: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/CvNWZ77ONml/',
      caption: "Here's how to do the perfect pull-up",
      likes: 54_600,
      comments: 191,
      checkedOn: '2026-08-02',
    },
  ],
  'Close-Grip_Front_Lat_Pulldown': [PULLDOWN_ETHIER],
  'Wide-Grip_Lat_Pulldown': [PULLDOWN_ETHIER],

  Bent_Over_Barbell_Row: [
    {
      coach: 'Jeremy Ethier',
      handle: 'jeremyethier',
      url: 'https://www.instagram.com/jeremyethier/reel/CuhgOK3sQCV/',
      caption: "Here's how to do barbell rows in 5 simple steps",
      likes: 84_800,
      comments: 188,
      checkedOn: '2026-08-02',
    },
    {
      coach: 'Squat University',
      handle: 'squat_university',
      url: 'https://www.instagram.com/squat_university/reel/C6r83eiA-38/',
      caption:
        'Master the RDL first - then do the bent over row. Reason: the bent over row STARTS from the static or held position of the bottom RDL',
      likes: 76_500,
      comments: 374,
      checkedOn: '2026-08-02',
    },
  ],

  // ----------------------------------------------------------------- shoulders
  Side_Lateral_Raise: [
    {
      coach: 'Jeff Nippard',
      handle: 'jeffnippard',
      url: 'https://www.instagram.com/jeffnippard/reel/C61SfWrungF/',
      caption: 'A better way to do lateral raises',
      likes: 157_800,
      comments: 587,
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
  // Alan Thrall posts as untamedstrength, not under his own name. Worth writing down: the
  // obvious guess, alan_thrall, is somebody else.
  ['untamedstrength', 'Alan Thrall'],
  ['barbell_medicine', 'Barbell Medicine'],
]);

/** Demonstrations for an exercise, or an empty list when none has been vetted. */
export function coachingVideos(exerciseId: string): readonly CoachingVideo[] {
  return COACHING_VIDEOS[exerciseId] ?? [];
}
