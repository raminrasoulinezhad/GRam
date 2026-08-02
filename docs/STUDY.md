# Study: what Fitbod does, and what FitRam reproduces

Research behind FitRam's design, drawn from Fitbod's own engineering blog and help centre.
Sources at the bottom. FitRam contains no Fitbod code or assets and is not affiliated with them.

---

## 1. The idea worth copying

Fitbod is not interesting as a set logger — there are hundreds of those. It is interesting
because it closes a loop:

> log what you did → infer which muscles are fatigued → choose what you should do next

Everything distinctive about the product falls out of that loop. The body heatmap is the loop
made visible; the workout generator is the loop made actionable. A tracker that only records
sets has built the first arrow and stopped.

---

## 2. The algorithm

### Muscle recovery

Every muscle group carries a **recovery score from 0 to 100%**, derived from recent training
history. The stated physiological basis: trained muscle needs **48–72 hours** before it can be
worked at full intensity again, and is treated as fully recovered after about **six days**.
Users can correct the estimate by hand on the Body tab.

### Exercise Selector

Scores and ranks the whole **800+** exercise library per user, on five criteria in priority
order:

1. **Recovery status** — highest weight; favours fresh muscles
2. **Goal appropriateness** — trainer-rated per goal and experience level
3. **User feedback history** — learns from exercises added, removed and favourited
4. **Training split compatibility** — respects Push/Pull/Legs and similar structures
5. **Equipment availability** — constrained by the user's gym profile

### Capability Recommender

Chooses weight, sets and reps from a **continuously re-estimated 1RM** (Epley), refined from
every logged set. Goal presets:

| Goal | Reps | Load | Rest |
|---|---|---|---|
| Strength | 1–6 | 85–100% 1RM | 3–5 min |
| Hypertrophy | 6–12 | — | 10–20 working sets per muscle per week |
| General fitness | higher | — | short |

### Progressive overload

- **Max Effort days** — every few workouts an exercise is flagged for an AMRAP final set, which
  re-anchors the 1RM estimate against reality.
- **Reps in Reserve** — the user logs how many reps were left in the tank. Cited guidance:
  1–2 RiR for hypertrophy, 2–3 for strength.
- **Deliberate heavy/light cycling** rather than repeating an identical scheme, to avoid
  accommodation.

### External load

Apple Health, Health Connect, Fitbit and Strava feed cardio into the same recovery model, so
recommendations stay calibrated on active-recovery days.

---

## 3. Feature surface

- Exercise library with instructional video/GIF per movement
- Browse by muscle, name, or equipment
- Per-exercise history of every past set
- **Body tab** — front/back recovery heatmap
- **Workout tab** — the generated session; add, remove, swap, reorder; edit sets inline
- **Log tab** — completed workouts, drillable
- **Results** — 1RM trend per lift, strength score, volume and intensity trends
- **Rest timer** — auto-starts on set completion, tone and vibration
- **Supersets and circuits** — auto-grouped when enabled
- **Gym profile** — equipment toggles constraining everything upstream

---

## 4. What FitRam does differently

### Effective sets, not tonnage

Fitbod's recovery model weighs sets, reps and load per muscle. FitRam uses a simpler unit that
happens to solve a problem tonnage cannot: **each recorded set contributes 1.0 to every muscle
the exercise targets and 0.5 to every muscle it assists.**

Tonnage (weight × reps) cannot compare 100 kg × 5 against a 60-second plank, and it flatters
whichever lifts move the most absolute weight — a deadlift will always dwarf a lateral raise
regardless of the training stimulus. Counting sets is how the hypertrophy literature expresses
weekly volume, and it is the unit Fitbod's own "10–20 sets per muscle per week" guidance is
already stated in. It also puts every exercise in the catalog on one scale whether it is
measured in reps, seconds or metres.

### The recovery curve

Fatigue from each recorded set decays exponentially with a 48-hour time constant; recovery is
the exponential complement of accumulated fatigue, saturating around 6 effective sets. For a
hard 12-set session:

| Time since | Recovered |
|---|---|
| immediately | ~14% |
| 48 h | ~47% |
| 72 h | ~64% |
| 6 days | ~90% |

Which lines up with the 48–72 hour "trainable again" and six-day "fully recovered" heuristics
without needing per-user machine learning. Implemented in
[`src/analytics/volume.ts`](../src/analytics/volume.ts) as pure functions over the session log,
so it is unit-testable without rendering anything.

### Two views, not one

Fitbod's Body tab shows freshness. FitRam defaults to **this week's volume** — "which muscles
have I actually hit" — because that is the question a lifter planning a week asks, and offers
recovery as a toggle. Both are derived from the same contributions.

---

## 5. Deliberately not reproduced

| | Why |
|---|---|
| ML-ranked exercise selection | Needs the 400M+ logged workouts Fitbod trains on. A rules-based ranker gets most of the value. |
| Cold-start weights from aggregate users | Same reason. The user enters a starting weight instead. |
| Health app sync | Needs native modules that cannot run in Expo Go. |
| Supersets and circuits | Scope. |
| Social features, coaching content | Not the interesting part. |

See [ROADMAP.md](ROADMAP.md) for what is planned.

---

## 6. Which exercise should the app put first?

The catalog knows that two hundred exercises train the chest. It has no idea which of them
anyone should do. Left to relevance alone, searching "chest" led with *Chest Push (multiple
response)*, a medicine-ball drill, because the word happens to be in its name.

[`src/catalog/recommended.ts`](../src/catalog/recommended.ts) supplies the missing judgement:
two picks per muscle, drawn from two bodies of evidence weighted in this order.

**1. Current hypertrophy coaching consensus.** Jeff Nippard and Brad Schoenfeld's 2024 narrative
review on training technique, and Nippard's per-muscle rankings, which score an exercise on
three criteria: tension through a long muscle length, joint comfort, and how well it accepts
progressive overload. This is the primary source because it is about what grows muscle over
months rather than what registers on an electrode during one set.

**2. ACE-sponsored EMG studies** — biceps (2014), triceps, abdominals, glutes — as corroboration.
Activation during a single set is a weak proxy for growth, so these break ties rather than
settle them.

Two adjustments were made deliberately:

- **Where the sources disagreed, consensus won.** The ACE study ranks the incline curl last;
  current thinking rates the stretched long-head position highly. The incline curl is the
  second biceps pick.
- **Where a source named equipment most people do not have,** the nearest widely available
  catalog equivalent was chosen. Nippard's top chest pick is a Smith machine incline press and
  his top biceps pick a Bayesian cable curl; a recommendation you cannot perform is not one.

### How the ordering uses them

A search that names a muscle — the filter chip, or a word like "chest", "pecs" or "quads" — is
returned in three bands:

1. the two recommended exercises for that muscle, best first;
2. everything the user has actually recorded, most-recorded first;
3. everything else, by relevance.

An ordinary name search is left alone. Asking for "bench press" should return bench presses, not
a coach's opinion.

### Keeping it from becoming folklore

`RECOMMENDED_REVIEWED_FOR` must equal the version in `package.json`, and a test enforces it. A
version bump therefore fails the build until someone has revisited the picks. A date-based check
was rejected: a clock-driven test starts failing at a moment nobody chose, which teaches people
to ignore it.

### Sources for the recommendations

- [Optimizing Resistance Training Technique to Maximize Muscle Hypertrophy: A Narrative Review](https://www.mdpi.com/2411-5142/9/1/9) — Schoenfeld, Nippard et al.
- [Best Exercises for Every Muscle According to Jeff Nippard](https://www.boxrox.com/best-exercises-for-every-muscle-jeff-nippard/)
- [Jeff Nippard Uses Science to Rank the Best Glute Exercises](https://barbend.com/news/jeff-nippard-best-glute-exercises/)
- [ACE Study Reveals Best Biceps Exercises](https://www.acefitness.org/continuing-education/prosource/august-2014/4933/ace-study-reveals-best-biceps-exercises/)
- [ACE-sponsored Study: Best and Worst Abdominal Exercises](https://www.acefitness.org/about-ace/press-room/in-the-news/246/american-council-on-exercise-ace-sponsored-study-reveals-best-and-worst-abdominal-exercises/)
- [ACE Study Identifies Best Triceps Exercises](https://www.acefitness.org/certifiednewsarticle/3008/ace-study-identifies-best-triceps-exercises/)
- [ACE Lists Best Butt Exercises](https://www.acefitness.org/about-ace/press-room/press-releases/383/ace-lists-best-butt-exercises-exclusive-ace-research-announces-most-effective-gluteus-maximus-training/)
- [Triceps surae hypertrophy is greater after standing versus seated calf-raise training](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1272106/epub)
- [Forearm Training Guide: Volume, Exercises & Hypertrophy Tips — RP Strength](https://rpstrength.com/blogs/articles/forearm-hypertrophy-training-tips)
- [The Best Trap Exercises & Workouts for a Bigger Back — Barbell Medicine](https://www.barbellmedicine.com/blog/best-trap-exercises-for-a-bigger-stronger-back/)
- [The 12 Best EMG Backed Exercises For Every Muscle Group](https://www.setforset.com/blogs/news/best-emg-backed-exercises-for-every-muscle-group)

---

## Sources

- [How Fitbod Generates Your Personalized Workouts: Meet The Fitbod Algorithm](https://fitbod.me/blog/fitbod-algorithm/)
- [Fitbod's Muscle Recovery: How It Impacts Your Next Workout](https://fitbod.me/blog/muscle-recovery/)
- [Tracking Volume, Intensity, And Recovery With Fitbod](https://fitbod.me/blog/tracking-volume-intensity-and-recovery-with-fitbod/)
- [How Fitbod Creates Your Workout — Help Center](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- [Rest Timer — Help Center](https://fitbod.zendesk.com/hc/en-us/articles/360006340194-Rest-Timer)
- [Fitbod — Wikipedia](https://en.wikipedia.org/wiki/Fitbod)
