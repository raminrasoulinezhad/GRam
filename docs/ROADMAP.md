# Roadmap

Where FitRam goes after the v0.1.0 proof of concept. Ordered by value per unit of work.

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

## v0.6 — Health app import

Height, weight, age and cardio load from **Apple HealthKit** and **Android Health Connect**,
so that a run or a ride feeds the recovery model rather than being invisible to it.

⚠️ **This is the one item with a hard prerequisite.** Both need native modules, which cannot run
inside Expo Go. Adopting it means moving to an EAS development build — from that point on,
running the app on a phone requires building a binary rather than scanning a QR code. Worth
doing, but it changes the day-to-day workflow, so it is deliberately late in the order.

The profile screen already reads what the phone offers without permissions (region, locale,
device, time zone) and states plainly that health import is not yet connected.

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
