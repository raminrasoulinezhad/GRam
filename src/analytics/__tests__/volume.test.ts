import { getExercise, MUSCLES } from '@/catalog';
import type { Session, SessionSet } from '@/store/types';
import {
  countLoggedSets,
  DAY_MS,
  emptyTotals,
  loggedSets,
  PRIMARY_WEIGHT,
  rankMuscles,
  recovery,
  SECONDARY_WEIGHT,
  sessionPlannedVolume,
  sessionTonnage,
  sessionVolume,
  volumeInWindow,
} from '@/analytics/volume';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const DB_BENCH = 'Dumbbell_Bench_Press';
const ONE_ARM_ROW = 'One-Arm_Dumbbell_Row';
const NOW = 1_800_000_000_000; // fixed clock so decay assertions are deterministic

let setSeq = 0;
function mkSet(loggedAt: number | null, values: Partial<SessionSet> = {}): SessionSet {
  setSeq += 1;
  return { id: `set${setSeq}`, loggedAt, ...values };
}

function mkSession(
  entries: { exerciseId: string; sets: SessionSet[] }[],
  overrides: Partial<Session> = {},
): Session {
  return {
    id: `sess${Math.random()}`,
    planId: null,
    planName: 'Test',
    startedAt: NOW,
    endedAt: NOW,
    entries: entries.map((e, i) => ({
      id: `entry${i}`,
      exerciseId: e.exerciseId,
      kind: 'weight_reps',
      restSec: 90,
      sets: e.sets,
    })),
    ...overrides,
  };
}

describe('emptyTotals', () => {
  it('covers every muscle with zero', () => {
    const totals = emptyTotals();
    expect(Object.keys(totals).sort()).toEqual([...MUSCLES].sort());
    for (const m of MUSCLES) expect(totals[m]).toBe(0);
  });
});

describe('loggedSets', () => {
  it('collects only recorded sets', () => {
    const session = mkSession([
      { exerciseId: BENCH, sets: [mkSet(NOW), mkSet(null), mkSet(NOW - 1000)] },
    ]);
    expect(loggedSets([session])).toHaveLength(2);
  });

  it('returns nothing for an empty log', () => {
    expect(loggedSets([])).toEqual([]);
  });
});

describe('volumeInWindow - effective sets', () => {
  it('credits primary muscles fully and secondary muscles at half', () => {
    const bench = getExercise(BENCH)!;
    const session = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 1000)] }]);
    const totals = volumeInWindow([session], NOW);

    for (const m of bench.primaryMuscles) expect(totals[m]).toBeCloseTo(PRIMARY_WEIGHT);
    for (const m of bench.secondaryMuscles) expect(totals[m]).toBeCloseTo(SECONDARY_WEIGHT);
  });

  it('accumulates across sets, exercises and sessions', () => {
    const a = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 1000), mkSet(NOW - 2000)] }]);
    const b = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 3000)] }]);
    expect(volumeInWindow([a, b], NOW).chest).toBeCloseTo(3);
  });

  it('ignores planned sets that were never recorded', () => {
    const session = mkSession([{ exerciseId: BENCH, sets: [mkSet(null), mkSet(null)] }]);
    expect(volumeInWindow([session], NOW).chest).toBe(0);
  });

  it('excludes sets older than the window', () => {
    const old = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 8 * DAY_MS)] }]);
    expect(volumeInWindow([old], NOW).chest).toBe(0);
  });

  it('treats the window as half-open at the far edge', () => {
    const exactly = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 7 * DAY_MS)] }]);
    const justInside = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 7 * DAY_MS + 1)] }]);
    expect(volumeInWindow([exactly], NOW).chest).toBe(0);
    expect(volumeInWindow([justInside], NOW).chest).toBeCloseTo(1);
  });

  it('ignores sets stamped in the future', () => {
    const future = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW + 60_000)] }]);
    expect(volumeInWindow([future], NOW).chest).toBe(0);
  });

  it('honours a custom window length', () => {
    const session = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW - 2 * DAY_MS)] }]);
    expect(volumeInWindow([session], NOW, 1).chest).toBe(0);
    expect(volumeInWindow([session], NOW, 3).chest).toBeCloseTo(1);
  });

  it('silently skips sets referencing an unknown exercise', () => {
    const session = mkSession([{ exerciseId: 'ghost_exercise', sets: [mkSet(NOW - 1000)] }]);
    const totals = volumeInWindow([session], NOW);
    for (const m of MUSCLES) expect(totals[m]).toBe(0);
  });

  it('separates independent muscle groups', () => {
    const session = mkSession([
      { exerciseId: BENCH, sets: [mkSet(NOW - 1000)] },
      { exerciseId: SQUAT, sets: [mkSet(NOW - 1000)] },
    ]);
    const totals = volumeInWindow([session], NOW);
    expect(totals.chest).toBeGreaterThan(0);
    expect(totals.quadriceps).toBeGreaterThan(0);
    expect(totals.neck).toBe(0);
  });
});

describe('recovery', () => {
  it('reports every muscle fully recovered with no history', () => {
    const totals = recovery([], NOW);
    for (const m of MUSCLES) expect(totals[m]).toBeCloseTo(100);
  });

  it('leaves untrained muscles at 100% even after a hard session', () => {
    const session = mkSession([
      { exerciseId: BENCH, sets: Array.from({ length: 12 }, () => mkSet(NOW - 1000)) },
    ]);
    expect(recovery([session], NOW).quadriceps).toBeCloseTo(100);
  });

  it('drives a hard-trained muscle far below 100% immediately after', () => {
    const session = mkSession([
      { exerciseId: BENCH, sets: Array.from({ length: 12 }, () => mkSet(NOW - 1000)) },
    ]);
    const chest = recovery([session], NOW).chest;
    expect(chest).toBeGreaterThan(0);
    expect(chest).toBeLessThan(20);
  });

  it('recovers monotonically as time passes', () => {
    const at = (hoursAgo: number) =>
      recovery(
        [
          mkSession([
            {
              exerciseId: BENCH,
              sets: Array.from({ length: 12 }, () => mkSet(NOW - hoursAgo * 3600_000)),
            },
          ]),
        ],
        NOW,
      ).chest;

    const curve = [0, 24, 48, 72, 96, 144].map(at);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]);
  });

  it('lands near the 48-72h trainable and ~6-day recovered heuristics', () => {
    const at = (hoursAgo: number) =>
      recovery(
        [
          mkSession([
            {
              exerciseId: BENCH,
              sets: Array.from({ length: 12 }, () => mkSet(NOW - hoursAgo * 3600_000)),
            },
          ]),
        ],
        NOW,
      ).chest;

    expect(at(48)).toBeGreaterThan(35);
    expect(at(72)).toBeGreaterThan(55);
    expect(at(144)).toBeGreaterThan(85);
    expect(at(144)).toBeLessThan(100);
  });

  it('scales fatigue with volume', () => {
    const withSets = (n: number) =>
      recovery(
        [
          mkSession([
            { exerciseId: BENCH, sets: Array.from({ length: n }, () => mkSet(NOW - 1000)) },
          ]),
        ],
        NOW,
      ).chest;
    expect(withSets(3)).toBeGreaterThan(withSets(6));
    expect(withSets(6)).toBeGreaterThan(withSets(12));
  });

  it('never returns a value outside 0-100', () => {
    const brutal = mkSession([
      { exerciseId: BENCH, sets: Array.from({ length: 200 }, () => mkSet(NOW - 1000)) },
    ]);
    for (const m of MUSCLES) {
      const v = recovery([brutal], NOW)[m];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('per-session summaries', () => {
  const session = mkSession([
    {
      exerciseId: BENCH,
      sets: [
        mkSet(NOW, { weightKg: 60, reps: 10 }),
        mkSet(NOW, { weightKg: 60, reps: 8 }),
        mkSet(null, { weightKg: 60, reps: 8 }),
      ],
    },
  ]);

  it('counts only recorded sets', () => {
    expect(countLoggedSets(session)).toBe(2);
  });

  it('sums tonnage from recorded sets only', () => {
    expect(sessionTonnage(session)).toBe(60 * 10 + 60 * 8);
  });

  it('ignores tonnage for sets missing weight or reps', () => {
    const timed = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW, { timeSec: 60 })] }]);
    expect(sessionTonnage(timed)).toBe(0);
  });

  it('counts both dumbbells, because the weight written down is one of them', () => {
    const db = mkSession([
      { exerciseId: DB_BENCH, sets: [mkSet(NOW, { weightKg: 30, reps: 10 })] },
    ]);
    // Two 30s for ten reps is 600kg moved. Counting the 30 as the whole load would halve
    // every dumbbell session in the total-lifted milestone.
    expect(sessionTonnage(db)).toBe(600);
  });

  it('counts a one-arm exercise once, since only one side is loaded', () => {
    const row = mkSession([
      { exerciseId: ONE_ARM_ROW, sets: [mkSet(NOW, { weightKg: 30, reps: 10 })] },
    ]);
    expect(sessionTonnage(row)).toBe(300);
  });

  it('still counts a barbell as the number on the bar', () => {
    const bb = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW, { weightKg: 100, reps: 5 })] }]);
    expect(sessionTonnage(bb)).toBe(500);
  });

  it('computes per-session muscle volume', () => {
    expect(sessionVolume(session).chest).toBeCloseTo(2);
  });

  it('counts every set, recorded or not, for the planned total', () => {
    // The denominator of "chest 2/3" while the workout is still running.
    expect(sessionPlannedVolume(session).chest).toBeCloseTo(3);
    expect(sessionPlannedVolume(session).triceps).toBeCloseTo(3 * SECONDARY_WEIGHT);
  });

  it('plans exactly what it counts once everything has been recorded', () => {
    const done = mkSession([{ exerciseId: BENCH, sets: [mkSet(NOW), mkSet(NOW)] }]);
    expect(sessionPlannedVolume(done)).toEqual(sessionVolume(done));
  });

  it('plans nothing for a workout with no exercises', () => {
    expect(sessionPlannedVolume(mkSession([]))).toEqual(emptyTotals());
  });

  it('ranks muscles by load, omitting untouched ones', () => {
    const ranked = rankMuscles(sessionVolume(session));
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].muscle).toBe('chest');
    for (const r of ranked) expect(r.value).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].value).toBeGreaterThanOrEqual(ranked[i].value);
    }
  });
});

describe('performance', () => {
  it('handles a year of training well inside one frame', () => {
    // 200 sessions x 5 exercises x 4 sets = 4000 logged sets.
    const sessions: Session[] = Array.from({ length: 200 }, (_, i) =>
      mkSession(
        Array.from({ length: 5 }, () => ({
          exerciseId: i % 2 === 0 ? BENCH : SQUAT,
          sets: Array.from({ length: 4 }, () => mkSet(NOW - i * DAY_MS)),
        })),
      ),
    );
    const start = Date.now();
    volumeInWindow(sessions, NOW);
    recovery(sessions, NOW);
    expect(Date.now() - start).toBeLessThan(100);
  });
});
