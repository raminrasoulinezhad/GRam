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

`RECOMMENDED_REVIEWED_FOR` and `RECOMMENDED_REVIEWED_ON` record when these picks were last read
through, so their age is visible to whoever reads them next.

This used to be enforced: the stamp had to match the version in `package.json` or the build
failed, which made a review the price of every feature release. That is optional as of 1.9.4.
Four consecutive releases were re-stamped within a day of one another, proving only that the
evidence could not have moved, and a check that fires faster than its subject changes gets
cleared without being read. See [RELEASING.md](RELEASING.md) for what is still enforced.

Sources are consolidated at the bottom of this document.

---

## 7. What to do when the exercise is too hard

A plan is only useful if you can perform it. Someone whose Monday says "pull-ups" and who cannot
do one has no move: the app holds 896 exercises and no opinion about which of them is a way in.
This section is why the answer is a hand-written list rather than a derived one.

### The derived version was built and measured first

The rule tried: for each exercise, find the ones sharing its primary muscle and its push/pull
direction that sit lower on the catalog's `level` field, and keep the best. Over all 879 -
the catalog as it stood when this was measured:

| Rule | Covered | Edges | Median candidates |
|---|---|---|---|
| same primary + force + mechanic + easier equipment | 262 / 352 (74%) | 3,635 | 7 |
| same primary + force + mechanic | 273 / 352 (78%) | 4,290 | 8 |
| same primary + force | 291 / 352 (83%) | 6,720 | 14 |
| same primary muscle only | 308 / 352 (88%) | 8,854 | 16 |

83% coverage reads like success. Three measurements say otherwise.

**There is no graph.** Keeping the best pick per exercise gives 291 edges and **every chain is
one step long**, because `level` has three values and the best pick always jumps straight to
beginner. No ladders to draw, no depth to walk.

**It collapses onto a handful of targets.** Those 291 edges land on **60 distinct exercises**,
and the top two absorb 66 of them: *Bodyweight Squat* is the answer for 35 different movements,
*Leverage Shoulder Press* for 31.

**`level` does not mean difficulty.** This is what settles it. The dataset labels **pull-ups,
chin-ups, dips and the barbell bench press "beginner"** — the four movements people most need a
way into — so a rule keyed on it says nothing whatever about them, while offering help with a
front squat, which it calls "expert". The field tracks how much equipment jargon is involved:
machines have zero expert entries, barbells have 29 expert and 88 intermediate.

And the pairings it does make are often wrong in a way that reads as right. *"Instead of a
deadlift, try back extensions"* and *"instead of a power clean, try a Smith machine stiff-legged
deadlift"* both satisfy every rule.

### So the list is written by hand, and every edge carries a source

[`src/catalog/regressions.ts`](../src/catalog/regressions.ts) holds one edge per exercise, each
read from a published progression and each citing it. Following `easier` repeatedly walks down a
ladder — a barbell bench press goes to dumbbells, then the floor press, then push-ups, then
incline push-ups; a clean and jerk comes apart into a power clean, a hang clean, a clean pull
and a clean deadlift. The rule for adding to it is that there is no edge without a source
someone has actually read, because a plausible guess is precisely what the derived version
produced.

It covers the head of the catalog rather than all of it, and that is the right shape: an
exercise with nothing listed shows nothing. Saying nothing costs a user far less than saying
something wrong.

---

## Sources

Exercise progressions (§7):

- [Reddit r/bodyweightfitness Recommended Routine](https://redditbwf.github.io/wiki/recommended_routine.html) — the pull-up, row, push-up, dip, squat, hinge and core ladders
- [Pull Up Progression: From Beginner To Advanced](https://fitbod.me/blog/pull-up-progression/)
- [The Squat: Progressions and/or Regressions](https://www.wg-fit.com/post/the-squat-progressions-and-or-regressions)
- [Squat Teaching Progression/Regression — NHSSCA](https://nhssca.us/wp-content/uploads/2017/10/Squat-Teaching-Progression-Regression.pdf)
- [Squat Progressions for College Athletes — EliteFTS](https://elitefts.com/blogs/training/squat-progressions-for-college-athletes)
- [Progressing from the Stick Romanian Deadlift to the Deadlift — Athletic Institute](https://athleticinstitute.com.au/progressing-from-basic-to-advance-stick-romanian-deadlift-to-the-deadlift/)
- [Romanian Deadlift (RDL) — NSCA](https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/)
- [8 Deadlift Progressions From Beginner To Advanced](https://powerliftingtechnique.com/deadlift-progressions/)
- [10 Bench Press Progressions From Beginner To Advanced](https://powerliftingtechnique.com/bench-press-progressions/)
- [Exercise progressions to work up to your first bench press — CLIENTEL3](https://www.clientel3.com/blog/2021/09/03/exercise-progressions-to-work-up-to-your-first-bench-press/)
- [Dumbbell Floor Press: Benefits, Form, and Muscle-Building Tips — Living.Fit](https://www.living.fit/blogs/news/dumbbell-floor-press-or-movement-breakdown)
- [9 Best Overhead Press Alternatives](https://powerliftingtechnique.com/overhead-press-alternatives/)
- [Snatch & Clean Hang Positions — Catalyst Athletics](https://www.catalystathletics.com/video/1573/Snatch-Clean-Hang-Positions/)

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

Added at the 1.9 review (2026-08-11):

- [Muscle hypertrophy from partial repetition at long vs. short muscle length: a systematic
  review and meta-analysis](https://pure.ulster.ac.uk/en/publications/muscle-hypertrophy-from-partial-repetition-at-long-vs-short-muscl/)
  2026. Significantly greater hypertrophy at the longer length (ES 0.283, p = 0.036), which is
  the criterion `recommended.ts` already weights above all others. Confirmed picks; moved none.
- [Hip thrust and back squat training elicit similar gluteus muscle hypertrophy](https://mennohenselmans.com/new-study-hip-thrust-and-back-squat-training-elicit-similar-gluteus-muscle-hypertrophy-and-transfer-similarly-to-the-deadlift/)
  Nine weeks, similar glute growth from both despite the hip thrust's much higher activation.
  Half of why the barbell hip thrust lost first place among the glute picks at 1.9.
- [Jeff Nippard ranks 25 glute exercises](https://generationiron.com/jeff-nippard-25-glute-exercises-best-worst/)
  The other half: barbell hip thrust in B tier, walking dumbbell lunge best overall.

Data:

- [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) — the exercise catalog, Unlicense / public domain
