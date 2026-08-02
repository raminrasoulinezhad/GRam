# Changelog

All notable changes to FitRam. Format follows [Keep a Changelog](https://keepachangelog.com);
versions follow [Semantic Versioning](https://semver.org).

Each entry notes its **storage schema version**. Upgrading between any two releases preserves
all plans and logged workouts — see [docs/RELEASING.md](docs/RELEASING.md).

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
