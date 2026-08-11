# Releasing and upgrading

**The rule: a user upgrading from any previous version keeps every plan and every logged set.**

Everything below exists to make that true.

---

> GRam is never published to an app store — see [DISTRIBUTION.md](DISTRIBUTION.md). Everything
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

### Names that kept `fitram` through the rebrand

The app was called FitRam until v0.4.0. Four identifiers still say `fitram`, and every one of
them is load-bearing. Renaming any of them silently destroys or orphans user data, so they were
left alone on purpose — a later tidy-up that "finishes the rename" is a data-loss bug.

| Identifier | Where | What renaming it does |
|---|---|---|
| `fitram-v1` | `src/store/storage.ts` | Points the app at an empty storage slot. Every user opens a blank app with their history still on disk and unreachable. |
| `app.fitram.mobile` | `app.json` | A different bundle id is a different app: second icon, empty database, no upgrade path. |
| `FitRam_*` exercise ids | `scripts/build-catalog.mjs` | These ids are written into saved plans and session logs. Renaming turns every planned incline walk into "Unknown exercise". |
| `slug: "fitram"` | `app.json` | The EAS project identity. Changing it orphans the project and its signing keys — and losing the Android keystore means no future build can upgrade an existing install. |

None of them is visible to a user. The name they see comes from `app.json`'s `name`, the web
manifest, and `public/index.html`.

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

[Semantic versioning](https://semver.org). Currently **1.0.0**. Up to 0.3.0 the leading `0.`
said the schema and feature set were not yet stable; 1.0.0 says they are. Breaking changes now
need a major bump, and the storage schema only ever moves forward through a migration.

**Every commit bumps the version and carries a tag** — including documentation-only commits.
The default is a patch bump; minor and major happen only when asked for.

| Asked for | Bump | Example |
|---|---|---|
| nothing said (the default) | patch | 1.2.0 → 1.2.1 |
| "minor" — new feature, existing data still works | minor, patch to zero | 1.2.7 → 1.3.0 |
| "major" — rework that changes expectations | major, minor and patch to zero | 1.3.4 → 2.0.0 |

`version` lives in `app.json` and `package.json` — keep them equal.

### Committing is local; pushing is a release

A push to `origin main` triggers a Netlify build, and builds are metered. So the two halves come
apart deliberately:

- **Commit and tag every feature**, patch bump, immediately, locally.
- **Push only when the bump is minor or major.** That push carries the accumulated patch commits
  and their tags with it — `git push origin main --follow-tags`.

A run of patch tags therefore exists locally before it exists on GitHub. That is fine: the tags
are numbered from the same `package.json` the commit changed, so nothing renumbers when they
finally go out. What it does mean is that **the version visible to a phone only ever moves on a
minor or major release** — the patch numbers in between are a local audit trail, not shipped
builds.

It also puts the exercise-recommendation review (below) squarely on the release boundary rather
than somewhere inside the batch, which is where a review is worth doing anyway.

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
- [ ] Tagged: `git tag -a v0.2.0 -m "..."` — and pushed with
      `git push origin main --follow-tags` only if this is a minor or major bump.

### Re-reviewing the exercise recommendations

[`src/catalog/recommended.ts`](../src/catalog/recommended.ts) names the two best exercises per
muscle, and they decide what a search by muscle puts at the top. The evidence behind them moves,
and a list nobody revisits turns into folklore, so **every minor bump forces a review**:
`RECOMMENDED_REVIEWED_FOR` holds a minor *series* — `"1.2"`, not `"1.2.0"` — and must equal the
major.minor of `package.json`, or `src/catalog/__tests__/recommended.test.ts` fails.

Patch releases are exempt on purpose. With a patch bump on every commit, demanding a re-review
each time would turn the check into noise, and noise gets stamped past without thinking.

Bumping to a new minor or major version therefore means:

1. Redo the research. The sources and the criteria used last time are in
   [STUDY.md §6](STUDY.md#6-which-exercise-should-the-app-put-first). Look for newer per-muscle
   rankings from the same coaches and any new trials.
2. Change the picks where the evidence has moved, and update the comment saying why. The comment
   is the audit trail — a pick with no stated reason is indistinguishable from a guess.
3. Set `RECOMMENDED_REVIEWED_FOR` to the new version and `RECOMMENDED_REVIEWED_ON` to today.
4. Run the suite. It checks that every id exists, that each pick actually trains the muscle it
   is filed under, and that no stretch was recommended as training.

If the research turns up nothing new, re-stamp and move on — the point is that the decision is
conscious, not that the file must change.

### The feedback box needs one setting that is not in this repo

Profile has a note box that posts to Netlify Forms. The form itself is declared as a hidden
`<form name="gram-feedback">` in [`public/index.html`](../public/index.html) — Netlify finds
forms by parsing the *deployed* HTML, so it has to be in the document rather than only in React.
`scripts/build-web.mjs` fails the build if an export stops carrying it, and
`src/__tests__/feedback.test.tsx` fails if the field names drift from what the app posts.

**Netlify will not see the form until form detection is switched on.** This is the step that is
easy to miss, because nothing anywhere reports it: the form is in the deployed HTML, the build
passes, the app posts, and the dashboard simply has no form called `gram-feedback` to configure.
Netlify turned detection **off by default for new sites in April 2023** to save build time, and
a site that has never used Forms has never had it on.

1. Netlify → this site → **Forms** in the left-hand nav → **Enable form detection**.
2. **Redeploy.** Detection runs during a build, so enabling it changes nothing until the next
   one. Deploys → *Trigger deploy* → *Deploy site*. No commit is needed; it rebuilds `main` as
   it stands, and it does spend one of the metered builds.
3. `gram-feedback` now appears under Forms with zero submissions. Until this point step 4 has
   nothing to select, which is exactly what "I cannot find gram-feedback" looks like.
4. **The destination address, which lives here and nowhere else:** Site configuration →
   **Notifications** → **Form submission notifications** → *Add notification* → *Email
   notification*, pick `gram-feedback`, enter the address.

Before step 2 a submission is answered with a 404 and the note is lost — the app reports that
honestly as "it did not go through" and keeps the text. Between steps 2 and 4 submissions are
kept and readable under Forms; they just do not email anyone.

Steps 1 to 3 are the whole price of this approach over a `mailto:` or an inbox API key, and it
is worth paying once. Anything compiled into the bundle is a file every visitor can download, so
an address "hidden" in the JavaScript is a public address — base64, string splitting and the
rest buy nothing but the feeling of having solved it. Server-side means the repository never
learns the address, the bundle never carries it, and changing it later is a dashboard edit
rather than a release. The free tier covers 100 submissions a month.

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
