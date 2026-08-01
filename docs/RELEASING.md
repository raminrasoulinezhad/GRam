# Releasing and upgrading

**The rule: a user upgrading from any previous version keeps every plan and every logged set.**

Everything below exists to make that true.

---

## How an upgrade actually reaches a user

There are two channels, and which one applies depends only on whether native code changed.

| What changed | Channel | User experience |
|---|---|---|
| JS, UI, copy, business logic | **EAS Update (OTA)** | Downloads silently in the background, applies on the next launch. No store, no review, no tap. |
| Native modules, Expo SDK, permissions, app icon, anything in `ios/` or `android/` | **Store build** | Normal App Store / Play update. |

### Nobody reinstalls, and nobody loses data

This is the part worth being clear about, because it is the usual worry:

- An App Store or Play update **replaces the binary and leaves the app's data directory
  untouched**. It is not an uninstall-then-install.
- The only things that wipe local data are the user deleting the app, "Clear storage" in Android
  settings, or offloading on iOS.
- This holds as long as two things never change: the **bundle id** (`app.fitram.mobile`) and the
  **signing key**. Change either and the store treats it as a different app — users would get a
  second icon and an empty database. Do not change them.

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
- [ ] `CHANGELOG.md` updated.
- [ ] Tagged: `git tag -a v0.1.0 -m "..." && git push --tags`

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
