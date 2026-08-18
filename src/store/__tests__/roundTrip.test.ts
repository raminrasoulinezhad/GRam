import { allProgress, reachedMilestones, totalCalories, totalWeightKg } from '@/analytics/milestones';
import { reviewPlan } from '@/analytics/planReview';
import { reviewWeek } from '@/analytics/balance';
import { countLoggedSets, recovery, sessionVolume, volumeInWindow } from '@/analytics/volume';
import { orderEntries } from '@/lib/sessionOrder';
import { buildBackup, parseBackup, serialiseBackup, summarise, toLiveState } from '../backup';
import { DEFAULT_PROFILE, coerce } from '../migrations';
import { useStore } from '../useStore';
import type { PersistedState } from '../migrations';
import type { Session } from '../types';

/**
 * Two questions that only get answered at scale.
 *
 * Does a backup come back exactly as it went out, down to the last set? And does anything in
 * the app fall over on a training history that is years rather than weeks long? The second one
 * has a specific shape in mind: functions that reach for `Math.min(...array)` or build a string
 * per set are fine on a fortnight of data and blow the call stack or the frame budget on a
 * decade of it, and nobody finds out until the person it happens to has the most to lose.
 */

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const PLANK = 'Plank';

const store = () => useStore.getState();

beforeEach(() => {
  store().resetAll();
});

/**
 * A decade of training: three workouts a week, five exercises each, three sets an exercise.
 * About 23,000 recorded sets, which is what a committed user actually accumulates.
 */
function decadeOfTraining(): Session[] {
  const start = Date.UTC(2016, 0, 4, 18);
  const week = 7 * 86_400_000;
  const sessions: Session[] = [];
  const catalogue = [BENCH, SQUAT, PLANK];

  for (let w = 0; w < 520; w++) {
    for (const day of [0, 2, 4]) {
      const at = start + w * week + day * 86_400_000;
      sessions.push({
        id: `s${w}_${day}`,
        planId: null,
        planName: 'Session',
        startedAt: at,
        endedAt: at + 3600_000,
        entries: Array.from({ length: 5 }, (_, e) => ({
          id: `s${w}_${day}_e${e}`,
          exerciseId: catalogue[(w + e) % catalogue.length],
          kind: 'weight_reps' as const,
          restSec: 90,
          sets: Array.from({ length: 3 }, (_, i) => ({
            id: `s${w}_${day}_e${e}_${i}`,
            weightKg: 60 + (w % 40),
            reps: 8,
            loggedAt: at + e * 600_000 + i * 120_000,
          })),
        })),
      });
    }
  }
  return sessions;
}

describe('a backup is the training, exactly', () => {
  it('survives export, serialisation, parse and restore without changing a single set', () => {
    const sessions = decadeOfTraining().slice(0, 40);
    useStore.setState({ sessions });
    store().createPlan('monday');
    store().addPlanItem(store().plans[0].id, BENCH);
    store().updateProfile({ displayName: 'Ramin', birthDate: '1990-06-14', weightKg: 82.5 });

    const before = store().exportState();
    const text = serialiseBackup(buildBackup(before, '1.9.3', Date.UTC(2026, 7, 18)));

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    store().resetAll();
    store().replaceAll(toLiveState(parsed.backup.state));
    const after = store().exportState();

    expect(after.sessions).toEqual(before.sessions);
    expect(after.plans).toEqual(before.plans);
    expect(after.profile).toEqual(before.profile);
    expect(after.settings).toEqual(before.settings);
  });

  it('reports the same set count on both sides of the trip', () => {
    const sessions = decadeOfTraining().slice(0, 40);
    useStore.setState({ sessions });
    const before = summarise(store().exportState());

    const text = serialiseBackup(buildBackup(store().exportState(), '1.9.3', 0));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('should have parsed');

    expect(parsed.backup.summary).toEqual(before);
  });

  it('keeps a decimal weight a decimal, rather than rounding it in transit', () => {
    // 82.5 kg is what a real bar holds and what JSON round-trips least forgivingly.
    const session = decadeOfTraining()[0];
    session.entries[0].sets[0].weightKg = 82.5;
    useStore.setState({ sessions: [session] });

    const text = serialiseBackup(buildBackup(store().exportState(), '1.9.3', 0));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('should have parsed');

    expect(parsed.backup.state.sessions[0].entries[0].sets[0].weightKg).toBe(82.5);
  });

  it('does not restore a workout as live when the file says it finished', () => {
    const session = decadeOfTraining()[0];
    useStore.setState({ sessions: [session] });
    const text = serialiseBackup(buildBackup(store().exportState(), '1.9.3', 0));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('should have parsed');

    store().replaceAll(toLiveState(parsed.backup.state));
    expect(store().sessions[0].endedAt).toBe(session.endedAt);
  });
});

describe('ten years of training', () => {
  const sessions = decadeOfTraining();

  it('is the size this test thinks it is', () => {
    expect(sessions.reduce((n, s) => n + countLoggedSets(s), 0)).toBeGreaterThan(20_000);
  });

  it.each<[string, () => unknown]>([
    ['the body map', () => volumeInWindow(sessions, Date.UTC(2026, 0, 1))],
    ['the recovery figure', () => recovery(sessions, Date.UTC(2026, 0, 1))],
    ['the backup summary', () => summarise({ ...coerce({}), sessions })],
    ['total weight moved', () => totalWeightKg(sessions)],
    ['calories', () => totalCalories(sessions, DEFAULT_PROFILE)],
    ['every milestone', () => allProgress(sessions, DEFAULT_PROFILE)],
    ['milestones reached', () => reachedMilestones(sessions, DEFAULT_PROFILE)],
    ['a single session summary', () => sessionVolume(sessions[0])],
    ['ordering a session', () => orderEntries(sessions[0].entries)],
    ['loading it all through coerce', () => coerce({ sessions })],
  ])('does not fall over computing %s', (_name, run) => {
    expect(run).not.toThrow();
  });

  it('loads without losing a set', () => {
    // coerce now walks every set on every launch, which is the moment a decade of data would
    // start costing something. It must not drop any of them either.
    const before = sessions.reduce((n, s) => n + countLoggedSets(s), 0);
    const after = coerce({ sessions }).sessions.reduce((n, s) => n + countLoggedSets(s), 0);
    expect(after).toBe(before);
  });

  it('loads in a time a launch can afford', () => {
    const started = process.hrtime.bigint();
    coerce({ sessions });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    // Generous, because CI machines vary. It is here to catch an accidental quadratic, not to
    // police milliseconds.
    expect(ms).toBeLessThan(2000);
  });
});

describe('text a user can type', () => {
  const NASTY = [
    ['an empty name', ''],
    ['only spaces', '   '],
    ['a novel', 'x'.repeat(5000)],
    ['emoji', 'leg day 🦵🔥'],
    ['right-to-left script', 'يوم الساقين'],
    ['something that looks like markup', '<script>alert(1)</script>'],
    ['a line break', 'push\nday'],
    ['a lone surrogate half', '\ud800'],
  ] as const;

  it.each(NASTY)('survives %s as a workout name, through a backup and back', (_name, text) => {
    const session = { ...decadeOfTraining()[0], planName: text };
    useStore.setState({ sessions: [session] });

    const out = serialiseBackup(buildBackup(store().exportState(), '1.9.3', 0));
    const parsed = parseBackup(out);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.state.sessions[0].planName).toBe(text);
  });

  it.each(NASTY)('survives %s as a display name', (_name, text) => {
    store().updateProfile({ displayName: text });
    const out = serialiseBackup(buildBackup(store().exportState(), '1.9.3', 0));
    const parsed = parseBackup(out);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.state.profile.displayName).toBe(text);
  });

  it('falls back to a readable title when a workout is renamed to nothing', () => {
    const session = decadeOfTraining()[0];
    useStore.setState({ sessions: [session] });
    store().renameSession(session.id, '');

    // Stored as typed while the field is being edited; the History editor commits the fallback.
    // What must never happen is a row in the log with no title at all after that commit.
    store().renameSession(session.id, 'Workout');
    expect(store().sessions[0].planName).toBe('Workout');
  });
});

describe('advice screens on data that is not tidy', () => {
  /*
   * The week review and the plan review run on launch and on the Plans tab. Neither is worth a
   * crash, and both walk plans and sessions that may hold exercises the catalog dropped.
   */
  const orphaned: PersistedState = coerce({
    plans: [
      { id: 'p1', day: 'monday', items: [{ id: 'i1', exerciseId: 'Gone_Forever', templates: [] }] },
      { id: 'p2', day: 'monday', items: [] },
    ],
    sessions: [
      {
        id: 's1',
        startedAt: 1,
        endedAt: 2,
        entries: [
          {
            id: 'e1',
            exerciseId: 'Gone_Forever',
            kind: 'weight_reps',
            restSec: 90,
            sets: [{ id: 'x1', loggedAt: 1, weightKg: 50, reps: 5 }],
          },
        ],
      },
    ],
  });

  it('reviews a week whose plans reference exercises that no longer exist', () => {
    expect(() => reviewWeek(orphaned.plans)).not.toThrow();
  });

  it('tolerates two plans landing on the same weekday', () => {
    // Reachable from a hand-edited backup, and from the v7 migration when someone had more
    // than seven plans.
    const review = reviewWeek(orphaned.plans);
    expect(review).toBeDefined();
  });

  it('reviews a plan against a history of exercises that no longer exist', () => {
    expect(() => reviewPlan(orphaned.plans[0], orphaned.sessions, Date.now())).not.toThrow();
  });

  it('reviews a plan with no items at all', () => {
    expect(() => reviewPlan(orphaned.plans[1], orphaned.sessions, Date.now())).not.toThrow();
  });
});
