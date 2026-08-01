import { volumeInWindow } from '@/analytics/volume';
import { exerciseHistory, useStore } from '@/store/useStore';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const PLANK = 'Plank';

const store = () => useStore.getState();

beforeEach(() => {
  store().resetAll();
});

// ---------------------------------------------------------------------- plans

describe('plans', () => {
  it('creates a plan and puts it at the top of the list', () => {
    let first = '';
    first = store().createPlan('Push day');
    store().createPlan('Pull day');
    expect(store().plans.map((p) => p.name)).toEqual(['Pull day', 'Push day']);
    expect(store().plans.find((p) => p.id === first)?.items).toEqual([]);
  });

  it('falls back to a placeholder name rather than creating a blank plan', () => {
    store().createPlan('   ');
    expect(store().plans[0].name).toBe('Untitled plan');
  });

  it('adds an exercise with the default number of seeded sets', () => {
    let id = '';
    id = store().createPlan('Push');
    store().addPlanItem(id, BENCH);
    const item = store().plans[0].items[0];
    expect(item.exerciseId).toBe(BENCH);
    expect(item.templates).toHaveLength(store().settings.defaultSetCount);
    expect(item.kind).toBe('weight_reps');
    expect(item.templates[0].weightKg).toBeGreaterThan(0);
  });

  it('ignores an unknown exercise id', () => {
    let id = '';
    id = store().createPlan('Push');
    store().addPlanItem(id, 'not_a_real_exercise');
    expect(store().plans[0].items).toEqual([]);
  });

  it('adds, edits and removes template sets', () => {
    let planId = '';
    planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    const itemId = store().plans[0].items[0].id;

    store().addPlanTemplate(planId, itemId);
    expect(store().plans[0].items[0].templates).toHaveLength(4);

    const templateId = store().plans[0].items[0].templates[0].id;
    store().updatePlanTemplate(planId, itemId, templateId, { weightKg: 80, reps: 5 });
    expect(store().plans[0].items[0].templates[0]).toMatchObject({ weightKg: 80, reps: 5 });

    store().removePlanTemplate(planId, itemId, templateId);
    expect(store().plans[0].items[0].templates).toHaveLength(3);
    expect(store().plans[0].items[0].templates.find((t) => t.id === templateId)).toBeUndefined();
  });

  it('copies the last set when adding another', () => {
    let planId = '';
    planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    const itemId = store().plans[0].items[0].id;
    const templates = store().plans[0].items[0].templates;
    const lastId = templates[templates.length - 1].id;

    store().updatePlanTemplate(planId, itemId, lastId, { weightKg: 95, reps: 3 });
    store().addPlanTemplate(planId, itemId);

    const after = store().plans[0].items[0].templates;
    expect(after[after.length - 1]).toMatchObject({ weightKg: 95, reps: 3 });
    expect(after[after.length - 1].id).not.toBe(lastId);
  });

  it('reseeds sets when the recorded kind changes, since old numbers no longer apply', () => {
    let planId = '';
    planId = store().createPlan('Core');
    store().addPlanItem(planId, BENCH);
    const itemId = store().plans[0].items[0].id;
    store().setPlanItemKind(planId, itemId, 'time');

    const item = store().plans[0].items[0];
    expect(item.kind).toBe('time');
    expect(item.templates[0].timeSec).toBeGreaterThan(0);
    expect(item.templates[0].weightKg).toBeUndefined();
  });

  it('reorders items and clamps at both ends', () => {
    let planId = '';
    planId = store().createPlan('Full body');
    store().addPlanItem(planId, BENCH);
    store().addPlanItem(planId, SQUAT);
    const [a, b] = store().plans[0].items.map((i) => i.id);

    store().movePlanItem(planId, b, -1);
    expect(store().plans[0].items.map((i) => i.id)).toEqual([b, a]);

    store().movePlanItem(planId, b, -1); // already first
    expect(store().plans[0].items.map((i) => i.id)).toEqual([b, a]);

    store().movePlanItem(planId, a, 1); // already last
    expect(store().plans[0].items.map((i) => i.id)).toEqual([b, a]);
  });

  it('duplicates a plan with fresh ids so edits do not leak between copies', () => {
    let planId = '';
    let copyId: string | null = null;
    planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    copyId = store().duplicatePlan(planId);
    const original = store().plans.find((p) => p.id === planId)!;
    const copy = store().plans.find((p) => p.id === copyId)!;

    expect(copy.name).toBe('Push copy');
    expect(copy.items[0].id).not.toBe(original.items[0].id);
    expect(copy.items[0].templates[0].id).not.toBe(original.items[0].templates[0].id);

    store().updatePlanTemplate(copy.id, copy.items[0].id, copy.items[0].templates[0].id, { reps: 99 });
    expect(store().plans.find((p) => p.id === planId)!.items[0].templates[0].reps).not.toBe(99);
  });

  it('returns null when duplicating a plan that does not exist', () => {
    let result: string | null = 'x';
    result = store().duplicatePlan('nope');
    expect(result).toBeNull();
  });

  it('deletes a plan without touching logged workouts', () => {
    let planId = '';
    planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    const s = store().startSession(planId)!;
    const entry = store().sessions[0].entries[0];
    store().toggleSetLogged(s, entry.id, entry.sets[0].id);
    store().endSession(s);
    store().deletePlan(planId);
    expect(store().plans).toHaveLength(0);
    expect(store().sessions).toHaveLength(1);
    expect(store().sessions[0].planName).toBe('Push');
  });
});

// ------------------------------------------------------------------- sessions

describe('the workout loop', () => {
  function setup() {
    let planId = '';
    let sessionId = '';
    planId = store().createPlan('Push day');
    store().addPlanItem(planId, BENCH);
    sessionId = store().startSession(planId)!;
    const entryId = store().sessions[0].entries[0].id;
    return { planId, sessionId, entryId };
  }

  it('materialises the plan into a live session', () => {
    const { planId, sessionId } = setup();
    const session = store().sessions.find((s) => s.id === sessionId)!;
    expect(session.planId).toBe(planId);
    expect(session.planName).toBe('Push day');
    expect(session.endedAt).toBeNull();
    expect(session.entries[0].sets).toHaveLength(3);
    expect(session.entries[0].sets.every((s) => s.loggedAt === null)).toBe(true);
    expect(store().activeSessionId).toBe(sessionId);
  });

  it('snapshots the plan name so later renames do not rewrite history', () => {
    const { planId, sessionId } = setup();
    store().renamePlan(planId, 'Renamed');
    expect(store().sessions.find((s) => s.id === sessionId)!.planName).toBe('Push day');
  });

  it('refuses to start from a plan that does not exist', () => {
    let result: string | null = 'x';
    result = store().startSession('nope');
    expect(result).toBeNull();
    expect(store().sessions).toHaveLength(0);
  });

  it('adds a set that copies the previous one', () => {
    const { sessionId, entryId } = setup();
    const sets = store().sessions[0].entries[0].sets;
    store().updateSet(sessionId, entryId, sets[2].id, { weightKg: 70, reps: 6 });
    store().addSet(sessionId, entryId);

    const after = store().sessions[0].entries[0].sets;
    expect(after).toHaveLength(4);
    expect(after[3]).toMatchObject({ weightKg: 70, reps: 6, loggedAt: null });
  });

  it('modifies weight, reps and time on a set', () => {
    const { sessionId, entryId } = setup();
    const setId = store().sessions[0].entries[0].sets[0].id;

    store().updateSet(sessionId, entryId, setId, { weightKg: 82.5 });
    store().updateSet(sessionId, entryId, setId, { reps: 5 });
    store().updateSet(sessionId, entryId, setId, { timeSec: 45 });

    // Patches merge rather than replace, so an earlier edit survives a later one.
    expect(store().sessions[0].entries[0].sets[0]).toMatchObject({
      weightKg: 82.5,
      reps: 5,
      timeSec: 45,
    });
  });

  it('records a set and un-records it again', () => {
    const { sessionId, entryId } = setup();
    const setId = store().sessions[0].entries[0].sets[0].id;

    store().toggleSetLogged(sessionId, entryId, setId);
    const loggedAt = store().sessions[0].entries[0].sets[0].loggedAt;
    expect(typeof loggedAt).toBe('number');

    store().toggleSetLogged(sessionId, entryId, setId);
    expect(store().sessions[0].entries[0].sets[0].loggedAt).toBeNull();
  });

  it('keeps a recorded set editable', () => {
    const { sessionId, entryId } = setup();
    const setId = store().sessions[0].entries[0].sets[0].id;
    store().toggleSetLogged(sessionId, entryId, setId);
    store().updateSet(sessionId, entryId, setId, { weightKg: 65 });

    const set = store().sessions[0].entries[0].sets[0];
    expect(set.weightKg).toBe(65);
    expect(set.loggedAt).not.toBeNull();
  });

  it('removes a set, before or after recording it', () => {
    const { sessionId, entryId } = setup();
    const [a, b] = store().sessions[0].entries[0].sets.map((s) => s.id);

    store().removeSet(sessionId, entryId, a);
    expect(store().sessions[0].entries[0].sets).toHaveLength(2);

    store().toggleSetLogged(sessionId, entryId, b);
    store().removeSet(sessionId, entryId, b);
    expect(store().sessions[0].entries[0].sets).toHaveLength(1);
    expect(store().sessions[0].entries[0].sets.find((s) => s.id === b)).toBeUndefined();
  });

  it('adds and removes an exercise mid-workout', () => {
    const { sessionId } = setup();
    store().addSessionExercise(sessionId, SQUAT);
    expect(store().sessions[0].entries).toHaveLength(2);

    const squatEntry = store().sessions[0].entries[1];
    expect(squatEntry.exerciseId).toBe(SQUAT);

    store().removeSessionEntry(sessionId, squatEntry.id);
    expect(store().sessions[0].entries).toHaveLength(1);
  });

  it('picks the right set kind for a timed exercise', () => {
    const { sessionId } = setup();
    store().addSessionExercise(sessionId, PLANK);
    const entry = store().sessions[0].entries.find((e) => e.exerciseId === PLANK)!;
    expect(entry.kind).toBe('time');
    expect(entry.sets[0].timeSec).toBeGreaterThan(0);
    expect(entry.sets[0].weightKg).toBeUndefined();
  });

  it('drops unrecorded sets on finish so history reflects work done', () => {
    const { sessionId, entryId } = setup();
    const sets = store().sessions[0].entries[0].sets;
    store().toggleSetLogged(sessionId, entryId, sets[0].id);
    store().toggleSetLogged(sessionId, entryId, sets[1].id);
    store().endSession(sessionId);

    const session = store().sessions[0];
    expect(session.endedAt).not.toBeNull();
    expect(session.entries[0].sets).toHaveLength(2);
    expect(session.entries[0].sets.every((s) => s.loggedAt !== null)).toBe(true);
    expect(store().activeSessionId).toBeNull();
  });

  it('drops an exercise entirely if none of its sets were recorded', () => {
    const { sessionId, entryId } = setup();
    store().addSessionExercise(sessionId, SQUAT);
    store().toggleSetLogged(sessionId, entryId, store().sessions[0].entries[0].sets[0].id);
    store().endSession(sessionId);
    expect(store().sessions[0].entries).toHaveLength(1);
    expect(store().sessions[0].entries[0].exerciseId).toBe(BENCH);
  });

  it('discards a session completely', () => {
    const { sessionId } = setup();
    store().discardSession(sessionId);
    expect(store().sessions).toHaveLength(0);
    expect(store().activeSessionId).toBeNull();
  });

  it('supports a quick workout with no plan behind it', () => {
    let sessionId = '';
    sessionId = store().startEmptySession();
    store().addSessionExercise(sessionId, SQUAT);
    const session = store().sessions[0];
    expect(session.planId).toBeNull();
    expect(session.planName).toBe('Quick workout');
    expect(session.entries).toHaveLength(1);
  });

  it('is a no-op for unknown session, entry or set ids', () => {
    const { sessionId, entryId } = setup();
    const before = JSON.stringify(store().sessions);
    store().addSet('ghost', entryId);
    store().removeSet(sessionId, 'ghost', 'ghost');
    store().updateSet(sessionId, entryId, 'ghost', { reps: 1 });
    store().toggleSetLogged(sessionId, 'ghost', 'ghost');
    store().addSessionExercise(sessionId, 'ghost_exercise');
    expect(JSON.stringify(store().sessions)).toBe(before);
  });
});

// -------------------------------------------------------------- integration

describe('log feeds the body map', () => {
  it('turns recorded sets into muscle volume', () => {
    let sessionId = '';
    const planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    sessionId = store().startSession(planId)!;
    const entry = store().sessions[0].entries[0];
    for (const set of entry.sets) store().toggleSetLogged(sessionId, entry.id, set.id);
    store().endSession(sessionId);

    const totals = volumeInWindow(store().sessions, Date.now());
    expect(totals.chest).toBeCloseTo(3); // 3 primary sets
    expect(totals.triceps).toBeCloseTo(1.5); // 3 secondary sets at half credit
    expect(totals.quadriceps).toBe(0);
  });

  it('un-recording a set removes it from the totals', () => {
    let sessionId = '';
    let entryId = '';
    const planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    sessionId = store().startSession(planId)!;
    entryId = store().sessions[0].entries[0].id;
    for (const set of store().sessions[0].entries[0].sets) {
      store().toggleSetLogged(sessionId, entryId, set.id);
    }
    expect(volumeInWindow(store().sessions, Date.now()).chest).toBeCloseTo(3);

    store().toggleSetLogged(sessionId, entryId, store().sessions[0].entries[0].sets[0].id);
    expect(volumeInWindow(store().sessions, Date.now()).chest).toBeCloseTo(2);
  });
});

describe('exerciseHistory', () => {
  it('returns only recorded sets of that exercise, newest first', () => {
    const planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    store().addPlanItem(planId, SQUAT);
    const sessionId = store().startSession(planId)!;
    const [bench, squat] = store().sessions[0].entries;
    store().toggleSetLogged(sessionId, bench.id, bench.sets[0].id);
    store().toggleSetLogged(sessionId, bench.id, bench.sets[1].id);
    store().toggleSetLogged(sessionId, squat.id, squat.sets[0].id);

    const rows = exerciseHistory(store().sessions, BENCH);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('weight_reps');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].set.loggedAt!).toBeGreaterThanOrEqual(rows[i].set.loggedAt!);
    }
  });

  it('is empty for an exercise never performed', () => {
    expect(exerciseHistory(store().sessions, PLANK)).toEqual([]);
  });
});

describe('settings', () => {
  it('patches without clobbering the rest', () => {
    store().updateSettings({ unit: 'lb' });
    expect(store().settings.unit).toBe('lb');
    expect(store().settings.defaultRestSec).toBe(90);
  });

  it('honours a changed default set count for newly added exercises', () => {
    let planId = '';
    store().updateSettings({ defaultSetCount: 5 });
    planId = store().createPlan('Push');
    store().addPlanItem(planId, BENCH);
    expect(store().plans[0].items[0].templates).toHaveLength(5);
  });
});

// ------------------------------------------------------------------- profile

describe('profile', () => {
  it('starts empty so the app is usable without filling anything in', () => {
    expect(store().profile).toMatchObject({
      displayName: '',
      birthDate: null,
      sex: 'unspecified',
      heightCm: null,
      weightKg: null,
      equipment: [],
    });
  });

  it('patches fields without clobbering the rest', () => {
    store().updateProfile({ heightCm: 178 });
    store().updateProfile({ weightKg: 82.5 });
    expect(store().profile).toMatchObject({ heightCm: 178, weightKg: 82.5, goal: 'hypertrophy' });
  });

  it('toggles equipment on and off', () => {
    store().toggleEquipment('barbell');
    store().toggleEquipment('dumbbell');
    expect(store().profile.equipment).toEqual(['barbell', 'dumbbell']);

    store().toggleEquipment('barbell');
    expect(store().profile.equipment).toEqual(['dumbbell']);
  });

  it('never duplicates an equipment entry', () => {
    store().toggleEquipment('cable');
    store().toggleEquipment('cable');
    store().toggleEquipment('cable');
    expect(store().profile.equipment).toEqual(['cable']);
  });

  it('is cleared by resetAll', () => {
    store().updateProfile({ displayName: 'Test', heightCm: 180 });
    store().resetAll();
    expect(store().profile.displayName).toBe('');
    expect(store().profile.heightCm).toBeNull();
  });
});

describe('unit seeding from the device', () => {
  it('applies the phone default the first time', () => {
    store().seedUnitFromDevice('lb');
    expect(store().settings.unit).toBe('lb');
    expect(store().settings.unitSeededFromDevice).toBe(true);
  });

  it('never overrides the unit a second time', () => {
    store().seedUnitFromDevice('lb');
    store().seedUnitFromDevice('kg');
    expect(store().settings.unit).toBe('lb');
  });

  it('leaves a deliberate user choice alone on the next launch', () => {
    // User switches to kg by hand, which marks the seed as done...
    store().updateSettings({ unit: 'kg', unitSeededFromDevice: true });
    // ...so a US phone re-seeding on the next launch must not undo it.
    store().seedUnitFromDevice('lb');
    expect(store().settings.unit).toBe('kg');
  });
});
