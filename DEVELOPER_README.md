# Developer guide

Everything needed to work on GRam. For what the app *is* and how to install it, see the
[README](README.md).

```bash
npm install
npm test           # 224 tests
npm run typecheck
npx expo start     # dev server; scan the QR with Expo Go
```

---

## Layout

```
app/                        expo-router routes — the file tree IS the navigation tree
  (tabs)/                   Plans · Exercises · Body · History · Profile
  plan/[id]                 plan editor
  session/[id]              the active workout — the screen that matters
  exercise/[id]             how-to page
src/
  catalog/                  bundled exercise data + search
  store/                    zustand state, persisted, with schema migrations
  analytics/                pure functions: effective sets, recovery, muscle mapping
  ui/                       shared components, theme, muscle glyphs
scripts/
  build-catalog.mjs         regenerates assets/data/exercises.json from upstream
  build-web.mjs             builds dist/ and stamps the service worker
  build-icons.mjs           regenerates every icon from assets/brand/
  licenses.mjs              regenerates the dependency table in THIRD-PARTY-NOTICES.md
```

**Stack:** Expo SDK 57 · React Native 0.86 · TypeScript · expo-router · zustand · react-native-svg.
All runtime dependencies are MIT.

---

## Two ideas worth knowing before changing anything

### Training load is measured in effective sets

Each recorded set counts **1.0** for every muscle the exercise targets and **0.5** for every
muscle it assists. Not tonnage.

Tonnage can't compare 100 kg × 5 against a 60-second plank, and it flatters whichever lifts move
the most absolute weight. Counting sets is how the hypertrophy literature expresses weekly volume
and puts every exercise on one scale, whether it's measured in reps, seconds or metres. Lives in
[`src/analytics/volume.ts`](src/analytics/volume.ts) as pure functions over the session log.

### Nothing is fetched from anywhere

No server, no account, no third-party host — not even for images. Exercise artwork is drawn in
[`src/ui/MuscleGlyph.tsx`](src/ui/MuscleGlyph.tsx). This is a licensing decision as much as a
technical one; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) before adding any remote
asset. The CSP in `netlify.toml` is `default-src 'self'` and should stay that way.

---

## Data safety

**The rule: upgrading from any previous version keeps every plan and every logged set.**

All user data is one JSON blob in AsyncStorage, versioned by `SCHEMA_VERSION` in
[`src/store/migrations.ts`](src/store/migrations.ts).

To change its shape:

1. Bump `SCHEMA_VERSION` by one
2. Add a step to `MIGRATIONS`, keyed by the **new** version
3. Add the old payload as a fixture in `src/store/__tests__/migrations.test.ts`
4. **Never edit an existing step** — someone is still on that version

Two traps already handled: `migrate` must stay **synchronous** (zustand discards an async one and
falls back to initial state, which reads as total data loss), and `coerce()` validates the blob
because zustand casts it blindly. A verbatim backup is written before any migration runs.

Full detail: [docs/RELEASING.md](docs/RELEASING.md).

---

## Deploying

The app is a static site. `git push` is the whole deploy.

### How it's wired

```
git push → GitHub → Netlify builds (npm run build:web) → publishes dist/ → live
```

`netlify.toml` holds the build command, publish directory, Node version, cache headers and CSP —
so the deploy is reproducible and reviewable rather than living in dashboard settings.

### First-time setup

**1. Push to GitHub** (already done — [raminrasoulinezhad/fitram](https://github.com/raminrasoulinezhad/fitram)):

```bash
git remote add origin https://github.com/<you>/fitram.git
git push -u origin main
```

**2. Connect Netlify to the repo.**

- *Existing drag-drop site:* **Site configuration → Build & deploy → Continuous deployment →
  Link repository → GitHub → fitram**. Keeps the current URL, which matters — see the warning
  below.
- *New site:* **Add new site → Import an existing project → GitHub → fitram**.

**Leave the build settings blank.** `netlify.toml` supplies them; anything typed into the
dashboard just competes with it.

**3. Verify:**

```bash
U=https://your-site.netlify.app
for p in / /manifest.json /sw.js /body; do
  printf "%-18s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$U$p")"
done
```

All four must be `200`. **`/body` is the one that matters** — a 404 there means `_redirects`
isn't being applied and refreshing inside the app would break.

> ⚠️ **Changing the URL is a fresh install.** Browser storage is per-origin, so moving from
> `x.netlify.app` to `gram.example.com` means re-adding the home-screen icon, and the new
> address starts empty. Export a backup from the old one first (**Profile → Backup and
> transfer**) and import it at the new one. Still, settle the address before logging real
> training — it is one less thing to remember.

### Custom subdomain with DNS on Cloudflare

Netlify → **Domain management → Add a domain**, then in Cloudflare DNS:

```
gram   CNAME   your-site.netlify.app
```

Set it to **DNS only (grey cloud)**, not proxied — Cloudflare proxying in front of Netlify
blocks certificate issuance and can cause redirect loops.

### Everyday releases

```bash
npm run typecheck && npm test    # must be green
git push                         # that's it
```

Bump the version in **both** `app.json` and `package.json`, update `CHANGELOG.md`, and tag:

```bash
git tag -a v0.2.0 -m "..." && git push --tags
```

---

## Brand assets

Source artwork lives in `assets/brand/`; everything else is generated.

| File | Used for |
|---|---|
| `assets/brand/icon-source.png` | app icon — home screen, favicon, Android adaptive |
| `assets/brand/logo-source.png` | splash screen, landscape |
| `assets/brand/logo-source-cellphone.png` | splash screen, portrait |

`npm run build:icons` writes the generated `assets/logo.jpg` (landscape) and
`assets/logo-portrait.jpg`. The landscape one doubles as the README banner, so the README
picture updates whenever the splash artwork does and there is no third file to keep in step.

```bash
npm run build:icons                  # regenerate everything
npm run build:icons -- --inset=12    # more margin around the artwork
npm run build:icons -- --no-trim     # artwork is already tightly cropped
```

The script auto-crops to the artwork's bounding box, which strips any background tile and any
stray flourish floating in a corner — both would otherwise be baked into an icon the OS then
rounds off again. Icons are flattened onto `#0B1220` because iOS renders transparency as black.

Never hand-edit `public/icons/`, `assets/icon.png`, `assets/favicon.png`, `assets/logo.png` or
`assets/android-icon-*` — they are all outputs.

---

## Testing

224 tests, no network, no snapshots.

| Suite | Covers |
|---|---|
| `catalog` | dataset integrity, search, and that no image path ever creeps back in |
| `volume` | effective-set maths, window boundaries, the recovery decay curve |
| `muscleMap` | every catalog muscle maps to a drawable body region |
| `migrations` / `storage` | a real v1 payload replayed forward; the pre-migration backup |
| `useStore` | every store action, including the record / un-record loop |
| screen tests | the real screens, driven by pressing the real buttons |

The screen tests earn their keep — they caught an infinite render loop, a dead confirmation
dialog, a phantom dialog left in the DOM, and a timezone bug in age calculation.

Two things to know about the harness: `@testing-library/react-native` v14 made `render()` and
`fireEvent()` **async**, so they must be awaited or every query fails. And `react-native-svg`
renders to `null` under jest, so the glyphs are tested as data (every muscle has a region)
rather than by rendering.

---

## Other documents

- [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) — the never-publish-to-a-store policy, and why
- [docs/RELEASING.md](docs/RELEASING.md) — versioning and data migrations in full
- [docs/STUDY.md](docs/STUDY.md) — the training science the design rests on, and the reasoning
  behind the volume, recovery and recommendation models
- [docs/ROADMAP.md](docs/ROADMAP.md) — what's next
- [docs/QUICKSTART.md](docs/QUICKSTART.md) — plain-English install guide
