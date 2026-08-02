# Roadmap

Where GRam goes after the v0.1.0 proof of concept. Ordered by value per unit of work.

The PoC deliberately built the *first* arrow of the loop described in [STUDY.md](STUDY.md) —
log what you did, and see which muscles it hit. Everything below is the second arrow: using
that record to decide what you should do next.

---

## v0.2 — Smart suggestion

The single highest-value addition, and the reason the data model already stores what it does.

- **Per-exercise 1RM estimate** via Epley (`1RM = w × (1 + r/30)`), maintained from logged sets.
- **Double progression** — seed each set's target from your last performance: hit the top of the
  rep range on every set → add load; otherwise add a rep.
- **Reps in Reserve** on each recorded set, feeding the estimate.

Slots into the existing `SetTemplate` with no schema change: today the templates hold numbers
the user typed, tomorrow they hold numbers the app proposed and the user can overrule.

## v0.3 — Workout generation

Rank the catalog by
`recovery × goal fit × equipment availability × recent-use penalty` and emit a session. The
profile already captures goal, experience and equipment; recovery already exists as a pure
function. This is mostly a scoring function and a screen.

## v0.4 — Results

- 1RM trend per lift over time
- Weekly volume per muscle, charted against the 10–20 set guideline
- A single strength score, so progress is legible at a glance

## v0.5 — Session quality

- Rest timer refinements: notification when backgrounded, sound and haptics
- Supersets and circuits
- Max Effort days to re-anchor 1RM estimates
- Plate calculator

## Health app import — blocked, and honestly so

Height, weight and cardio load from **Apple HealthKit** or **Android Health Connect** would let
a run or a ride feed the recovery model instead of being invisible to it. It is the most
requested-sounding feature on this list and the one least likely to happen. The reasons are
worth writing down so nobody re-litigates them every few months.

**There is no web API for either.** HealthKit is not exposed to Safari, to a home-screen web
app, or to any browser. Health Connect is not exposed to Chrome. No amount of PWA work reaches
them; this is not a gap to be engineered around.

**So it needs a native build**, which means leaving Expo Go and building a binary with EAS.
That is a workflow change but not a blocker on its own.

**On iOS it then needs a paid Apple Developer account.** The HealthKit entitlement is not
available to a free personal team, so the $99/year membership is a hard prerequisite —
and this project's constraints are zero payment and never publishing to a store. Those
constraints and this feature cannot both hold. The constraints win.

**On Android it is actually reachable.** Health Connect needs a native build but no paid
account, because an APK can be installed directly. If the day-to-day phone were Android, this
would move from "blocked" to "a few days' work".

Until one of those facts changes, height and weight are typed into the profile by hand, and
cardio is logged as an exercise like anything else — the catalog carries the movements for it,
including the ones the upstream dataset was missing.

## Later

- **Own exercise media.** The current photographs have unresolved provenance — see
  [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md). This blocks any public release, and it is
  a content problem rather than an engineering one.
- **Custom exercises** the user defines themselves.
- **Export and import** — a user should be able to get their training log out.
- **Backend and sync**, only if the app needs to leave one device. Everything today is local,
  which is a feature: no account, no server, nothing transmitted.
- **SQLite** if the JSON blob ever becomes a bottleneck. All reads already go through selectors
  in `src/store`, so the swap stays contained there.

---

## Non-goals

Social feeds, coaching content, subscriptions, and anything requiring an account. The value here
is the loop, not the network.
