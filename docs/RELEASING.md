# Releasing and upgrading

**The rule: a user upgrading from any previous version keeps every plan and every logged set.**

Everything below exists to make that true.

---

> FitRam is never published to an app store — see [DISTRIBUTION.md](DISTRIBUTION.md). Everything
> below describes direct distribution to your own devices.

## How an upgrade actually reaches a user

Two channels, and which one applies depends only on whether native code changed.

| What changed | Channel | Experience |
|---|---|---|
| JS, UI, copy, business logic | **EAS Update (OTA)** | Downloads silently in the background, applies on next launch. Nothing to tap. |
| Native modules, Expo SDK, permissions, app icon, anything in `ios/` or `android/` | **New build** | Install the new APK over the old one, or reinstall the ad-hoc iOS build. |

In practice almost everything is the first row.

### Installing over the top is an upgrade, not a reinstall

- Installing a newer APK over an installed one **replaces the binary and leaves the app's data
  directory untouched**. Android does not uninstall first.
- The only things that wipe local data are uninstalling, "Clear storage" in Android settings,
  offloading on iOS, or the app's own **Erase all data** button.

Two conditions must hold, both handled by EAS:

- **Same signing key.** Android only grants a new APK access to the old one's data if the
  signature matches; a differently-signed APK will refuse to install at all. EAS generates the
  keystore on first build and reuses it. Losing it means no future version can upgrade an
  existing install. Keep a copy via `eas credentials`.
- **Higher `versionCode`.** Android rejects an APK whose version code did not increase. EAS
  auto-increments it (`appVersionSource: "remote"`).

Also never change the **bundle id** (`app.fitram.mobile`). A different id is a different app —
a second icon and an empty database.

So the storage survives on its own. What does *not* survive automatically is the **shape** of
that storage when our code starts expecting something new. That is the next section.

---

## Changing the shape of stored data

All user data is one JSON blob under the AsyncStorage key `fitram-v1`, versioned by
`SCHEMA_VERSION` in [`src/store/migrations.ts`](../src/store/migrations.ts).

### The procedure

1. **Bump `SCHEMA_VERSION` by one.**
2. **Add a step to `MIGRATIONS`**, keyed by the *new* version, that transforms the previous
   shape into the new one.
3. **Add the old payload as a fixture** in
   [`src/store/__tests__/migrations.test.ts`](../src/store/__tests__/migrations.test.ts) and
   assert the data still means the same thing afterwards.
4. **Never edit an existing migration step.** Someone out there is still on that version, and
   their upgrade path runs through that exact code.

Steps run in ascending order, so a user who skipped four releases runs all four migrations in
turn. There is no "jump straight to latest" path to get wrong.

### Two traps already handled

- **`migrate` must be synchronous.** zustand does not await an async `migrate`; it discards the
  result and falls back to the initial state, which presents to the user as *all their data is
  gone*. Keep it sync.
- **zustand does not validate what it read.** It casts the blob straight to the state type, so a
  truncated write would surface as a crash on whichever screen assumed an array. `coerce()`
  checks the shape and substitutes defaults. It is deliberately permissive about plans and
  sessions — a slightly malformed row is kept, because dropping someone's training log is far
  worse than rendering an odd entry.

### The safety net

Before any migration runs, [`src/store/storage.ts`](../src/store/storage.ts) copies the old blob
verbatim to `fitram-v1-backup-v{oldVersion}`. It is written once and never overwritten, so it
holds the data exactly as it was before that upgrade. If a migration ships with a bug, the
original is still on the device and recoverable rather than overwritten.

---

## Version numbers

[Semantic versioning](https://semver.org). Currently **0.1.0** — the leading `0.` says the
schema and feature set are not yet stable, so breaking changes are allowed without a major bump.

| Change | Bump | Example |
|---|---|---|
| Bug fix, no new behaviour | patch | 0.1.0 → 0.1.1 |
| New feature, existing data still works | minor | 0.1.1 → 0.2.0 |
| Rework that changes expectations | major | 0.9.0 → 1.0.0 |

`version` lives in `app.json` and `package.json` — keep them equal.

**Build numbers are not your problem.** `eas.json` sets `appVersionSource: "remote"` and
`autoIncrement` on the production profile, so EAS assigns the iOS build number and Android
`versionCode`. Both stores reject an upload whose build number did not increase, and
hand-managing that is a reliable way to waste an afternoon.

**Runtime version** uses the `fingerprint` policy. Expo hashes everything affecting the native
runtime and only delivers an OTA update to a binary with a matching fingerprint. A JS update can
therefore never land on a binary lacking a native module it needs — the failure mode that makes
OTA scary is designed out.

---

## Release checklist

```bash
npm run typecheck && npm test     # must be green
npm run licenses                  # if dependencies changed
```

- [ ] If the stored shape changed: `SCHEMA_VERSION` bumped, migration step added, fixture added,
      test asserts the old data survives.
- [ ] Version bumped in **both** `app.json` and `package.json`.
- [ ] **Exercise recommendations re-reviewed** — see below. The suite will not go green until
      this is done.
- [ ] `CHANGELOG.md` updated.
- [ ] Tagged: `git tag -a v0.2.0 -m "..." && git push --tags`

### Re-reviewing the exercise recommendations

[`src/catalog/recommended.ts`](../src/catalog/recommended.ts) names the two best exercises per
muscle, and they decide what a search by muscle puts at the top. The evidence behind them moves,
and a list nobody revisits turns into folklore, so **every version bump forces a review**:
`RECOMMENDED_REVIEWED_FOR` must equal `package.json`'s version, and
`src/catalog/__tests__/recommended.test.ts` fails until it does.

Bumping to a new minor or major version therefore means:

1. Redo the research. The sources and the criteria used last time are in
   [STUDY.md §6](STUDY.md#6-which-exercise-should-the-app-put-first). Look for newer per-muscle
   rankings from the same coaches and any new trials.
2. Change the picks where the evidence has moved, and update the comment saying why. The comment
   is the audit trail — a pick with no stated reason is indistinguishable from a guess.
3. Set `RECOMMENDED_REVIEWED_FOR` to the new version and `RECOMMENDED_REVIEWED_ON` to today.
4. Run the suite. It checks that every id exists, that each pick actually trains the muscle it
   is filed under, and that no stretch was recommended as training.

A patch release that changes nothing about exercise selection can simply re-stamp
`RECOMMENDED_REVIEWED_FOR` after a quick look — the point is that the decision is conscious, not
that the file must change.

**Ship a JS-only change** (no native code touched):

```bash
npx eas update --branch production --message "Fix rest timer drift"
```

**Ship a native change:**

```bash
npx eas build --profile production --platform all
npx eas submit --profile production --platform all
```

### Before the very first store release

Ship a binary *before* you need to migrate anything, then test the upgrade path for real:
install the old build on a device, create a plan and log a workout, install the new build over
the top, and confirm the data is still there. A migration that has only ever run in a unit test
is a migration you have not tested.
