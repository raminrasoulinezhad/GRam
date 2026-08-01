# FitRam

A strength-training tracker that plans your sets and shows you which muscles you have actually
trained. One TypeScript codebase, real iOS and Android apps.

Built as a proof of concept reimplementing the core ideas behind [Fitbod](https://fitbod.me) —
see [docs/STUDY.md](docs/STUDY.md) for what that app does and which parts are reproduced here.

---

## What it does today

| | |
|---|---|
| **Exercise catalog** | 873 movements, searchable by name and filterable by muscle, equipment, category and difficulty. |
| **How-to pages** | Demo photos, numbered instructions, primary and secondary muscles, and your own logged history of that movement. |
| **Custom plans** | Reusable lists of exercises. Add, remove, reorder; set the default sets, weight, reps and rest per exercise. |
| **Live workouts** | Start a plan, then add or remove sets, edit weight / reps / time / distance inline, record a set and un-record it, with a rest timer that starts on each recorded set. |
| **Body heatmap** | Front and back figures coloured by what you have trained — this week's volume, or how recovered each muscle is right now. |
| **History** | A 7-day rollup and a detail page for every finished workout. |
| **Profile** | Your body details, goal and equipment, with units defaulted from your phone's region. |

Everything is stored on the device. There is no account, no server, and nothing is transmitted
anywhere.

---

## Running it

```bash
npm install
```

**On your phone** — install Expo Go ([iOS](https://apps.apple.com/app/expo-go/id982107779),
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)), then:

```bash
npx expo start
```

Scan the QR code. Works on iPhone and Android from the same command.

**In a browser**, for quick checks:

```bash
npx expo start --web
```

### Building real app binaries

`eas.json` carries `preview` (Android APK, iOS simulator) and `production` profiles. Building
requires an Expo account and, for iOS, an Apple Developer account:

```bash
npx eas login
npx eas build --profile preview --platform android
```

Local native builds need a Java/Android SDK toolchain; iOS binaries need macOS or EAS cloud.

---

## Development

```bash
npm test           # 184 tests
npm run typecheck  # tsc --noEmit
npm run licenses   # regenerate the dependency table in THIRD-PARTY-NOTICES.md
npm run build:catalog   # re-import the exercise dataset from upstream
```

### Layout

```
app/                     expo-router routes; the file tree is the navigation tree
  (tabs)/                Plans, Exercises, Body, History, Profile
  plan/[id]              plan editor
  session/[id]           the active workout — the screen that matters
  exercise/[id]          how-to page
src/
  catalog/               the bundled exercise data and its search
  store/                 zustand state, persisted to AsyncStorage
  analytics/             pure functions: effective sets, recovery, muscle mapping
  ui/                    shared components and the theme
scripts/build-catalog.mjs   regenerates assets/data/exercises.json
```

### How training load is measured

In **effective sets**, not tonnage. Each recorded set counts 1.0 for every muscle the exercise
targets and 0.5 for every muscle it assists.

Tonnage cannot compare 100 kg × 5 against a 60-second plank, and it flatters whichever lifts
happen to move the most absolute weight. Counting sets is how the hypertrophy literature
expresses weekly volume, and it is the unit behind the widely cited 10–20 sets per muscle per
week guideline. It also means every exercise in the catalog contributes on the same scale,
whether it is measured in reps, seconds or metres.

Recovery uses the same contributions with exponential decay: a hard 12-set session leaves the
muscle around 14% recovered immediately, 47% at 48 hours, 64% at 72 hours and 90% at six days.

---

## Licensing

FitRam is licensed under the [Apache License 2.0](LICENSE).

The exercise data comes from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
under the Unlicense (public domain).

⚠️ **The exercise photographs are a different matter.** They are not bundled here — the how-to
screen loads them from the upstream repository at runtime — and their copyright status has never
been established upstream. Read [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) before
publishing this app anywhere. It is fine for personal use; it is not ready to ship to a store
with those images in place.

FitRam is not affiliated with or endorsed by Fitbod.
