# Changelog

All notable changes to FitRam. Format follows [Keep a Changelog](https://keepachangelog.com);
versions follow [Semantic Versioning](https://semver.org).

Each entry notes its **storage schema version**. Upgrading between any two releases preserves
all plans and logged workouts — see [docs/RELEASING.md](docs/RELEASING.md).

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
