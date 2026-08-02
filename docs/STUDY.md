# Study: the training model behind GRam

Why GRam counts what it counts, and where the numbers come from. Sources at the bottom of
each section. This is an independent personal project; nothing here is taken from any
commercial fitness app.

---

## 1. The idea worth building

A set logger is not interesting on its own — there are hundreds of those. What makes a training
app worth opening is closing a loop:

> log what you did → infer which muscles are fatigued and which are neglected → say what you
> should do next

Everything distinctive in GRam falls out of that loop. The body heatmap is the loop made
visible. The week review on the Plans tab is the loop made actionable before you get to the
gym rather than after. A tracker that only records sets has built the first arrow and stopped.

---

## 2. Counting volume: effective sets, not tonnage

**Each recorded set contributes 1.0 to every muscle the exercise targets and 0.5 to every
muscle it assists.**

Tonnage — weight × reps — is the obvious alternative and it does not work. It cannot compare
100 kg × 5 against a 60-second plank. It flatters whichever lifts move the most absolute
weight, so a deadlift dwarfs a lateral raise no matter what the training stimulus was. And it
says nothing at all about a bodyweight or timed movement.

Counting sets fixes all three. It is also the unit the hypertrophy literature already uses:
the familiar guidance is 10–20 hard sets per muscle per week, and meta-analyses of training
volume are expressed in sets, not kilograms. Half credit for assistance work is a judgement
call rather than a measured constant — bench press does train the triceps, just not as much as
a triceps extension does — but it puts every exercise in the catalog on one scale whether it
is measured in reps, seconds or metres.

Implemented in [`src/analytics/volume.ts`](../src/analytics/volume.ts).

### One consequence worth knowing about

Nine entries in the upstream dataset list the same muscle as both primary and secondary. Left
alone, one set of those would credit the muscle 1.0 + 0.5 = 1.5 effective sets and quietly
inflate the heatmap. Primary wins; the fix is in `scripts/build-catalog.mjs` so the data is
clean before it reaches the app.

---

## 3. Modelling recovery

Fatigue from each recorded set decays exponentially with a 48-hour time constant. Recovery is
the exponential complement of accumulated fatigue, saturating around 6 effective sets. For a
hard 12-set session:

| Time since | Recovered |
|---|---|
| immediately | ~14% |
| 48 h | ~47% |
| 72 h | ~64% |
| 6 days | ~90% |

Those numbers were chosen to land on the two heuristics the literature keeps returning to:
trained muscle needs roughly **48–72 hours** before it can be worked hard again, and is
effectively fully recovered after about **six days**. A curve that reproduces both without any
per-user model or training data is good enough for a personal app, and it has the large
advantage of being a pure function of the session log — no state, no drift, unit-testable
without rendering anything.

### Two views, not one

The Body tab defaults to **this week's volume** — "which muscles have I actually hit" — rather
than to freshness. That is the question someone planning a week actually asks. Recovery is a
toggle away, and both are derived from the same contributions.

---

## 4. Defining a balanced week

The volume and recovery models describe what has happened. The week review on the Plans tab
describes what is *planned*, and it needs a definition of "balanced" concrete enough to act on.

**Eight groups must be trained at least twice a week, on different days, as the primary muscle
of an exercise:** chest, shoulders, triceps, back, biceps, glutes, hamstrings, quadriceps.

Three deliberate narrowings, each of which makes the advice more useful by making it say less:

- **Only those eight.** Forearms, calves, abs and the rest get plenty of assistance work, and
  flagging them would bury the advice that matters under advice that does not.
- **Only primary muscles.** Bench press assists the triceps. A week whose only triceps work is
  bench press is not a week that trains triceps, and counting it would say otherwise.
- **Different days.** Two chest exercises in one plan is one session's worth of stimulus. The
  frequency is the point — twice-weekly frequency per muscle is one of the better-supported
  findings in the hypertrophy literature — not the exercise count.

Plans carry no day-of-week, so "different days" is read as "different plans". That is how
people write them — Push, Pull, Legs is three days — and it needs no new state and no
assumption about which weekday anything falls on.

Implemented in [`src/analytics/balance.ts`](../src/analytics/balance.ts).

---

## 5. Deliberately not built

| | Why |
|---|---|
| ML-ranked exercise selection | Needs a corpus of logged workouts that a personal app does not have. A rules-based ranker gets most of the value. |
| Cold-start weight suggestions from other users' data | Same reason, and it would mean collecting other users' data. The user enters a starting weight. |
| Health app sync | Needs native modules that cannot run in Expo Go. See [ROADMAP.md](ROADMAP.md). |
| Supersets and circuits | Scope. |
| Social features, coaching content | Not the interesting part. |

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

Sources are consolidated at the bottom of this document.

---

## Sources

Training science:

- [Optimizing Resistance Training Technique to Maximize Muscle Hypertrophy: A Narrative Review](https://www.mdpi.com/2411-5142/9/1/9) — Schoenfeld, Nippard et al., 2024
- [Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1272106/epub)
- [Best Exercises for Every Muscle According to Jeff Nippard](https://www.boxrox.com/best-exercises-for-every-muscle-jeff-nippard/)
- [Jeff Nippard Uses Science to Rank the Best Glute Exercises](https://barbend.com/news/jeff-nippard-best-glute-exercises/)
- [ACE Study Reveals Best Biceps Exercises](https://www.acefitness.org/continuing-education/prosource/august-2014/4933/ace-study-reveals-best-biceps-exercises/)
- [ACE-sponsored Study: Best and Worst Abdominal Exercises](https://www.acefitness.org/about-ace/press-room/in-the-news/246/american-council-on-exercise-ace-sponsored-study-reveals-best-and-worst-abdominal-exercises/)
- [ACE Study Identifies Best Triceps Exercises](https://www.acefitness.org/certifiednewsarticle/3008/ace-study-identifies-best-triceps-exercises/)
- [ACE Lists Best Butt Exercises](https://www.acefitness.org/about-ace/press-room/press-releases/383/ace-lists-best-butt-exercises-exclusive-ace-research-announces-most-effective-gluteus-maximus-training/)
- [Forearm Training Guide: Volume, Exercises & Hypertrophy Tips — RP Strength](https://rpstrength.com/blogs/articles/forearm-hypertrophy-training-tips)
- [The Best Trap Exercises & Workouts for a Bigger Back — Barbell Medicine](https://www.barbellmedicine.com/blog/best-trap-exercises-for-a-bigger-stronger-back/)
- [The 12 Best EMG Backed Exercises For Every Muscle Group](https://www.setforset.com/blogs/news/best-emg-backed-exercises-for-every-muscle-group)

Data:

- [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) — the exercise catalog, Unlicense / public domain
