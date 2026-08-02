import { volumeInWindow } from '@/analytics/volume';
import { exerciseHistory, MAX_REST_SEC, useStore } from '@/store/useStore';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const PLANK = 'Plank';

const store = () => useStore.getState();

beforeEach(() => {
  store().resetAll();
});

// ---------------------------------------------------------------------- plans

describe('plans', () => {
  it('keeps plans in weekday order, so the list reads as the week', () => {
    const first = store().createPlan('wednesday');
    store().createPlan('monday');
    expect(store().plans.map((p) => p.day)).toEqual(['monday', 'wednesday']);
    expect(store().plans.find((p) => p.id === first)?.items).toEqual([]);
  });

  it('takes the first free weekday when none is given', () => {
    store().createPlan();
    store().createPlan();
    expect(store().plans.map((p) => p.day)).toEqual(['monday', 'tuesday']);
  });

  it('moves a plan to another day', () => {
    const id = store().createPlan('monday');
    store().setPlanDay(id, 'friday');
    expect(store().plans[0].day).toBe('friday');
  });

  it('swaps two plans rather than refusing a day that is taken', () => {
    // Rearranging a week should be one tap, not "free Wednesday first, then move".
    const mon = store().createPlan('monday');
    const wed = store().createPlan('wednesday');
    store().addPlanItem(mon, BENCH);

    store().setPlanDay(mon, 'wednesday');

    expect(store().plans.find((p) => p.id === mon)!.day).toBe('wednesday');
    expect(store().plans.find((p) => p.id === wed)!.day).toBe('monday');
    // The exercises travel with the plan, not with the day.
    expect(store().plans.find((p) => p.id === mon)!.items).toHaveLength(1);
  });

  it('adds an exercise with the default number of seeded sets', () => {
    let id = '';
    id = store().createPlan('monday');
    store().addPlanItem(id, BENCH);
    const item = store().plans[0].items[0];
    expect(item.exerciseId).toBe(BENCH);
    expect(item.templates).toHaveLength(store().settings.defaultSetCount);
    expect(item.kind).toBe('weight_reps');
    expect(item.templates[0].weightKg).toBeGreaterThan(0);
  });

  it('ignores an unknown exercise id', () => {
    let id = '';
    id = store().createPlan('monday');
    store().addPlanItem(id, 'not_a_real_exercise');
    expect(store().plans[0].items).toEqual([]);
  });

  it('adds, edits and removes template sets', () => {
    let planId = '';
    planId = store().createPlan('monday');
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
    planId = store().createPlan('monday');
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
    planId = store().createPlan('thursday');
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
    planId = store().createPlan('monday');
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
    planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    copyId = store().duplicatePlan(planId);
    const original = store().plans.find((p) => p.id === planId)!;
    const copy = store().plans.find((p) => p.id === copyId)!;

    expect(copy.day).toBe('tuesday');
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
    planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const s = store().startSession(planId)!;
    const entry = store().sessions[0].entries[0];
    store().toggleSetLogged(s, entry.id, entry.sets[0].id);
    store().endSession(s);
    store().deletePlan(planId);
    expect(store().plans).toHaveLength(0);
    expect(store().sessions).toHaveLength(1);
    expect(store().sessions[0].planName).toBe('Monday');
  });
});

// ------------------------------------------------------------------- sessions

describe('the workout loop', () => {
  function setup() {
    let planId = '';
    let sessionId = '';
    planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    sessionId = store().startSession(planId)!;
    const entryId = store().sessions[0].entries[0].id;
    return { planId, sessionId, entryId };
  }

  it('materialises the plan into a live session', () => {
    const { planId, sessionId } = setup();
    const session = store().sessions.find((s) => s.id === sessionId)!;
    expect(session.planId).toBe(planId);
    expect(session.planName).toBe('Monday');
    expect(session.endedAt).toBeNull();
    expect(session.entries[0].sets).toHaveLength(3);
    expect(session.entries[0].sets.every((s) => s.loggedAt === null)).toBe(true);
    expect(store().activeSessionId).toBe(sessionId);
  });

  it('snapshots the day name, so moving the plan later does not rewrite history', () => {
    const { planId, sessionId } = setup();
    expect(store().sessions.find((s) => s.id === sessionId)!.planName).toBe('Monday');

    store().setPlanDay(planId, 'friday');
    expect(store().sessions.find((s) => s.id === sessionId)!.planName).toBe('Monday');
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

  it('carries an edit into the sets that come after it', () => {
    const { sessionId, entryId } = setup();
    const setId = store().sessions[0].entries[0].sets[0].id;

    store().updateSet(sessionId, entryId, setId, { weightKg: 70 });

    // The whole exercise is now on 70: one edit, not one per set.
    expect(store().sessions[0].entries[0].sets.map((x) => x.weightKg)).toEqual([70, 70, 70]);
  });

  it('carries only the fields being changed', () => {
    const { sessionId, entryId } = setup();
    const sets = store().sessions[0].entries[0].sets;
    store().updateSet(sessionId, entryId, sets[2].id, { reps: 12 });

    // Correcting the weight of the first set must not undo that last set's rep target.
    store().updateSet(sessionId, entryId, sets[0].id, { weightKg: 70 });

    expect(store().sessions[0].entries[0].sets[2]).toMatchObject({ weightKg: 70, reps: 12 });
  });

  it('never rewrites a set that has been recorded', () => {
    const { sessionId, entryId } = setup();
    const sets = store().sessions[0].entries[0].sets;
    store().toggleSetLogged(sessionId, entryId, sets[1].id);

    store().updateSet(sessionId, entryId, sets[0].id, { weightKg: 70 });

    const after = store().sessions[0].entries[0].sets;
    expect(after[1].weightKg).toBe(20); // recorded: what was actually lifted, untouched
    expect(after[2].weightKg).toBe(70); // still only a target, so it follows
  });

  it('leaves the sets above alone - they have already happened', () => {
    const { sessionId, entryId } = setup();
    const sets = store().sessions[0].entries[0].sets;

    store().updateSet(sessionId, entryId, sets[1].id, { weightKg: 70 });

    expect(store().sessions[0].entries[0].sets.map((x) => x.weightKg)).toEqual([20, 70, 70]);
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
    const planId = store().createPlan('monday');
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
    const planId = store().createPlan('monday');
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
    const planId = store().createPlan('monday');
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
    planId = store().createPlan('monday');
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

describe('the weight unit', () => {
  it('starts a fresh install in pounds', () => {
    expect(store().settings.unit).toBe('lb');
  });

  it('keeps the unit the user picked', () => {
    store().updateSettings({ unit: 'kg' });
    expect(store().settings.unit).toBe('kg');
  });

  it('is restored to pounds by resetAll, which is a fresh install again', () => {
    store().updateSettings({ unit: 'kg' });
    store().resetAll();
    expect(store().settings.unit).toBe('lb');
  });
});

// ------------------------------------------------- starting from last time

describe('starting an exercise from what you did last time', () => {
  /** Records a finished workout of one exercise with exactly these numbers, in order. */
  function recordWorkout(exerciseId: string, values: { weightKg: number; reps: number }[]) {
    const sessionId = store().startEmptySession();
    store().addSessionExercise(sessionId, exerciseId);
    const entryId = store().sessions.find((x) => x.id === sessionId)!.entries[0].id;
    const setsNow = () =>
      store().sessions.find((x) => x.id === sessionId)!.entries[0].sets;

    for (const extra of setsNow().slice(values.length)) {
      store().removeSet(sessionId, entryId, extra.id);
    }
    while (setsNow().length < values.length) store().addSet(sessionId, entryId);

    setsNow().forEach((set, i) => {
      store().updateSet(sessionId, entryId, set.id, values[i]);
      store().toggleSetLogged(sessionId, entryId, set.id);
    });
    store().endSession(sessionId);
    return sessionId;
  }

  /** A Monday plan holding one exercise, with its templates set to `weightKg`/`reps`. */
  function planFor(exerciseId: string, weightKg = 20, reps = 8) {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, exerciseId);
    const item = store().plans[0].items[0];
    for (const t of item.templates) {
      store().updatePlanTemplate(planId, item.id, t.id, { weightKg, reps });
    }
    return planId;
  }

  const startedSets = (sessionId: string) =>
    store().sessions.find((x) => x.id === sessionId)!.entries[0].sets;

  it('uses the plan template when the exercise has never been recorded', () => {
    const planId = planFor(BENCH, 60, 8);
    const sessionId = store().startSession(planId)!;
    expect(startedSets(sessionId).map((x) => x.weightKg)).toEqual([60, 60, 60]);
  });

  it('opens on last time`s numbers instead', () => {
    recordWorkout(BENCH, [
      { weightKg: 100, reps: 5 },
      { weightKg: 100, reps: 5 },
      { weightKg: 95, reps: 5 },
    ]);
    const planId = planFor(BENCH, 60, 8);

    const sessionId = store().startSession(planId)!;

    // Set by set, in the order they were done - not one number smeared across the exercise.
    expect(startedSets(sessionId).map((x) => x.weightKg)).toEqual([100, 100, 95]);
    expect(startedSets(sessionId).map((x) => x.reps)).toEqual([5, 5, 5]);
  });

  it('leaves them unrecorded - they are targets, not results', () => {
    recordWorkout(BENCH, [{ weightKg: 100, reps: 5 }]);
    const planId = planFor(BENCH);
    const sessionId = store().startSession(planId)!;
    expect(startedSets(sessionId).every((x) => x.loggedAt === null)).toBe(true);
  });

  it('repeats last time`s final set when today plans more of them', () => {
    recordWorkout(BENCH, [
      { weightKg: 100, reps: 5 },
      { weightKg: 90, reps: 5 },
    ]);
    const planId = planFor(BENCH); // three templates against two recorded sets
    const sessionId = store().startSession(planId)!;
    expect(startedSets(sessionId).map((x) => x.weightKg)).toEqual([100, 90, 90]);
  });

  it('ignores sets that were never recorded', () => {
    // A workout where the numbers were typed but the sets never got ticked off.
    const sessionId = store().startEmptySession();
    store().addSessionExercise(sessionId, BENCH);
    const entryId = store().sessions[0].entries[0].id;
    const setId = store().sessions[0].entries[0].sets[0].id;
    store().updateSet(sessionId, entryId, setId, { weightKg: 300 });

    const planId = planFor(BENCH, 60, 8);
    const started = store().startSession(planId)!;

    expect(startedSets(started)[0].weightKg).toBe(60);
  });

  it('follows the day the training happened, not the order sessions were created', () => {
    const older = recordWorkout(BENCH, [{ weightKg: 80, reps: 5 }]);
    recordWorkout(BENCH, [{ weightKg: 100, reps: 5 }]);
    // The 80kg workout is moved to next week, which makes it the most recent one.
    store().setSessionStart(older, Date.now() + 7 * 86_400_000);

    const planId = planFor(BENCH);
    const sessionId = store().startSession(planId)!;

    expect(startedSets(sessionId)[0].weightKg).toBe(80);
  });

  it('keeps a template number that last time has nothing to say about', () => {
    // Recorded as weight x reps; the plan item asks for time as well.
    recordWorkout(BENCH, [{ weightKg: 100, reps: 5 }]);
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const item = store().plans[0].items[0];
    store().updatePlanTemplate(planId, item.id, item.templates[0].id, { timeSec: 45 });

    const sessionId = store().startSession(planId)!;

    expect(startedSets(sessionId)[0]).toMatchObject({ weightKg: 100, reps: 5, timeSec: 45 });
  });

  it('seeds an exercise added to a live workout as well', () => {
    recordWorkout(BENCH, [{ weightKg: 100, reps: 5 }]);
    const sessionId = store().startEmptySession();

    store().addSessionExercise(sessionId, BENCH);

    expect(startedSets(sessionId)[0]).toMatchObject({ weightKg: 100, reps: 5 });
  });

  it('seeds an exercise added to a past workout from before that day, not after', () => {
    const DAY = 86_400_000;
    const old = recordWorkout(BENCH, [{ weightKg: 80, reps: 5 }]);
    store().setSessionStart(old, Date.now() - 30 * DAY);
    recordWorkout(BENCH, [{ weightKg: 120, reps: 5 }]);

    // Correcting a workout from a fortnight ago: what came before it was the 80kg day.
    const editing = store().startEmptySession();
    store().addSessionExercise(editing, SQUAT);
    const squatSet = store().sessions.find((x) => x.id === editing)!.entries[0];
    store().toggleSetLogged(editing, squatSet.id, squatSet.sets[0].id);
    store().endSession(editing);
    store().setSessionStart(editing, Date.now() - 14 * DAY);

    store().addSessionExercise(editing, BENCH);

    const added = store().sessions.find((x) => x.id === editing)!.entries[1];
    expect(added.sets[0]).toMatchObject({ weightKg: 80, reps: 5 });
  });
});

describe('the rest timer duration', () => {
  /** A plan with one exercise, plus a live workout started from it. */
  function planAndWorkout() {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const sessionId = store().startSession(planId)!;
    return { planId, sessionId };
  }

  it('is stored on the settings', () => {
    store().setDefaultRest(120);
    expect(store().settings.defaultRestSec).toBe(120);
  });

  it('retimes plans built before the change', () => {
    const { planId } = planAndWorkout();
    expect(store().plans[0].items[0].restSec).toBe(90);

    store().setDefaultRest(150);

    expect(store().plans.find((p) => p.id === planId)!.items[0].restSec).toBe(150);
  });

  it('retimes a workout that is already running', () => {
    const { sessionId } = planAndWorkout();

    store().setDefaultRest(150);

    expect(store().sessions.find((x) => x.id === sessionId)!.entries[0].restSec).toBe(150);
  });

  it('leaves a finished workout alone, because it is a record', () => {
    const { sessionId } = planAndWorkout();
    const setId = store().sessions[0].entries[0].sets[0].id;
    store().toggleSetLogged(sessionId, store().sessions[0].entries[0].id, setId);
    store().endSession(sessionId);

    store().setDefaultRest(150);

    expect(store().sessions.find((x) => x.id === sessionId)!.entries[0].restSec).toBe(90);
  });

  it('applies to exercises added afterwards', () => {
    store().setDefaultRest(150);
    const planId = store().createPlan('tuesday');
    store().addPlanItem(planId, BENCH);
    expect(store().plans.find((p) => p.id === planId)!.items[0].restSec).toBe(150);
  });

  it('accepts zero, which means no timer', () => {
    store().setDefaultRest(0);
    expect(store().settings.defaultRestSec).toBe(0);
  });

  it('refuses a negative duration and caps an absurd one', () => {
    store().setDefaultRest(-30);
    expect(store().settings.defaultRestSec).toBe(0);
    store().setDefaultRest(99_999);
    expect(store().settings.defaultRestSec).toBe(MAX_REST_SEC);
  });

  it('rounds a fractional duration, since the timer counts whole seconds', () => {
    store().setDefaultRest(90.6);
    expect(store().settings.defaultRestSec).toBe(91);
  });
});

// ------------------------------------------------------ editing a past workout

describe('editing a finished workout', () => {
  const DAY = 86_400_000;

  /** A saved workout with three recorded sets of bench. */
  function pastWorkout(): string {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const sessionId = store().startSession(planId)!;
    const entry = store().sessions[0].entries[0];
    for (const set of entry.sets) store().toggleSetLogged(sessionId, entry.id, set.id);
    store().endSession(sessionId);
    return sessionId;
  }

  const session = () => store().sessions[0];

  it('moves the whole workout when its start moves', () => {
    const sessionId = pastWorkout();
    const before = session();
    const duration = before.endedAt! - before.startedAt;
    const gaps = before.entries[0].sets.map((x) => x.loggedAt! - before.startedAt);

    store().setSessionStart(sessionId, before.startedAt - 10 * DAY);

    const after = session();
    expect(after.startedAt).toBe(before.startedAt - 10 * DAY);
    expect(after.endedAt! - after.startedAt).toBe(duration);
    expect(after.entries[0].sets.map((x) => x.loggedAt! - after.startedAt)).toEqual(gaps);
  });

  it('takes the sets out of this week when the workout leaves it', () => {
    const sessionId = pastWorkout();
    const now = Date.now();
    expect(volumeInWindow(store().sessions, now, 7).chest).toBe(3);

    store().setSessionStart(sessionId, session().startedAt - 30 * DAY);

    // The point of shifting loggedAt: the body map reads the sets, not the session header.
    expect(volumeInWindow(store().sessions, now, 7).chest).toBe(0);
    expect(volumeInWindow(store().sessions, now, 60).chest).toBe(3);
  });

  it('leaves an unrecorded set of a live workout unstamped when it moves', () => {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const sessionId = store().startSession(planId)!;

    store().setSessionStart(sessionId, store().sessions[0].startedAt - DAY);

    expect(session().endedAt).toBeNull();
    expect(session().entries[0].sets.every((x) => x.loggedAt === null)).toBe(true);
  });

  it('records a set added afterwards, on the day of the workout', () => {
    const sessionId = pastWorkout();
    store().setSessionStart(sessionId, session().startedAt - 5 * DAY);
    const entry = session().entries[0];
    const last = entry.sets[entry.sets.length - 1].loggedAt!;

    store().addSet(sessionId, entry.id);

    const added = session().entries[0].sets[3];
    expect(added.loggedAt).toBe(last);
    expect(Date.now() - added.loggedAt!).toBeGreaterThan(4 * DAY);
  });

  it('adds an exercise as one recorded set rather than a full set of invented ones', () => {
    const sessionId = pastWorkout();
    store().addSessionExercise(sessionId, SQUAT);

    const added = session().entries[1];
    expect(added.sets).toHaveLength(1);
    expect(added.sets[0].loggedAt).toBe(session().endedAt);
  });

  it('still pre-fills a live workout with the usual number of unrecorded sets', () => {
    const sessionId = store().startEmptySession();
    store().addSessionExercise(sessionId, SQUAT);

    const entry = store().sessions[0].entries[0];
    expect(entry.sets).toHaveLength(store().settings.defaultSetCount);
    expect(entry.sets.every((x) => x.loggedAt === null)).toBe(true);
  });

  it('tidies away an exercise emptied of sets, and only then', () => {
    const sessionId = pastWorkout();
    store().addSessionExercise(sessionId, SQUAT);
    const squat = session().entries[1];
    store().removeSet(sessionId, squat.id, squat.sets[0].id);

    // Still there while the edit is in progress.
    expect(session().entries).toHaveLength(2);

    store().tidySession(sessionId);
    expect(session().entries.map((e) => e.exerciseId)).toEqual([BENCH]);
  });

  it('corrects the length by moving the end, never the start', () => {
    const sessionId = pastWorkout();
    const start = session().startedAt;

    store().setSessionDuration(sessionId, 90 * 60);

    expect(session().startedAt).toBe(start);
    expect(session().endedAt).toBe(start + 90 * 60_000);
  });

  it('refuses a negative length rather than ending before it started', () => {
    const sessionId = pastWorkout();
    store().setSessionDuration(sessionId, -600);
    expect(session().endedAt).toBe(session().startedAt);
  });

  it('leaves a workout still in progress without an end time', () => {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, BENCH);
    const sessionId = store().startSession(planId)!;

    store().setSessionDuration(sessionId, 3600);

    // A running workout is however long it has been going; there is nothing to correct.
    expect(session().endedAt).toBeNull();
  });

  it('renames a workout without touching anything else', () => {
    const sessionId = pastWorkout();
    const before = session();
    store().renameSession(sessionId, 'Heavy bench');

    expect(session().planName).toBe('Heavy bench');
    expect(session().entries).toEqual(before.entries);
    expect(session().startedAt).toBe(before.startedAt);
  });

  it('keeps a blank name as typed, for the field to default on commit', () => {
    const sessionId = pastWorkout();
    store().renameSession(sessionId, '');
    expect(session().planName).toBe('');
  });
});
