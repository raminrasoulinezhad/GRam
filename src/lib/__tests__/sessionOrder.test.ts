import { BAND, band, compareEntries, enteredBandAt, orderEntries } from '@/lib/sessionOrder';
import type { SessionEntry, SessionSet } from '@/store/types';

/**
 * An entry whose sets are described by their logged-at stamps: a number means recorded then,
 * null means still planned.
 */
function entry(id: string, ...loggedAt: (number | null)[]): SessionEntry {
  return {
    id,
    exerciseId: `Ex_${id}`,
    kind: 'weight_reps',
    restSec: 90,
    sets: loggedAt.map(
      (at, i): SessionSet => ({ id: `${id}-${i}`, weightKg: 60, reps: 5, loggedAt: at }),
    ),
  };
}

const ids = (entries: readonly SessionEntry[]) => entries.map((e) => e.id);

describe('band', () => {
  it('puts an untouched exercise last', () => {
    expect(band(entry('a', null, null))).toBe(BAND.untouched);
  });

  it('puts a part-recorded exercise in the middle', () => {
    expect(band(entry('a', 100, null))).toBe(BAND.started);
  });

  it('puts a fully recorded exercise first', () => {
    expect(band(entry('a', 100, 200))).toBe(BAND.done);
  });

  it('treats an exercise with no sets at all as untouched', () => {
    // Every set can be deleted from an entry, and the empty entry must not read as "done" -
    // 0 === 0 would say complete, which would float an exercise nobody trained to the top.
    expect(band(entry('a'))).toBe(BAND.untouched);
  });
});

describe('enteredBandAt', () => {
  it('dates a finished exercise by its last set, which is when it finished', () => {
    expect(enteredBandAt(entry('a', 100, 500, 300))).toBe(500);
  });

  it('dates an exercise under way by its first set, which is when it started', () => {
    expect(enteredBandAt(entry('a', 500, 100, null))).toBe(100);
  });

  it('gives an untouched exercise no date at all', () => {
    expect(enteredBandAt(entry('a', null, null))).toBe(0);
  });
});

describe('orderEntries', () => {
  it('sorts into finished, under way, then untouched', () => {
    const out = orderEntries([
      entry('untouched', null, null),
      entry('started', 100, null),
      entry('done', 50, 60),
    ]);
    expect(ids(out)).toEqual(['done', 'started', 'untouched']);
  });

  it('places the exercise you just finished at the bottom of the finished ones', () => {
    // The order finished in: first, then second, then third. Reading down the finished band
    // should replay that, so the newest sits closest to the work still to do.
    const out = orderEntries([
      entry('third', 300, 310),
      entry('first', 100, 110),
      entry('second', 200, 210),
    ]);
    expect(ids(out)).toEqual(['first', 'second', 'third']);
  });

  it('places the exercise you just started at the bottom of the ones under way', () => {
    const out = orderEntries([
      entry('startedLater', 300, null),
      entry('startedFirst', 100, null),
    ]);
    expect(ids(out)).toEqual(['startedFirst', 'startedLater']);
  });

  it('keeps the plan order among exercises nobody has touched', () => {
    const out = orderEntries([entry('a', null), entry('b', null), entry('c', null)]);
    expect(ids(out)).toEqual(['a', 'b', 'c']);
  });

  it('holds an exercise still while you work through it', () => {
    // The whole reason a started exercise is dated by its FIRST set. Recording a second set in
    // `working` must not move it below `startedLater`, which started after it - the row you are
    // typing in should not slide out from under you.
    const before = [entry('working', 100, null, null), entry('startedLater', 200, null)];
    const after = [entry('working', 100, 400, null), entry('startedLater', 200, null)];
    expect(ids(orderEntries(before))).toEqual(['working', 'startedLater']);
    expect(ids(orderEntries(after))).toEqual(['working', 'startedLater']);
  });

  it('moves an exercise up as it crosses from untouched to under way to finished', () => {
    const others = [entry('doneEarlier', 10, 20), entry('startedEarlier', 30, null)];
    const at = (e: SessionEntry) => ids(orderEntries([...others, e])).indexOf('subject');

    const untouched = at(entry('subject', null, null));
    const started = at(entry('subject', 100, null));
    const finished = at(entry('subject', 100, 200));

    expect(untouched).toBe(2);
    // Under way, it goes below the one already under way; finished, above both of those.
    expect(started).toBe(2);
    expect(finished).toBe(1);
    expect(finished).toBeLessThan(untouched);
  });

  it('sends an exercise back down when its last set is un-recorded', () => {
    // Un-ticking is a real action, and the ordering has to survive going backwards.
    const done = entry('subject', 100, 200);
    const reopened = entry('subject', 100, null);
    const others = [entry('other', 50, null)];
    expect(ids(orderEntries([...others, done]))).toEqual(['subject', 'other']);
    expect(ids(orderEntries([...others, reopened]))).toEqual(['other', 'subject']);
  });

  it('does not mutate what it was given', () => {
    const input = [entry('b', 500, 600), entry('a', null)];
    orderEntries(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });

  it('compares equal for two untouched entries, so a stable sort keeps their order', () => {
    expect(compareEntries(entry('a', null), entry('b', null))).toBe(0);
  });
});
