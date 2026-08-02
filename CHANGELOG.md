# Changelog

All notable changes to GRam. Format follows [Keep a Changelog](https://keepachangelog.com);
versions follow [Semantic Versioning](https://semver.org).

Each entry notes its **storage schema version**. Upgrading between any two releases preserves
all plans and logged workouts — see [docs/RELEASING.md](docs/RELEASING.md).

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
