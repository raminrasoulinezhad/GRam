# Changelog

All notable changes to GRam. Format follows [Keep a Changelog](https://keepachangelog.com);
versions follow [Semantic Versioning](https://semver.org).

Each entry notes its **storage schema version**. Upgrading between any two releases preserves
all plans and logged workouts — see [docs/RELEASING.md](docs/RELEASING.md).

## [1.4.2] — 2026-08-08

Storage schema **v7** — unchanged.

### Fixed

- **The "last 7 days" figures counted one weekday twice.** The window was 168 rolling hours, so
  asked on a Friday evening it still reached back past *last* Friday morning — and anyone who
  trains on a fixed weekly schedule saw that day counted twice and a week that looked heavier
  than it was. It is now seven calendar days ending today: on Friday, Saturday through Friday,
  each weekday exactly once. Built from calendar components rather than by subtracting hours, so
  it lands on real midnight through daylight saving. Affects the Body page and History.

### Changed

- **Backups are about 57% smaller** — 7.4 MB down to 3.2 MB for a decade of training at three
  workouts a week — with byte-identical data. The files were pretty-printed on the reasoning
  that a person might open and read one; at seven megabytes that stopped being true, and any
  editor or `jq .` formats it on demand. The folder archive's yearly shards are compact too; its
  manifest stays indented, being small and the one file anyone actually opens.

## [1.4.1] — 2026-08-08

Storage schema **v7** — unchanged.

### Removed

- **The paragraph under the unit buttons on Profile.** It explained that weights are stored in
  kilograms and that switching never rewrites your history — true, and worth knowing once, after
  which it was a paragraph living under two buttons forever. The behaviour is pinned by a test
  instead of described in the UI.

## [1.4.0] — 2026-08-08

Storage schema **v7** — unchanged. First release reviewed end to end for public use.

### Changed

- **Recommended picks re-reviewed for the 1.4 series.** Two changed, both because the catalog
  gained the better movement this release:
  - **Abdominals** — the ab wheel rollout replaces the bicycle crunch as the second pick. It
    loads the abs in the lengthened, overhead position and scales by how far you roll, which is
    the pair of criteria this list weights above activation. The bicycle topped the ACE study,
    but that measures one set rather than months, and it has nowhere to go once you can do it.
  - **Adductors** — the Copenhagen plank replaces band hip adductions. The band version is a
    warm-up with no way to progress; the Copenhagen has actual trial evidence behind it
    (Harøy 2019, Ishøi 2016) and scales from bent knee to straight leg to added weight.
  - **Quadriceps** was reviewed and left alone, but its reasoning is now written down, including
    why the new Bulgarian split squat was considered and not taken.

### Added

- **Tests for everything shipped in the 1.3 series that had none**: the backup warning, the
  birthday greeting, the plan review page, deleting a plan, the plan-card buttons, and the whole
  Profile screen — including "Erase all data", which had no coverage at all despite being the
  one irreversible action in the app. 74 new tests; 1,263 in total.

- **A plan untouched for four weeks gets a mark, and the mark opens a page about that plan.**

  The calendar is only what makes the app look. "You have not changed this in two months" is true
  of plenty of good programmes, and telling someone to change something that is working is bad
  advice with a timer attached. So the page does not argue from the date — it reads the sets
  logged **since the plan was last edited** and reports, per exercise, whether the weight has
  actually moved:

  - **Still working** — the lift is climbing. Said out loud, first, because on some visits the
    most useful thing this page can do is tell you to change nothing.
  - **Not moving** — same weight across every session. This is the one worth acting on, and it
    is where other exercises for the same muscle are offered. They open the how-to rather than
    editing your plan; swapping in a movement sight unseen is how people end up doing an
    exercise they cannot do.
  - **Going backwards** — deliberately *not* offered alternatives. A falling lift is usually a
    recovery problem, and a new movement would hide the signal rather than answer it.
  - **Not enough recorded** — fewer than three sessions. Too little to draw a line through,
    which is not the same as no progress and is never reported as such.

  A kilo of slack either way keeps plate noise from being read as a trend, and the mark uses the
  amber "worth a look" colour rather than the red used for the backup warning — nothing is at
  risk here, and spending the same alarm on both teaches people to ignore the serious one.

## [1.3.17] — 2026-08-08

Storage schema **v7** — unchanged.

### Changed

- **A plan card on My week has one button now: Start.** Tapping the card itself opens the
  editor, as it always did, so a card that is already a link did not need a button saying so.
- **Deleting a plan moved to the bottom of the plan's own page**, below "+ Add exercise", behind
  a confirmation that names the day and counts what goes with it. You make that decision having
  scrolled past everything in the plan, rather than from a red button on a list.
- **The rest-timer card is one row** — the three presets and the stepper together, with a single
  short line under them. It was the tallest card on Profile for a setting most people set once.

### Removed

- **Copy, from the plan cards.** It made an unnamed duplicate on a day that already had a plan,
  which is awkward to undo and was almost never what anyone meant.

## [1.3.16] — 2026-08-08

Storage schema **v7** — unchanged.

### Added

- **A greeting on your birthday, by name.** Appears only if you have filled in a date of birth,
  which the app already asks for to work out your age; nothing new is collected and nothing
  leaves the device. A leap-day birthday is greeted on 1 March in common years — once every four
  years is the literal reading and the unkind one.

### Removed

- **The per-muscle chips on History's "Last 7 days" card**, matching the workout rows below it.
  The three counts above them — workouts, effective sets, muscles hit — say the useful part.

## [1.3.15] — 2026-08-08

Storage schema **v7** — unchanged.

### Removed

- **The list of every version this device has run, and the system line, from Profile › About.**
  Both were written during the app-icon problem, when nobody could establish which build anyone
  was on. The single Version line answers that; the log was a growing list nobody read after the
  week that prompted it, and the OS string told you something about your own phone you knew.
- With them goes `readDeviceProfile`, which read the phone's model, OS, locale, region and time
  zone. Nothing acted on any of it any more, and reading a device's identity for no reason is
  not a thing to leave lying around in an app whose whole pitch is that your data stays put.

## [1.3.14] — 2026-08-03

Storage schema **v7** — unchanged.

### Added

- **A warning across the top of the app when a backup is overdue.** Backups are manual, there is
  no server and no account, so everything since the last export lives in one browser's storage —
  clear the site data or lose the phone and it is gone with no copy anywhere. Nothing said so
  before it happened.

  Not a real push notification, deliberately: nothing can wake a closed offline web app, and
  asking for notification permission to say "back up your data" would spend the one prompt most
  people refuse on the dullest thing the app could say. It interrupts where interrupting is
  free — at the top of the app, whenever it is open. Dismissing hides it until the next launch,
  not for good.

### Changed

- **A backup is now overdue after a week, not forty-five days.** Six weeks of unsaved training is
  most of a training block, which was never a sensible amount to risk. The Profile card and the
  new banner read the same threshold, so there is one definition rather than two that drift.

## [1.3.13] — 2026-08-03

Storage schema **v7** — unchanged.

### Changed

- **The rest-timer setting is three presets instead of five** — 45s, 1:00 and 1:30 — with the
  stepper beside them for anything else. Five buttons was a menu to read rather than a shortcut
  to tap, and the two long ones were rarely the answer.

## [1.3.12] — 2026-08-03

Storage schema **v7** — unchanged.

### Added

- **Swipe the full-screen photo.** Sideways moves between the start and finish frames, up or
  down closes it — no aiming at a button with one hand mid-set. Only while the photo is fitted
  to the screen: once it is zoomed, dragging still pans, because stealing that would make a
  zoomed photo impossible to read. Both directions close, since a viewer that only dismissed one
  way feels broken the half of the time you flick the other. A diagonal drag does nothing rather
  than guessing between paging and closing.

## [1.3.11] — 2026-08-03

Storage schema **v7** — unchanged.

### Fixed

- **Search now finds movements the dataset files under a different name.** "side plank" returned
  everything except the side plank, which is in there as *Side Bridge*; "pec deck" returned
  *Neck Press*; "bicycle crunch" and "inner thigh" returned nothing at all. Fourteen exercises
  carry an alias now.

  These are attached per exercise rather than added to the word-level synonym table, and the
  reason is in [search.ts](src/catalog/search.ts): mapping *plank* to *bridge* globally would
  make a search for planks return glute bridges. A test pins that it does not.

## [1.3.10] — 2026-08-03

Storage schema **v7** — unchanged.

### Changed

- **Milestones moved from Profile to the top of the History page**, where the rest of the
  looking-back lives, and shrank to about two-thirds of its old height — smaller badges, tighter
  rows, and no explanatory line, since it said the same thing every time you read it.
- **History rows are shorter.** The per-muscle chips are gone from each workout card: they were
  the tallest thing in a card whose job is to be scanned, and the same breakdown is one tap away
  on the workout's own page. The exercise list under each card is one line instead of two, and
  the numbers are set smaller. A workout card is **124px** where it used to run past 200.

## [1.3.9] — 2026-08-03

Storage schema **v7** — unchanged.

### Added

- **Seventeen movements the upstream dataset never had**, bringing the catalog to **896**. The
  gap was a consistent one: free-exercise-db is a bodybuilding-era catalogue, exhaustive on
  barbell and machine variations — five sumo deadlifts, eight kinds of dip — and missing almost
  everything bodyweight, isometric or unilateral that is programmed today.
  - Hangs and pulling progressions: **Dead Hang**, **Negative Pull-Up**
  - Unilateral legs: **Bulgarian Split Squat**, **Reverse Lunge**, **Single-Leg Romanian
    Deadlift**, **Nordic Hamstring Curl**
  - Isometrics and core: **Hollow Body Hold**, **L-Sit**, **Wall Sit**, **Bird Dog**,
    **Copenhagen Plank**, **Ab Wheel Rollout**
  - Everything else: **Pike Push-Up**, **Pendlay Row**, **Tibialis Raise**, **Burpee**,
    **Rowing Machine (Erg)**

  Each carries written instructions and a deliberately conservative muscle attribution, since
  those feed the heatmap and the fatigue model. Two judgment calls are recorded in
  [scripts/build-catalog.mjs](scripts/build-catalog.mjs): the dead hang is filed under forearms
  rather than lats, because what ends the set is the grip; and the tibialis raise is filed under
  calves, which is anatomically backwards but lights the right part of the body map, the dataset
  having no shin muscle.

### Fixed

- The exercise-list test counted the catalog instead of hard-coding its size, so growing the
  catalog no longer fails a test that has nothing to do with the change.

## [1.3.8] — 2026-08-03

Storage schema **v7** — unchanged. Documentation only.

### Changed

- **The GitHub repository is now `raminrasoulinezhad/GRam`.** The remote and the link in
  [DEVELOPER_README.md](DEVELOPER_README.md) follow it.

> GitHub keeps a permanent redirect from the old `raminrasoulinezhad/fitram` path, so old clones
> and links keep working — **until something is created at the old name**, which drops the
> redirect for good. Nothing about the rename touches the four identifiers that still say
> `fitram` on purpose; see
> [docs/RELEASING.md](docs/RELEASING.md#names-that-kept-fitram-through-the-rebrand).

## [1.3.7] — 2026-08-03

Storage schema **v7** — unchanged.

### Changed

- **A live workout now orders each group by when it got there.** Finishing an exercise moves it
  to the *bottom* of the finished ones rather than back to its place in the plan, and recording
  a first set moves that exercise to the bottom of the ones under way. The list reads as a
  history: the further up something is, the longer ago you were doing it, and whatever you just
  touched sits directly above the work still to come. Exercises nobody has touched keep the
  plan's order, which is the only meaningful one they have. The three bands — finished, under
  way, untouched — are unchanged.
- An exercise you are part way through is placed by its **first** recorded set, not its latest,
  so working through it does not make the card slide down the screen under your thumb.

### Added

- **Tapping the name of a suggested easier exercise opens its how-to page.** The suggestion is
  only useful if you know what it is, and "Band Assisted Pull-Up" means nothing to most people
  until they have seen it. Reading about it does not swap anything — the Swap button still does
  that.

### Removed

- **The per-muscle `2/6` chips at the top of a live workout.** They were not earning the space.
  `sessionPlannedVolume`, which existed only to compute their denominator, goes with them.

## [1.3.6] — 2026-08-02

Storage schema **v7** — unchanged. Documentation only.

### Changed

- **The app now lives at `https://grambygram.netlify.app`.** The install links in
  [README.md](README.md) pointed at the old auto-generated Netlify subdomain, which stopped
  resolving the moment the site was renamed — all three served a 404.
- Recorded in [docs/QUICKSTART.md](docs/QUICKSTART.md) that renaming the site is what produced
  the current address, since the old auto-generated name is still the worked example there.

> ⚠️ **The rename is a fresh install for anyone already using the app.** Browser storage is
> scoped per origin, so workouts logged against the old address do not follow to the new one,
> and the old home-screen icon now opens a 404. See
> [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md#hosting-it).

## [1.3.5] — 2026-08-02

Storage schema **v7** — unchanged. Documentation only.

### Changed

- **Wrote down where the coach-video list tops out**, in
  [`src/catalog/coaching.ts`](src/catalog/coaching.ts), so the next person does not spend an
  afternoon rediscovering it. The finding: nobody credible makes an Instagram reel about the leg
  press, the leg extension, the seated leg curl, calf raises, the adductor machine, wrist curls
  or neck work — those videos do not exist rather than being hard to find, and widening the coach
  shortlist yielded exactly one extra link. The realistic ceiling is fifteen to twenty exercises;
  getting past it means YouTube, where the same coaches post per-exercise videos and the
  transcripts are public. Also recorded: what each coach is actually good for, and the search and
  retry patterns that work.

## [1.3.4] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **The dumbbell bench press gets a video, and the barbell bench press a second one**, both from
  Jeremy Ethier. Eleven exercises now carry a link, twelve videos in all, and three of them —
  bench press, deadlift and barbell row — have the pair originally asked for.

### Fixed

- The approved-coach list had **Alan Thrall under the wrong handle**. He posts as
  `untamedstrength`; `alan_thrall` is somebody else. Nothing linked to it yet, so this was caught
  before it became a wrong link rather than after.

## [1.3.3] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **The barbell row gets two coach videos** — Jeremy Ethier on the five steps, and Squat
  University on why the row starts from the bottom of an RDL. Ten exercises now carry a link.

### Notes

- A Squat University reverse-lunge video was **rejected by the file's own bar**: 7.8K likes and
  49 comments, under the ten-thousand and fifty-comment thresholds. Working as intended — the
  point of the thresholds is that they exclude things.

## [1.3.2] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **Six more exercises have a coach demonstrating them**: pull-ups, the hip thrust, lateral
  raises and the lat pulldown (both grips), plus a second deadlift video. Nine exercises now
  carry a link, from Jeremy Ethier and Jeff Nippard.
- **Comment counts are recorded alongside likes.** A comment thread is the closest thing to a
  review these links have — a coach demonstrating something badly in front of a hundred thousand
  people gets told so — so it is now part of the evidence stored with every link, and a test
  requires likes and comments to be present or absent together, since both come off the same
  page load.

## [1.3.1] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **"Watch it done" — a coach demonstrating the movement**, on the exercise description, opening
  in Instagram. **Four exercises so far**: the barbell squat, the bench press and the deadlift,
  from Jeremy Ethier and Jeff Nippard.
  - **Every link is accepted on evidence that is written into the file**: a named coach from a
    fixed shortlist with a verified account, the post's own caption naming the movement, and
    engagement in the tens of thousands. All three are recorded next to the link, so the next
    person re-checks rather than trusts.
  - **An exercise with no vetted link shows no card.** Coverage runs out fast — the head of the
    catalog is well served, the tail is not served at all — and saying nothing is the right
    answer there.

The reason it is four and not eight hundred is in
[`src/catalog/coaching.ts`](src/catalog/coaching.ts): nobody here can watch a video, so a link
cannot be vouched for by looking at it. It is accepted on the three checkable things above, and
Instagram serves a post's caption and like count only about half the time, so each entry costs
several attempts. This is a start, not a finished list.

## [1.3.0] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **"Not there yet?" — an easier way into a movement you cannot do today.** Start a workout with
  pull-ups in it and, before you have recorded anything, the card offers a band-assisted pull-up
  with a line saying what it gives you, and a **Swap** button that puts it in the slot keeping
  the sets the plan asked for. The exercise description carries the whole ladder, each rung
  linking to the published progression it came from.
  - **The suggestion disappears the moment you record a set.** You are doing it; the question has
    been answered.
  - **A swap is refused once anything is recorded.** Those sets say you did *that* exercise, and
    relabelling them would put work in your history you never did.
  - The ladder walks all the way down. A barbell bench press goes to dumbbells, then the floor
    press, then push-ups, then incline push-ups; a clean and jerk comes apart into a power clean,
    a hang clean, a clean pull and a clean deadlift.
  - Swapping to something you have done before opens on **your own last weights**, not the stock
    twenty kilos.

**Why the list is written by hand.** The obvious version — same muscle, same direction, one step
down the catalog's difficulty label — was built and measured first, and it fails on the data. It
produced 291 pairs, every chain one step long, landing on just 60 distinct exercises with
*Bodyweight Squat* offered as the answer for 35 unrelated movements. Worse, the dataset labels
**pull-ups, chin-ups, dips and the barbell bench press "beginner"**, so it said nothing at all
about the four movements people most need a way into. And it produced confident nonsense:
*"instead of a deadlift, try back extensions"*. The numbers are in
[docs/STUDY.md §7](docs/STUDY.md). Every edge in the hand-written list cites a published
progression — Reddit r/bodyweightfitness, NSCA, Catalyst Athletics and others — and an exercise
with nothing listed shows nothing, because saying nothing costs less than saying something wrong.

### Changed

- **Exercise recommendations re-reviewed for 1.3**, as a minor release requires. One pick moved:
  **middle back is now the lying T-bar row**, ahead of the seated cable row. Nippard's back
  ranking crowns the chest-supported row as the best all-around back exercise and puts a
  chest-supported T-bar row in his top five movements overall. The bent-over barbell row drops —
  it tops the EMG comparisons, but the torso is held up by the lower back, and not having to hold
  yourself there is the entire reason the braced version wins. Everything else was corroborated
  and stands.

## [1.2.17] — 2026-08-02

Storage schema **v7** — unchanged. Nothing a user can see changes; this is dead weight going out.

### Removed

- **`src/lib/autoExport.ts`** — 167 lines of File System Access machinery for writing backups to
  a single user-picked file, with the handle kept in IndexedDB. It was superseded by the folder
  archive in `directory.ts` and had sat unused for several releases. The one live function,
  `requestPersistentStorage`, moves to **`src/lib/persistence.ts`**.
- `H1`, `ChipRow` and `Divider` from the UI kit, and `involvementColor` from the body map — all
  four had no callers anywhere, tests included, along with the styles behind them.
- The `export` keyword from six symbols only ever used inside their own module (`bandFor`,
  `LEVELS_PER_BAND`, `sessionYear`, `ARCHIVE_FORMAT`, `canShareFile`, `lastPerformance`), so
  each module's surface is what it actually offers.

### Fixed

- DEVELOPER_README claimed **224 tests**. There are 646.

## [1.2.16] — 2026-08-02

Storage schema **v7** — unchanged. Nothing stored changes; the figure is recomputed from the
sets you already have, so **Total lifted** goes up the moment you open this build.

### Fixed

- **Dumbbell work counts both dumbbells in your total lifted.** A press with two 30s is 60kg
  moved, but 30 is the number anyone writes down — so every dumbbell session was being counted
  at half, and the more dumbbell work you did the further out the figure drifted.
- **The record page now says when a weight is per hand**, so there is no question which number
  to type. The exercise description carries a matching **Weight per hand** tag.

The rule, in full, is in [`src/catalog/perSide.ts`](src/catalog/perSide.ts):

- **Dumbbells count double by default** — a dumbbell exercise means one in each hand unless the
  name says otherwise. **Kettlebells only when the name says two of them** (Double, Two-Arm,
  Alternating), because one bell is the norm.
- **One-arm work counts once.** Only one side is loaded at a time, so the weight written down
  *is* the whole load. Train both arms and log it as a single set and you are undercounted by
  half — log it as two sets, one per side, which is what the set list is for.
- **Anything held in both hands counts once**: goblet squats, pullovers, two-handed swings. A
  hand-checked list of eleven exercises the naming would otherwise get wrong is in that file
  with a reason against each.
- **Two-stack cable machines are not covered.** On a crossover each side really does carry the
  selected weight, but the dataset has no field that marks them and the naming gives no reliable
  signal, so guessing would be worse than the known gap.

## [1.2.15] — 2026-08-02

Storage schema **v7** — unchanged.

### Fixed

- **The box you are typing into stays on screen when the keyboard opens.** Tapping a weight or
  reps field in a live workout used to push the row you were editing under the keyboard, or off
  the screen entirely — the editing worked, you just could not see it.
  - The field is now **scrolled to the middle of what is still visible**, both when it is
    tapped and again once the keyboard has finished opening, which is the first moment the
    room left is actually known. This applies to every field in the app, not only the set rows.
  - **A live workout gives up its furniture while you type**: the Finish and Discard buttons
    and the muscle chips step aside, and come straight back when the keyboard closes. With a
    keyboard covering two thirds of a phone, a pinned footer was taking a share of the rest
    that the row being edited needed more.

## [1.2.14] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **Tap an exercise photo to open it full screen.** Pinch to zoom, drag to move around, double
  tap to jump in and back out, and a close button top right. Where the elbow is, or how far the
  bar travels, is not legible in a thumbnail.
  - **Zoom buttons as well as the pinch.** Pinching needs two free hands, and this gets read
    mid-set with one — and it is the only way in at all with a mouse.
  - **Step between the start and finish frames without closing**, since the pair only means
    something read together. Moving to the other frame returns it to fitted.
  - A fitted photo cannot be dragged off the screen, and zooming out always pulls the image back
    inside the frame rather than leaving it stranded against one edge.

## [1.2.13] — 2026-08-02

Storage schema **v7** — unchanged.

### Changed

- **The muscle chips in a live workout read `2/6` instead of `2`** — sets recorded out of what
  the whole session holds for that muscle, so you can see how much of today's shoulders is left
  without counting rows.
  - The chips appear **from the moment the workout starts**, saying what it is going to be
    (`Chest 0/9`) rather than staying blank until something is recorded.
  - Ranked by the planned total, so the row does not reshuffle as the numbers fill in.
  - A chip lights up once that muscle has had everything the workout holds for it.
  - Halves are shown, not rounded away: a muscle assisting a movement earns half a set, and
    `Triceps 0.5/1.5` is the honest reading.

## [1.2.12] — 2026-08-02

Storage schema **v7** — unchanged.

### Changed

- **A live workout sorts itself as you go**: exercises you have finished collect at the top,
  the one under way sits below them, and everything still to do stays together at the bottom
  instead of being broken up by the ones already ticked off.
  - Within each of the three groups the plan's own order survives, so nothing shuffles for no
    reason.
  - Un-record every set of an exercise and it goes back where the plan had it.
  - This is display order only. Nothing about the workout is rewritten, and History still shows
    a finished workout in the order it was done.

## [1.2.11] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **A workout opens on the numbers you lifted last time.** Start a plan and every exercise you
  have trained before is pre-filled with that session's weights and reps, set by set, so last
  time is in front of you while you decide today's. Exercises you have never done fall back to
  the plan's own template.
  - **Set by set, in the order you did them** — a back-off set stays a back-off set. Plan a
    fourth set where you did three and it repeats the last one.
  - **Nothing is recorded by this.** They are targets, editable as always, and a set only counts
    once you tick it.
  - Only sets you actually recorded count as "last time"; numbers typed into a workout you never
    ticked off are ignored.
  - "Last time" follows the day you trained, not the order workouts were created — so moving a
    workout to its real date in History changes what the next one opens on.
  - Adding an exercise mid-workout does the same. Adding one while correcting a past workout
    looks at what came before *that* day, not at this week.

## [1.2.10] — 2026-08-02

Storage schema **v7** — unchanged.

### Changed

- **Correcting a set now corrects the ones after it.** Find the bar loaded at 60 instead of the
  50 you planned, fix the first set, and the remaining sets follow. It used to take one edit per
  set.
  - **Recorded sets are never rewritten.** A recorded set is what you actually lifted; an
    unrecorded one is only a target, and targets are what this updates.
  - Only the field you changed travels. Fixing a weight leaves a rep target alone.
  - Sets *above* the one you edited are left alone — they have already happened.
  - Correcting a past workout in History is unaffected: every set in a finished workout is
    recorded, so the edit changes exactly the set you are looking at.

## [1.2.9] — 2026-08-02

Storage schema **v7** — unchanged.

### Added

- **The rest timer length is yours to set**, in **Profile → Rest timer**. One tap for 45s, 1:00,
  1:30, 2:00 or 3:00, or type any value up to ten minutes. Zero turns the timer off.
  - **Plans you have already built are retimed to match.** Rest is stored per exercise, but
    nothing has ever been able to set it per exercise — every stored value is a copy of whatever
    the default was when that exercise was added. Leaving them behind would have made the new
    setting look like a switch that does nothing.
  - A workout already in progress is retimed too, since that is usually where you notice you
    want longer. A **finished** workout is a record of what happened and is never touched.

## [1.2.8] — 2026-08-02

Storage schema **v7** — unchanged.

### Changed

- **A fresh install starts in pounds.** The unit used to be kilograms, overwritten once on first
  launch by whatever the phone's region reported — so it depended on a setting most people have
  never opened, and a phone reporting metric handed a pounds lifter kilograms. Now it is simply
  pounds, changed in two taps in **Profile → Units** if you want kilograms.
  - **An update never touches a unit you have already got.** The default only ever decides a
    first launch; stored settings are laid over it. There is a migration test for exactly this:
    an install on kilograms upgrades still on kilograms.
  - Weights are still stored in kilograms underneath, so switching the display never rewrites
    a single logged set.

### Removed

- The device-region unit seeding, along with `preferredUnit()` and the `unitSeededFromDevice`
  flag it needed. A fixed default needs neither.

## [1.2.7] — 2026-08-02

Storage schema **v7** — unchanged. Documentation only; the app itself is identical to 1.2.6.

### Changed

- **Committing and pushing are now separate decisions.** Each finished feature gets its own
  commit and patch tag right away, but a push — which triggers a metered Netlify build — waits
  for a minor or major bump and carries the accumulated patch commits out with it. Written up in
  [AGENTS.md](AGENTS.md) and
  [docs/RELEASING.md](docs/RELEASING.md#committing-is-local-pushing-is-a-release).

## [1.2.6] — 2026-08-02

Storage schema **v7** — unchanged, so this is an ordinary upgrade.

### Added

- **Any past workout can be corrected.** Open it from History and tap **Edit**. Weights, reps,
  times and distances become editable; sets can be added or deleted; exercises can be added or
  removed; and the workout itself can be renamed, moved to another date and time, and given the
  length it actually took.
  - **Moving a workout moves everything in it.** The end time and every set's timestamp shift by
    the same amount, so the workout keeps its length and the order its sets were recorded in.
    This is not cosmetic: the body map, the weekly volume and each exercise's history all read
    the set timestamps, so a workout moved without them would go on counting on the old day.
  - **A set added to a finished workout is recorded straight away**, stamped with the time of the
    set it was copied from rather than today's — there is no workout left to record it during,
    and an unrecorded set inside history would show on screen while counting for nothing.
  - **An exercise added to a finished workout arrives with one set**, not the usual three. A
    finished workout is a record of what happened, so inventing sets is the wrong default.
  - History stays **read-only until you ask to edit it**, and the delete buttons only exist in
    edit mode. A mistap while browsing should not be able to rewrite a record.
  - Finishing an edit drops any exercise left with no sets, and offers to delete a workout
    emptied of everything.
  - The correction reaches your backup with no extra step: the folder already holds the sessions,
    and auto-export watches them. A workout retimed across New Year moves between year shards
    cleanly — the new year is rewritten and the old file removed, never left holding a duplicate.

### Fixed

- A date field no longer commits a half-typed value. Month and day now require two digits, so
  typing `2026-07-30` no longer flickers the workout onto the 3rd of the month on the way past
  `2026-07-3`.

## [1.2.5] — 2026-08-02

Storage schema **v7**.

### Changed

- **A plan is a day of the week.** No more free-text names: each plan is Monday through Sunday,
  chosen from a picker, at most one per day. That was already the truth — the week review reads
  plans as days and checks that muscles are trained on two *different* ones — but it was left
  implicit, and a name let the two drift apart. Moving a plan onto a day that is taken swaps the
  two, because rearranging a week should be one tap.
  - Existing plans are dealt onto weekdays in creation order, and one already named after a day
    keeps that day. **The names people typed are kept** rather than discarded.
- **Export writes a folder, not a file**, where the browser allows it. The first Export asks
  where to put it, creates `GRam/` there, and every export after writes into the same folder.

### Added

- **A sharded archive format.** `manifest.json` indexes everything with checksums; plans and
  profile are one file each; workouts are split **one file per calendar year**. Only the current
  year is ever rewritten, so the cost of saving stays flat however long the history gets —
  tested at 100 years and 15,000 sessions, where logging one more set rewrites two files.
  Reading is deliberately forgiving: a missing manifest, a missing year, a failed checksum or a
  truncated shard are warnings, and everything else still comes back.

### Removed

- **"Paste"**, and the JSON dump shown after every export.

## [1.2.4] — 2026-08-02

### Changed

- **Export goes back to where it went last time.** On a browser that can hold a file permission
  (Chrome, Edge) the first Export asks where to save and every one after writes straight there,
  no dialog. Elsewhere — including every iPhone — it hands the file to the share sheet, but the
  filename is now fixed, so saving into the same folder replaces the previous copy.
- **The backup filename is stable: `gram-backup.json`.** It used to carry the date, which meant
  every export created a *new* file and a folder slowly filled with near-identical copies, none
  of them obviously current. The date is still recorded inside the file.

## [1.2.3] — 2026-08-02

### Changed

- **"Export a backup" is now just "Export".**
- **Removed "Paste".** It existed as a fallback for platforms that could not open a file picker,
  and there are none — the picker works in an iOS home-screen web app too, which is the case it
  was there for. Import covers it.

## [1.2.2] — 2026-08-02

Storage schema **v6** — adds a version log; nothing existing changes.

### Added

- **About**, at the bottom of Profile: app version, data-format version, catalogue size, and
  **a log of every build this device has run**, with the date each first appeared. There is no
  server and no crash reporting, so "which version am I actually on?" had no answer — a question
  that went several rounds during the app-icon problem. The log is per device and an imported
  backup does not change it.

### Changed

- **The Plans tab is now "My week".** Its plans were never a library to pick from; they are the
  days of one training week, read together and checked for balance at the bottom of the screen.
  The name now says so, and the empty state and the add field talk about training days.
- **Removed the "This device" card.** Model, manufacturer, language, region and time zone were
  read from the phone and then never used for anything — a list of facts you already knew about
  your own phone. The one line worth quoting when something is wrong, the system string, moved
  into About.
- **Removed the "Health app sync" card.** It said the feature would arrive with the first
  development build, which is not true under this project's constraints, and a promise the app
  cannot keep is worse than silence. [docs/ROADMAP.md](docs/ROADMAP.md) now explains why: there
  is no web API for HealthKit or Health Connect, a native build is required, and on iOS the
  HealthKit entitlement needs a paid Apple Developer account — which zero-payment rules out.
  On Android it would be reachable.

## [1.2.1] — 2026-08-02

### Changed

- **Every commit now bumps the version and carries a tag.** Patch by default; minor and major
  only when asked for, resetting the levels below them. Written up in
  [AGENTS.md](AGENTS.md) and [docs/RELEASING.md](docs/RELEASING.md).
- **The exercise-recommendation review is tied to the minor series**, not to every version.
  `RECOMMENDED_REVIEWED_FOR` now holds `"1.2"` rather than `"1.2.0"`. With a patch bump on every
  commit, demanding a re-review each time would make the check noise, and noise gets stamped
  past without reading.
- **The muscle filter shows all its tags at once.** Eight groups — the same ones the week review
  checks — wrapped over two lines instead of seventeen muscles in a horizontal scroller that hid
  most of them. Tapping *Back* covers lats and mid back together. Calves, abs and the rest are
  still a word away in the search box.
- **Removed the goal, experience and equipment inputs from Profile.** All three were write-only:
  nothing in the app read them back, and the equipment card claimed the catalog was filtered by
  it, which was never true. The fields stay in stored data so the questions can return when
  something uses them.

### Fixed

- **The last character of a plan name still resisted deletion.** The previous fix addressed the
  store; the real cause was the input reading its value back out of the store on every keystroke,
  which on react-native-web races the browser and resets the field. The field now owns its own
  text — the same fix `NumberField` already carried, for the same reason.
- **A plan with no exercises could still not be started from the plan editor.** The Plans screen
  guard was removed in 1.2.0; the editor had a second copy of it.
- **The app did not fill the iPhone screen.** 1.2.0 pinned the layout to `visualViewport.height`
  at all times, which on iOS is not the full screen when the app paints under the status bar and
  home indicator. It now only does so while a keyboard is actually covering part of the screen.

## [1.2.0] — 2026-08-02

Backups that take themselves, where the browser allows it. Storage schema **v5** — adds a
backup record; plans and workouts are untouched.

### Added

- **Automatic export.** Choose a file once and GRam rewrites it a couple of seconds after
  anything changes. Put it in a synced folder and the backup leaves the device too.
  **Only where the browser permits it** — the File System Access API exists in Chrome and Edge
  on desktop and nowhere else. Not Safari, on any platform, and not Chrome on Android. The card
  says so plainly rather than offering a switch that quietly does nothing.
- **Backup reminders**, which is what iPhone gets instead. Measured in sets logged since the
  last backup, not in days: someone who has not trained in a fortnight has nothing at risk,
  someone who logged forty sets this week has a week to lose. It escalates rather than nagging
  from the start.
- The app now asks for **persistent storage** after an export, so a browser is less likely to
  reclaim space from a site it thinks is idle.

### Fixed

- **The last character of a plan name could not be deleted.** The store rejected an empty name
  and handed the old one back, so backspace put the letter straight back. Names can now be
  cleared and retyped; an abandoned blank one becomes "Untitled plan" when the field loses focus.
- **A plan with no exercises refused to start**, which was inconsistent with the "Start an empty
  workout" button directly below it, and wrong — building the session as you go is a normal way
  to train. The session screen can add exercises live.
- **Tapping the search box made the whole Exercises page scrollable.** The iOS keyboard shrinks
  the visual viewport but leaves the layout viewport at full height, so the header, filter chips
  and tab bar all became draggable. The layout is now pinned to the visual viewport and only the
  results list scrolls.

## [1.1.0] — 2026-08-02

Your data can leave the device now. Storage schema **v4**, unchanged.

### Added

- **Backup and transfer**, on the Profile tab. Export writes one file holding every plan,
  workout, setting and profile field; Import reads it back. This closes the trap the app has
  had since the start: everything lived on one device, and on iOS removing a home-screen web
  app takes its storage with it — which is also the only way to change its icon. A cosmetic
  change used to cost a training history.
- **Import accepts more than its own exports** — a raw zustand blob copied out of browser
  storage, or a bare state object, both work. That is a real recovery route when the app will
  not open. Backups written at an older schema are migrated on the way in.
- **Import always confirms first**, showing what is in the file against what is on the device,
  and saying plainly that it replaces rather than merges.
- Export degrades rather than failing: the system share sheet where it exists (the only route
  that works in an iOS home-screen web app), then a file download, then the clipboard — and the
  text is always on screen to select regardless.

### Fixed

- **Stored data was only validated when a migration ran.** zustand calls `migrate` on a version
  mismatch, so a blob already at the current schema went into live state unchecked, and a
  partial or truncated write could blank a screen. Found by seeding one into the running app.
  Validation now runs on every load, migration or not.

## [1.0.0] — 2026-08-01

**The app is now called GRam.** Storage schema **v4**, unchanged from 0.3.0 — the rebrand moves
no data.

### Changed

- **Renamed from FitRam to GRam**, with new artwork: app icon, and the landscape and portrait
  splash screens. Both splash images had the same bottom-right sparkle as the old ones and are
  cropped past it.
- **Four identifiers deliberately still say `fitram`** — the storage key, the bundle id, the
  `FitRam_` exercise-id prefix and the EAS slug. Every one of them is load-bearing: renaming
  them orphans user data, forks the app install, or breaks saved plans. They are invisible to
  users and documented in
  [docs/RELEASING.md](docs/RELEASING.md#names-that-kept-fitram-through-the-rebrand) so a later
  tidy-up does not "finish the job" and lose everyone's training history.
- **The week review demands a second training day first.** "Twice, on different days" cannot be
  met by a one-day week whatever exercises are in it, so with fewer than two plans the review
  now shows a single blocking item — add another day — instead of eight unfixable muscle gaps.
  It has no Ignore button, because it is a precondition rather than an opinion.
- **Fix lets you choose the exercise.** It opens the full exercise list filtered to the muscle
  in question, recommended picks starred at the top, searchable for anything else — then asks
  which day. It warns if the exercise you picked will not actually close the gap.
- **The plan editor no longer asks what a set records, or for a rest time.** The catalog already
  knows a plank is timed and a bench press is weight × reps, and rest comes from Settings. Two
  chip rows per exercise asking the user to restate facts the app has.

## [0.3.0] — 2026-08-01

Plans read as a week. Storage schema **v4** — adds one list; nothing existing changes.

### Added

- **Week review** on the Plans tab. Your plans are read together as a week and checked against
  one rule: eight muscle groups — chest, shoulders, triceps, back, biceps, glutes, hamstrings,
  quads — each trained at least twice a week, on different days, as the **primary** muscle of an
  exercise. Assistance work does not count. Reasoning in
  [docs/STUDY.md §4](docs/STUDY.md#4-defining-a-balanced-week).
- **Fix** on every issue: one tap adds the recommended exercise for that group to a day you
  choose. Only days that do not already train it are offered.
- **Ignore** on every issue, so advice you disagree with goes away and stays away, and
  **Review again** to bring all of it back.

### Fixed

- **Nested controls in exercise rows.** The picture and the row were one press target inside
  another, which react-native-web renders as a `<button>` inside a `<button>` — invalid HTML, a
  hydration error on every row, and two overlapping controls with no boundary for anyone using
  a screen reader. They are siblings now, in the exercise list and in the plan/session cards.
  Outside a description sheet the picture renders as a picture rather than a disabled button,
  so it no longer takes a dead place in the tab order.

### Changed

- The add-plan box is a single compact row and sits **after** the plan list rather than above
  it — the same shape as adding an exercise inside a plan.
- The exercise search keeps **one** filter: primary muscle. Tapping Chest now gives the 84
  exercises that target the chest rather than the 151 that involve it. The equipment, category
  and difficulty rows behind the filter toggle are gone; all three are searchable as text
  ("dumbbell chest", "beginner squat", "cardio"), so nothing became unreachable.
- The README banner uses the generated `assets/logo.jpg` instead of a separate hero image.
- Documentation no longer describes the app by reference to any commercial product. `docs/STUDY.md`
  is now an account of the training model itself, sourced from published exercise science.

## [0.2.0] — 2026-08-01

Search that finds things. Storage schema **v3**, unchanged — nothing to migrate.

### Added

- **Forgiving search.** A term is matched against the exercise name, the muscles it trains, the
  equipment and the category, through rungs that get progressively looser: exact word, prefix,
  singular/plural, punctuation-free run, gym shorthand, then a bounded typo. "pushup" finds
  Push-Up, "db curl" finds Dumbbell Curl, "squt" finds squats, "rdl" finds the Romanian
  deadlift.
- **Search by muscle.** Typing "chest", "pecs", "abs", "quads" or "legs" returns everything that
  trains it, not only the handful with the word in the name.
- **Recommended-first ordering.** A search that names a muscle comes back in three bands: the
  two exercises the evidence recommends for that muscle, then everything you have actually
  recorded — most-recorded first — then the rest by relevance. The picks carry a **TOP PICK**
  badge. An ordinary name search is left alone. Basis and sources in
  [docs/STUDY.md §6](docs/STUDY.md#6-which-exercise-should-the-app-put-first).
- **Six movements the dataset was missing** — incline treadmill walk, hiking, rucking, swimming,
  fan bike and battle ropes. free-exercise-db carries only fourteen cardio entries, and none of
  them was an incline walk.

### Changed

- The recommendations must be re-reviewed on every version bump; a test fails until the stamp in
  `src/catalog/recommended.ts` matches `package.json`. See
  [docs/RELEASING.md](docs/RELEASING.md#re-reviewing-the-exercise-recommendations).

### Performance

- Search costs ~1.3 ms per keystroke, ~2.9 ms through the typo path. Typo correction only runs
  when the query matched nothing read literally, and a 26-bit letter-set comparison rejects
  candidates before any edit-distance matrix is allocated.

## [0.1.0] — 2026-08-01

First proof of concept. Storage schema **v2**.

### Added

- **Exercise catalog** — 873 movements from free-exercise-db, searchable by name and filterable
  by muscle, equipment, category and difficulty.
- **How-to pages** — demonstration photos, numbered instructions, primary and secondary muscles,
  and your own logged history of that movement.
- **Custom plans** — reusable exercise lists; add, remove and reorder exercises, and set the
  default sets, weight, reps and rest for each.
- **Live workouts** — start from a plan or empty; add and remove sets, edit weight, reps, time or
  distance inline, record a set and un-record it, with a rest timer that starts on each recorded
  set. Finishing keeps only recorded sets.
- **Body heatmap** — front and back figures coloured by trailing 7-day volume or by current
  recovery, with a per-muscle breakdown.
- **History** — 7-day rollup plus a detail page per finished workout.
- **Profile** — body details, training goal, experience and available equipment. Weight units
  default from the phone's region; device model, OS, language and time zone are shown.
- **Data safety** — versioned schema with a forward migration chain, a verbatim pre-migration
  backup, and shape validation on load.

### Notes

- Training load is measured in *effective sets* — 1.0 per targeting muscle, 0.5 per assisting
  muscle — rather than tonnage, so timed and weighted exercises are comparable.
- Exercise photographs load from the upstream repository at runtime and are **not** cleared for
  redistribution. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) before publishing.
- Apple Health / Health Connect import is not implemented; it needs native modules that cannot
  run in Expo Go.

[0.1.0]: https://github.com/
