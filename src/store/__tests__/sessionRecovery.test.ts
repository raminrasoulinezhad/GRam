import { countLoggedSets } from '@/analytics/volume';
import {
  completedSessions,
  lastActivityAt,
  liveSessions,
  resumableSession,
  useStore,
} from '@/store/useStore';

/**
 * Getting a workout back.
 *
 * The bug this file is the answer to: a session was recorded, the app was closed, and it looked
 * gone. It never was - every set is written to storage as it is ticked - but nothing on any
 * screen showed a workout that had not been finished, and the pointer that said which one was
 * live was a separate field that could go missing on its own. So the tests here are about two
 * different failures with the same symptom: the way back being lost, and a workout nobody ever
 * finished sitting open forever.
 *
 * Time is faked throughout, because "an earlier day" is the whole subject.
 */

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const store = () => useStore.getState();

/** Moves the wall clock, which is what decides the day a set lands on. */
function at(iso: string): void {
  jest.setSystemTime(new Date(iso).getTime());
}

/**
 * A workout started at `iso` with `logged` of its sets recorded, right then.
 * Returns its id.
 */
function workout(iso: string, logged: number, day: 'monday' | 'tuesday' = 'monday'): string {
  at(iso);
  const planId = store().createPlan(day);
  store().addPlanItem(planId, day === 'monday' ? BENCH : SQUAT);
  const id = store().startSession(planId)!;
  const entry = store().sessions.find((x) => x.id === id)!.entries[0];
  for (const set of entry.sets.slice(0, logged)) store().toggleSetLogged(id, entry.id, set.id);
  return id;
}

const find = (id: string) => store().sessions.find((x) => x.id === id);

beforeEach(() => {
  jest.useFakeTimers();
  at('2026-03-10T09:00:00');
  store().resetAll();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a workout left open on an earlier day', () => {
  it('is finished, and dated to the last set actually recorded', () => {
    const id = workout('2026-03-09T19:00:00', 2);
    const lastSetAt = lastActivityAt(find(id)!);

    at('2026-03-10T08:00:00');
    store().closeStaleSessions();

    // Not "now": you trained at seven last night, and that is when the workout ended.
    expect(find(id)!.endedAt).toBe(lastSetAt);
    expect(completedSessions(store().sessions).map((x) => x.id)).toEqual([id]);
  });

  it('keeps every recorded set and drops only the ones never recorded', () => {
    const id = workout('2026-03-09T19:00:00', 2);
    const before = countLoggedSets(find(id)!);
    const planned = find(id)!.entries[0].sets.length;
    expect(planned).toBeGreaterThan(before);

    at('2026-03-10T08:00:00');
    store().closeStaleSessions();

    expect(countLoggedSets(find(id)!)).toBe(before);
    expect(find(id)!.entries[0].sets).toHaveLength(before);
  });

  it('is dropped when nothing at all was recorded in it', () => {
    // Everything in it is a target copied off a plan, never a result. The plan still has them.
    const id = workout('2026-03-09T19:00:00', 0);

    at('2026-03-10T08:00:00');
    store().closeStaleSessions();

    expect(find(id)).toBeUndefined();
    expect(store().plans[0].items).toHaveLength(1);
  });

  it('lets go of the pointer to it', () => {
    const id = workout('2026-03-09T19:00:00', 1);
    expect(store().activeSessionId).toBe(id);

    at('2026-03-10T08:00:00');
    store().closeStaleSessions();

    expect(store().activeSessionId).toBeNull();
  });
});

describe('a workout that still belongs to today', () => {
  it('is left running', () => {
    const id = workout('2026-03-10T07:00:00', 1);

    at('2026-03-10T21:00:00');
    store().closeStaleSessions();

    expect(find(id)!.endedAt).toBeNull();
    expect(store().activeSessionId).toBe(id);
  });

  it('survives midnight if the last set was after it', () => {
    /*
     * Started at ten to midnight, still going at half past twelve. Measuring staleness from
     * startedAt would close a workout the user is in the middle of, and the sets recorded after
     * midnight would be filed under a workout that had already ended.
     */
    const id = workout('2026-03-09T23:50:00', 1);
    at('2026-03-10T00:30:00');
    const entry = find(id)!.entries[0];
    store().toggleSetLogged(id, entry.id, entry.sets[1].id);

    at('2026-03-10T09:00:00');
    store().closeStaleSessions();

    expect(find(id)!.endedAt).toBeNull();
  });

  it('is not disturbed by a launch on the same day', () => {
    const id = workout('2026-03-10T07:00:00', 1);
    const before = find(id);

    store().closeStaleSessions();

    // The same object, so nothing was rewritten and nothing was persisted for no reason.
    expect(find(id)).toBe(before);
  });
});

describe('a workout that was already finished', () => {
  it('is never touched, however old', () => {
    const id = workout('2026-01-01T10:00:00', 2);
    store().endSession(id);
    const ended = find(id)!.endedAt;

    at('2026-03-10T09:00:00');
    store().closeStaleSessions();

    expect(find(id)!.endedAt).toBe(ended);
  });
});

describe('finding the workout to resume', () => {
  it('offers the one the pointer names', () => {
    const id = workout('2026-03-10T07:00:00', 1);
    expect(resumableSession(store().sessions, store().activeSessionId)?.id).toBe(id);
  });

  it('offers a live workout even when the pointer has been lost', () => {
    /*
     * The failure that made a session look deleted. A crash between the two writes, or a backup
     * restored from a phone that was mid-workout, leaves the sets on disk and the bookmark
     * blank - and the old code read only the bookmark, so the plans screen said nothing was in
     * progress while the workout sat there intact.
     */
    const id = workout('2026-03-10T07:00:00', 2);
    useStore.setState({ activeSessionId: null });

    expect(resumableSession(store().sessions, null)?.id).toBe(id);
    expect(countLoggedSets(find(id)!)).toBe(2);
  });

  it('offers the newest when the pointer names one that is gone', () => {
    workout('2026-03-10T07:00:00', 1, 'monday');
    const newer = workout('2026-03-10T08:00:00', 1, 'tuesday');

    expect(resumableSession(store().sessions, 'no-such-session')?.id).toBe(newer);
  });

  it('offers nothing once everything is finished', () => {
    const id = workout('2026-03-10T07:00:00', 1);
    store().endSession(id);

    expect(liveSessions(store().sessions)).toEqual([]);
    expect(resumableSession(store().sessions, store().activeSessionId)).toBeNull();
  });
});

describe('when the last thing happened', () => {
  it('is the newest recorded set, not the start', () => {
    const id = workout('2026-03-10T07:00:00', 1);
    at('2026-03-10T07:45:00');
    const entry = find(id)!.entries[0];
    store().toggleSetLogged(id, entry.id, entry.sets[1].id);

    expect(lastActivityAt(find(id)!)).toBe(new Date('2026-03-10T07:45:00').getTime());
  });

  it('falls back to the start when nothing has been recorded', () => {
    const id = workout('2026-03-10T07:00:00', 0);
    expect(lastActivityAt(find(id)!)).toBe(find(id)!.startedAt);
  });
});
