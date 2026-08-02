# Changelog

All notable changes to GRam. Format follows [Keep a Changelog](https://keepachangelog.com);
versions follow [Semantic Versioning](https://semver.org).

Each entry notes its **storage schema version**. Upgrading between any two releases preserves
all plans and logged workouts — see [docs/RELEASING.md](docs/RELEASING.md).

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
