import { getExercise } from '@/catalog';
import { countLoggedSets, recovery, sessionTonnage, volumeInWindow } from '@/analytics/volume';
import { toDisplayWeight } from '@/lib/format';
import { WEIGHT_WHEELS } from '@/ui/SetFields';
import { coerce } from '../migrations';
import { parseBackup, summarise, toLiveState } from '../backup';
import {
  completedSessions,
  exerciseHistory,
  liveSessions,
  resumableSession,
  setCountsByExercise,
  useStore,
} from '../useStore';
import type { PersistedState } from '../migrations';
import type { Session } from '../types';

/**
 * Things a user can actually do to this app that no happy path covers.
 *
 * The app is on other people's phones now, which changes what a test is for. The suites beside
 * this one check that each feature does what it is supposed to. This one assumes the features
 * work and goes looking for the states you can only reach by being interrupted, by tapping
 * twice, by leaving the app open over midnight, or by feeding it a file that is not quite what
 * it expects.
 *
 * The bar is not "does it look right". It is: can any sequence of legal actions lose a set that
 * was recorded, or leave a screen unable to render.
 */

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';

const store = () => useStore.getState();

beforeEach(() => {
  store().resetAll();
});

/** A finished workout with `count` recorded sets of one exercise, at a given time. */
function pastWorkout(exerciseId: string, at: number, count = 3): Session {
  return {
    id: `s_${at}`,
    planId: null,
    planName: 'Test',
    startedAt: at,
    endedAt: at + 3600_000,
    entries: [
      {
        id: `e_${at}`,
        exerciseId,
        kind: 'weight_reps',
        restSec: 90,
        sets: Array.from({ length: count }, (_, i) => ({
          id: `x_${at}_${i}`,
          weightKg: 60,
          reps: 8,
          loggedAt: at + i * 60_000,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------

describe('two workouts at once', () => {
  /*
   * Reachable without doing anything strange: start Monday, get interrupted, close the app,
   * come back the same day and tap Tuesday because the plans screen is what you landed on.
   * Nothing in the store refuses it.
   */
  it('does not strand the first workout when a second is started', () => {
    const first = store().createPlan('monday');
    const second = store().createPlan('tuesday');
    store().addPlanItem(first, BENCH);
    store().addPlanItem(second, SQUAT);

    const a = store().startSession(first)!;
    const entryA = store().sessions.find((x) => x.id === a)!.entries[0];
    store().toggleSetLogged(a, entryA.id, entryA.sets[0].id);

    const b = store().startSession(second)!;

    // Whatever the app decides to do about the second one, the first one's recorded set has to
    // still exist and still be findable. Losing it is the one unacceptable outcome.
    const kept = store().sessions.find((x) => x.id === a);
    expect(kept).toBeDefined();
    expect(countLoggedSets(kept!)).toBe(1);
    expect(resumableSession(store().sessions, store().activeSessionId)).not.toBeNull();
    expect(b).not.toBe(a);
  });

  it('never leaves the user with no way back to a workout holding recorded sets', () => {
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    const a = store().startSession(plan)!;
    const entry = store().sessions.find((x) => x.id === a)!.entries[0];
    store().toggleSetLogged(a, entry.id, entry.sets[0].id);

    store().startEmptySession();

    // Every live session with work in it must be reachable, either as the resumable one or in
    // the History list, which is the only other place they surface.
    const live = liveSessions(store().sessions).filter((x) => countLoggedSets(x) > 0);
    expect(live.map((x) => x.id)).toContain(a);
  });
});

describe('un-recording a set in a finished workout', () => {
  /*
   * The history editor shows recorded sets and lets you correct them. Tapping the tick is how
   * you fix a set you logged by accident. The set then has loggedAt null inside a session that
   * has already ended, which is a shape nothing else in the app produces.
   */
  it('does not leave a set that is invisible everywhere but still stored', () => {
    const at = Date.UTC(2026, 0, 5, 10);
    useStore.setState({ sessions: [pastWorkout(BENCH, at, 2)] });
    const session = store().sessions[0];
    const entry = session.entries[0];

    store().toggleSetLogged(session.id, entry.id, entry.sets[0].id);
    store().tidySession(session.id);

    const after = store().sessions[0];
    const stored = after.entries.reduce((n, e) => n + e.sets.length, 0);
    // Either the un-recorded set is gone, or it is still there and will reappear as a real set
    // the next time anyone looks. It cannot be a row that counts for nothing yet occupies the
    // history editor forever.
    expect(stored).toBe(countLoggedSets(after));
  });

  it('drops an exercise whose every set was un-recorded', () => {
    const at = Date.UTC(2026, 0, 5, 10);
    useStore.setState({ sessions: [pastWorkout(BENCH, at, 2)] });
    const session = store().sessions[0];
    const entry = session.entries[0];

    for (const set of entry.sets) store().toggleSetLogged(session.id, entry.id, set.id);
    store().tidySession(session.id);

    expect(store().sessions[0].entries).toHaveLength(0);
  });
});

describe('a workout that recorded nothing', () => {
  it('does not land in the log as an empty row', () => {
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    const id = store().startSession(plan)!;

    store().endSession(id);

    // endSession strips unrecorded sets, so this session has no entries at all. A row in
    // History reading "0 sets" for a workout nobody did is noise in the one list that is
    // supposed to be a record of training.
    expect(completedSessions(store().sessions)).toHaveLength(0);
  });
});

describe('a plan deleted while its workout is running', () => {
  it('leaves the workout intact and finishable', () => {
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    const id = store().startSession(plan)!;
    const entry = store().sessions[0].entries[0];
    store().toggleSetLogged(id, entry.id, entry.sets[0].id);

    store().deletePlan(plan);

    expect(countLoggedSets(store().sessions[0])).toBe(1);
    store().endSession(id);
    expect(completedSessions(store().sessions)).toHaveLength(1);
    expect(store().activeSessionId).toBeNull();
  });
});

describe('moving a workout to another date', () => {
  it('keeps the sets in the same order and the same length apart', () => {
    const at = Date.UTC(2026, 0, 5, 10);
    useStore.setState({ sessions: [pastWorkout(BENCH, at, 3)] });
    const before = store().sessions[0];
    const gaps = before.entries[0].sets.map((x) => (x.loggedAt as number) - before.startedAt);

    store().setSessionStart(before.id, Date.UTC(2025, 11, 25, 8));

    const after = store().sessions[0];
    expect(after.entries[0].sets.map((x) => (x.loggedAt as number) - after.startedAt)).toEqual(gaps);
    expect((after.endedAt as number) - after.startedAt).toBe(
      (before.endedAt as number) - before.startedAt,
    );
  });

  it('never ends a workout before it started', () => {
    const at = Date.UTC(2026, 0, 5, 10);
    useStore.setState({ sessions: [pastWorkout(BENCH, at, 1)] });
    const id = store().sessions[0].id;

    store().setSessionDuration(id, -9999);

    const after = store().sessions[0];
    expect(after.endedAt as number).toBeGreaterThanOrEqual(after.startedAt);
  });
});

describe('data that did not come from this app', () => {
  /*
   * Three routes in: a hand-edited backup, a file truncated by a failed transfer, and a blob
   * copied out of browser storage by someone rescuing an app that would not open. All three
   * reach coerce(), which is the last thing standing between them and a screen that renders.
   */
  const CASES: [string, unknown][] = [
    ['a session that is not an object', 'nonsense'],
    ['a session with no entries array', { id: 's1', startedAt: 1, endedAt: 2 }],
    ['a session whose entries is a string', { id: 's1', startedAt: 1, endedAt: 2, entries: 'x' }],
    [
      'an entry with no sets array',
      { id: 's1', startedAt: 1, endedAt: 2, entries: [{ id: 'e1', exerciseId: BENCH }] },
    ],
    [
      'a set that is not an object',
      {
        id: 's1',
        startedAt: 1,
        endedAt: 2,
        entries: [{ id: 'e1', exerciseId: BENCH, kind: 'weight_reps', restSec: 90, sets: [null] }],
      },
    ],
    ['null in the sessions list', null],
  ];

  it.each(CASES)('survives %s', (_name, session) => {
    const state = coerce({ sessions: [session] });
    // The screens that read every session on launch. Any of these throwing is a white screen
    // on open with no way back short of clearing storage.
    expect(() => completedSessions(state.sessions)).not.toThrow();
    expect(() => liveSessions(state.sessions)).not.toThrow();
    expect(() => state.sessions.map(countLoggedSets)).not.toThrow();
    expect(() => volumeInWindow(state.sessions, Date.now())).not.toThrow();
    expect(() => recovery(state.sessions, Date.now())).not.toThrow();
    expect(() => summarise(state)).not.toThrow();
    expect(() => setCountsByExercise(state.sessions)).not.toThrow();
    expect(() => exerciseHistory(state.sessions, BENCH)).not.toThrow();
    expect(() => state.sessions.map(sessionTonnage)).not.toThrow();
  });

  it('survives a plan with no items array', () => {
    const state = coerce({ plans: [{ id: 'p1', day: 'monday' }] });
    expect(() => summarise(state)).not.toThrow();
  });

  it('keeps the good rows when one row is rotten', () => {
    // The whole reason coerce is permissive: one bad session must not cost the other three
    // hundred. Whatever it does with the bad one, the good one has to come through.
    const good = pastWorkout(BENCH, Date.UTC(2026, 0, 5, 10), 3);
    const state = coerce({ sessions: [null, good, 'rubbish'] });
    const survivor = state.sessions.find((x) => x?.id === good.id);
    expect(survivor).toBeDefined();
    expect(countLoggedSets(survivor!)).toBe(3);
  });
});

describe('numbers that are not numbers', () => {
  /*
   * NaN and Infinity survive a JSON round trip as null, but a hand-edited file, a spreadsheet
   * export or a buggy third-party tool can put a string or a huge value in. One NaN in a set
   * poisons every total it touches, and a NaN in the body map paints nothing while reporting
   * no error.
   */
  it('does not let a rotten weight poison the tonnage of a whole workout', () => {
    const at = Date.UTC(2026, 0, 5, 10);
    const session = pastWorkout(BENCH, at, 2);
    (session.entries[0].sets[0] as { weightKg: unknown }).weightKg = 'heavy';
    const state = coerce({ sessions: [session] });

    expect(Number.isFinite(sessionTonnage(state.sessions[0]))).toBe(true);
  });

  it('keeps the body map finite when a set has an impossible timestamp', () => {
    const session = pastWorkout(BENCH, Date.UTC(2026, 0, 5, 10), 1);
    (session.entries[0].sets[0] as { loggedAt: unknown }).loggedAt = Number.NaN;
    const state = coerce({ sessions: [session] });

    const totals = recovery(state.sessions, Date.now());
    for (const value of Object.values(totals)) expect(Number.isFinite(value)).toBe(true);
  });
});

describe('an exercise the catalog no longer has', () => {
  /*
   * The catalog is regenerated by a build script. An id that goes away takes every logged set
   * of it with it, as far as the UI is concerned. Nothing may crash, and nothing may silently
   * delete the history.
   */
  it('keeps the sets and counts nothing for them', () => {
    const at = Date.UTC(2026, 0, 5, 10);
    const session = pastWorkout('No_Such_Exercise_Anywhere', at, 3);
    useStore.setState({ sessions: [session] });

    expect(getExercise('No_Such_Exercise_Anywhere')).toBeUndefined();
    expect(countLoggedSets(store().sessions[0])).toBe(3);
    expect(() => volumeInWindow(store().sessions, at + 1000)).not.toThrow();
    expect(() => sessionTonnage(store().sessions[0])).not.toThrow();
  });
});

describe('importing over a live workout', () => {
  it('does not leave a pointer at a workout the file never had', () => {
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    store().startSession(plan);
    expect(store().activeSessionId).not.toBeNull();

    const incoming: PersistedState = coerce({
      sessions: [pastWorkout(SQUAT, Date.UTC(2026, 0, 1, 9), 2)],
    });
    store().replaceAll(toLiveState(incoming));

    expect(store().activeSessionId).toBeNull();
    expect(resumableSession(store().sessions, store().activeSessionId)).toBeNull();
  });

  it('hands back a workout that was live in the file, pointer or not', () => {
    const live: Session = {
      ...pastWorkout(BENCH, Date.UTC(2026, 0, 5, 10), 2),
      endedAt: null,
    };
    const incoming = coerce({ sessions: [live], activeSessionId: 'a-pointer-that-is-wrong' });
    store().replaceAll(toLiveState(incoming));

    // The pointer is dropped because it names nothing, but the workout is still running and
    // must not vanish from the app just because its bookmark did.
    expect(store().activeSessionId).toBeNull();
    expect(resumableSession(store().sessions, null)?.id).toBe(live.id);
  });
});

describe('a backup file that is nearly right', () => {
  it.each([
    ['an empty object', '{}'],
    ['an array', '[]'],
    ['a bare number', '42'],
    ['the word null', 'null'],
    ['a truncated file', '{"format":1,"app":"GRam","state":{"plans":[],"sessi'],
  ])('refuses %s rather than wiping the user', (_name, text) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
  });

  it('accepts a file whose sessions are there but whose plans are missing', () => {
    // Half a backup is still most of someone's training. Refusing it because one key is absent
    // would be the app choosing nothing over something.
    const text = JSON.stringify({ sessions: [pastWorkout(BENCH, Date.UTC(2026, 0, 5, 10), 2)] });
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.summary.loggedSets).toBe(2);
  });
});

describe('the clocks changing', () => {
  /*
   * Two spring-forward mornings, one in each hemisphere. Both are dates where subtracting
   * 24-hour blocks lands an hour off midnight, which is how a set logged at 00:30 disappears
   * from a week that should contain it.
   */
  it.each([
    ['Europe, late March', new Date(2026, 2, 29, 12)],
    ['North America, mid March', new Date(2026, 2, 8, 12)],
  ])('counts a set logged just after midnight, %s', (_name, noon) => {
    const justAfterMidnight = new Date(noon);
    justAfterMidnight.setHours(0, 30, 0, 0);

    const session = pastWorkout(BENCH, justAfterMidnight.getTime(), 1);
    const totals = volumeInWindow([session], noon.getTime());

    const chest = getExercise(BENCH)!.primaryMuscles[0];
    expect(totals[chest]).toBeGreaterThan(0);
  });
});

describe('recording the same set twice in a hurry', () => {
  it('is a toggle, not a counter', () => {
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    const id = store().startSession(plan)!;
    const entry = store().sessions[0].entries[0];
    const setId = entry.sets[0].id;

    store().toggleSetLogged(id, entry.id, setId);
    store().toggleSetLogged(id, entry.id, setId);
    store().toggleSetLogged(id, entry.id, setId);

    expect(countLoggedSets(store().sessions[0])).toBe(1);
    expect(store().sessions[0].entries[0].sets).toHaveLength(entry.sets.length);
  });
});

describe('actions aimed at things that are not there', () => {
  /*
   * A stale screen is the ordinary way this happens: two tabs open on the web build, or a
   * back-navigation into a workout that was finished from somewhere else. Every one of these
   * must be a no-op, not a throw and not a write of a half-formed row.
   */
  it.each<[string, () => void]>([
    ['a set in a session that does not exist', () => store().updateSet('nope', 'nope', 'nope', { reps: 5 })],
    ['logging a set that does not exist', () => store().toggleSetLogged('nope', 'nope', 'nope')],
    ['ending a session that does not exist', () => store().endSession('nope')],
    ['adding a set to nothing', () => store().addSet('nope', 'nope')],
    ['removing a set from nothing', () => store().removeSet('nope', 'nope', 'nope')],
    ['adding an exercise to no session', () => store().addSessionExercise('nope', BENCH)],
    ['adding an exercise that does not exist', () => store().addSessionExercise('nope', 'ghost')],
    ['an item on a plan that is gone', () => store().addPlanItem('nope', BENCH)],
    ['moving a plan that is gone', () => store().setPlanDay('nope', 'friday')],
    ['renaming a session that is gone', () => store().renameSession('nope', 'x')],
    ['redating a session that is gone', () => store().setSessionStart('nope', 0)],
    ['tidying a session that is gone', () => store().tidySession('nope')],
    ['swapping in a session that is gone', () => store().swapSessionExercise('nope', 'nope', BENCH)],
  ])('%s does nothing at all', (_name, act) => {
    const before = JSON.stringify(store().exportState());
    expect(act).not.toThrow();
    expect(JSON.stringify(store().exportState())).toBe(before);
  });
});

describe('the weight a new exercise starts on', () => {
  /*
   * The first number a new user ever sees. Stored in kilograms like everything else, but the
   * round number it is chosen to be depends on the unit on screen: a flat 20 kg reads as
   * "44.1 lb" to everyone on pounds, which is this app's default unit, is not a weight any gym
   * produces, and is not even a row on the pound wheel.
   */
  function firstSeed(unit: 'kg' | 'lb'): number {
    store().updateSettings({ unit });
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    return store().plans[0].items[0].templates[0].weightKg!;
  }

  it('is a round 20 kg for someone using kilograms', () => {
    expect(toDisplayWeight(firstSeed('kg'), 'kg')).toBe(20);
  });

  it('is a round 45 lb, the bar, for someone using pounds', () => {
    expect(Math.round(toDisplayWeight(firstSeed('lb'), 'lb'))).toBe(45);
  });

  it('lands on a row the wheel actually offers, in both units', () => {
    // Otherwise opening the wheel and pressing Done without touching it silently changes the
    // number, which is the worst kind of change: invisible and unasked for.
    for (const unit of ['kg', 'lb'] as const) {
      const shown = Math.round(toDisplayWeight(firstSeed(unit), unit) * 10) / 10;
      expect(WEIGHT_WHEELS[unit]).toContain(shown);
      store().resetAll();
    }
  });
});

describe('erasing everything', () => {
  it('leaves nothing behind in the live state', () => {
    const plan = store().createPlan('monday');
    store().addPlanItem(plan, BENCH);
    const id = store().startSession(plan)!;
    const entry = store().sessions[0].entries[0];
    store().toggleSetLogged(id, entry.id, entry.sets[0].id);
    store().updateProfile({ displayName: 'Ramin', birthDate: '1990-01-01', weightKg: 80 });

    store().resetAll();

    const after = store().exportState();
    expect(after.sessions).toHaveLength(0);
    expect(after.plans).toHaveLength(0);
    expect(after.profile.displayName).toBe('');
    expect(after.profile.birthDate).toBeNull();
    expect(after.profile.weightKg).toBeNull();
    expect(after.activeSessionId).toBeNull();
  });
});
