import { act, fireEvent, screen } from '@testing-library/react-native';
import { confirmDialog, cancelDialog, renderScreen } from '@/test-utils';
import { DAY_MS } from '@/analytics/volume';
import { toDateInput } from '@/lib/format';
import { useStore } from '@/store/useStore';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const HistoryDetailScreen = require('../../app/history/[id]').default;

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Full_Squat';
const store = () => useStore.getState();

/** A workout done and saved three days ago, with every set recorded. */
function pastWorkout(exerciseId = BENCH) {
  const s = store();
  const planId = s.createPlan('monday');
  s.addPlanItem(planId, exerciseId);
  const sessionId = s.startSession(planId)!;
  const entry = store().sessions[0].entries[0];
  for (const set of entry.sets) s.toggleSetLogged(sessionId, entry.id, set.id);
  s.endSession(sessionId);
  // Backdate it, which also carries the sets - the same path the UI uses.
  s.setSessionStart(sessionId, store().sessions[0].startedAt - 3 * DAY_MS);
  mockParams = { id: sessionId };
  return sessionId;
}

const session = () => store().sessions[0];
const sets = () => session().entries[0].sets;
const entryId = () => session().entries[0].id;

async function openEditor() {
  await renderScreen(<HistoryDetailScreen />);
  await fireEvent.press(screen.getByTestId('history-edit'));
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  mockParams = {};
});

describe('a past workout reads as a record until you ask to edit it', () => {
  it('shows the sets with no editing controls', async () => {
    pastWorkout();
    await renderScreen(<HistoryDetailScreen />);

    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(screen.getByTestId('history-edit')).toBeTruthy();
    for (const set of sets()) {
      expect(screen.queryByTestId(`edit-del-${set.id}`)).toBeNull();
      expect(screen.queryByTestId(`edit-set-${set.id}-weight`)).toBeNull();
    }
    expect(screen.queryByTestId('history-add-exercise')).toBeNull();
    expect(screen.queryByTestId('history-length')).toBeNull();
    // Deleting the workout is behind the same tap, so it cannot be hit while browsing.
    expect(screen.queryByTestId('delete-workout')).toBeNull();
  });

  it('reveals the fields once editing', async () => {
    pastWorkout();
    await openEditor();

    for (const set of sets()) expect(screen.getByTestId(`edit-set-${set.id}-weight`)).toBeTruthy();
    expect(screen.getByTestId('history-add-exercise')).toBeTruthy();
    expect(screen.getByTestId('history-date')).toBeTruthy();
  });
});

describe('correcting what was recorded', () => {
  it('edits weight and reps of a logged set', async () => {
    // Kilograms, so the number typed is the number stored - see the note in session.screen.test.
    store().updateSettings({ unit: 'kg' });
    pastWorkout();
    await openEditor();

    const setId = sets()[0].id;
    await fireEvent.changeText(screen.getByTestId(`edit-set-${setId}-weight`), '92.5');
    await fireEvent.changeText(screen.getByTestId(`edit-set-${setId}-reps`), '4');

    expect(sets()[0]).toMatchObject({ weightKg: 92.5, reps: 4 });
    // The correction does not un-record the set.
    expect(sets()[0].loggedAt).not.toBeNull();
  });

  it('deletes a set and drops it out of the totals', async () => {
    pastWorkout();
    await openEditor();

    expect(screen.getByText('Chest 3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`edit-del-${sets()[0].id}`));

    expect(sets()).toHaveLength(2);
    expect(screen.getByText('Chest 2')).toBeTruthy();
  });

  it('adds a set already recorded, on the day the workout happened', async () => {
    pastWorkout();
    await openEditor();

    const before = sets()[sets().length - 1].loggedAt!;
    await fireEvent.press(screen.getByTestId(`history-add-set-${entryId()}`));

    const added = sets()[3];
    expect(sets()).toHaveLength(4);
    // Recorded, or it would show on screen while counting for nothing.
    expect(added.loggedAt).toBe(before);
    // And on the workout's own day, not today - otherwise fixing last week's log would
    // light up the body map as training done just now.
    expect(toDateInput(added.loggedAt!)).toBe(toDateInput(session().startedAt));
  });

  it('adds an exercise as a single recorded set rather than three invented ones', async () => {
    const sessionId = pastWorkout();
    await openEditor();

    await act(async () => void store().addSessionExercise(sessionId, SQUAT));

    const added = session().entries[1];
    expect(added.sets).toHaveLength(1);
    expect(added.sets[0].loggedAt).toBe(session().endedAt);
  });

  it('removes an exercise after confirming', async () => {
    pastWorkout();
    await openEditor();

    await fireEvent.press(screen.getByTestId(`history-remove-entry-${entryId()}`));
    await confirmDialog();

    expect(session().entries).toHaveLength(0);
  });
});

describe('moving a workout to another day', () => {
  it('carries every set with it and keeps the duration', async () => {
    pastWorkout();
    await openEditor();

    const before = session();
    const duration = before.endedAt! - before.startedAt;
    const offsets = before.entries[0].sets.map((x) => x.loggedAt! - before.startedAt);
    const target = toDateInput(before.startedAt - 2 * DAY_MS);

    await fireEvent.changeText(screen.getByTestId('history-date'), target);

    const after = session();
    expect(toDateInput(after.startedAt)).toBe(target);
    expect(after.endedAt! - after.startedAt).toBe(duration);
    expect(after.entries[0].sets.map((x) => x.loggedAt! - after.startedAt)).toEqual(offsets);
    // Time of day survives a change of date.
    expect(new Date(after.startedAt).getHours()).toBe(new Date(before.startedAt).getHours());
  });

  it('ignores a half-typed date instead of jumping somewhere', async () => {
    pastWorkout();
    await openEditor();

    const before = session().startedAt;
    await fireEvent.changeText(screen.getByTestId('history-date'), '2026-08-0');
    expect(session().startedAt).toBe(before);

    await fireEvent.changeText(screen.getByTestId('history-date'), '2026-02-31');
    expect(session().startedAt).toBe(before);
  });

  it('corrects how long the workout took, in minutes', async () => {
    pastWorkout();
    await openEditor();

    const start = session().startedAt;
    await fireEvent.changeText(screen.getByTestId('history-length'), '75');

    expect(session().endedAt! - start).toBe(75 * 60_000);
    // The start is where it was; only the end moved.
    expect(session().startedAt).toBe(start);
  });

  it('shows the corrected length back in the read-only view', async () => {
    pastWorkout();
    await openEditor();

    await fireEvent.changeText(screen.getByTestId('history-length'), '45');
    await fireEvent.press(screen.getByTestId('history-done'));

    expect(screen.getByTestId('history-when').props.children.join('')).toMatch(/45:00$/);
  });

  it('changes the time of day without changing the date', async () => {
    pastWorkout();
    await openEditor();

    const day = toDateInput(session().startedAt);
    await fireEvent.changeText(screen.getByTestId('history-time'), '06:15');

    const at = new Date(session().startedAt);
    expect([at.getHours(), at.getMinutes()]).toEqual([6, 15]);
    expect(toDateInput(session().startedAt)).toBe(day);
  });
});

describe('naming a workout in the log', () => {
  it('takes a new title', async () => {
    pastWorkout();
    await openEditor();

    await fireEvent.changeText(screen.getByTestId('history-name'), 'Heavy bench');
    expect(session().planName).toBe('Heavy bench');
  });

  it('lets the field be cleared completely and defaults on blur', async () => {
    // The bug this guards was reported twice against plan names: a value round-tripped
    // through the store on every keystroke leaves the last character undeletable.
    pastWorkout();
    await openEditor();

    const field = screen.getByTestId('history-name');
    await fireEvent.changeText(field, '');
    expect(session().planName).toBe('');

    await fireEvent(field, 'blur');
    expect(session().planName).toBe('Workout');
  });

  it('defaults a blank name on Done as well, since blur can be skipped', async () => {
    // Tapping Done straight from the keyboard never blurs the field on some platforms, and a
    // workout with no title at all is an unreadable row in the log.
    pastWorkout();
    await openEditor();

    await fireEvent.changeText(screen.getByTestId('history-name'), '   ');
    await fireEvent.press(screen.getByTestId('history-done'));

    expect(session().planName).toBe('Workout');
  });
});

describe('finishing an edit', () => {
  it('tidies away an exercise left with no sets', async () => {
    pastWorkout();
    await act(async () => void store().addSessionExercise(store().sessions[0].id, SQUAT));
    await openEditor();

    const squat = session().entries[1];
    for (const set of squat.sets) {
      await fireEvent.press(screen.getByTestId(`edit-del-${set.id}`));
    }
    // It stays put while editing, so the sets can be put back.
    expect(session().entries).toHaveLength(2);

    await fireEvent.press(screen.getByTestId('history-done'));
    expect(session().entries).toHaveLength(1);
    expect(screen.getByTestId('history-edit')).toBeTruthy();
  });

  it('offers to delete a workout emptied of everything', async () => {
    const sessionId = pastWorkout();
    await openEditor();

    for (const set of [...sets()]) {
      await fireEvent.press(screen.getByTestId(`edit-del-${set.id}`));
    }
    await fireEvent.press(screen.getByTestId('history-done'));
    expect(screen.getByText('Nothing left in this workout')).toBeTruthy();

    await confirmDialog();
    expect(store().sessions.find((x) => x.id === sessionId)).toBeUndefined();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('keeps an emptied workout when that is what you choose', async () => {
    const sessionId = pastWorkout();
    await openEditor();

    for (const set of [...sets()]) {
      await fireEvent.press(screen.getByTestId(`edit-del-${set.id}`));
    }
    await fireEvent.press(screen.getByTestId('history-done'));
    await cancelDialog();

    expect(store().sessions.find((x) => x.id === sessionId)).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    // Back to reading, with something on screen rather than a bare header.
    expect(screen.getByTestId('history-edit')).toBeTruthy();
    expect(screen.getByText('Nothing recorded')).toBeTruthy();
  });

  it('deletes the whole workout from the edit footer', async () => {
    const sessionId = pastWorkout();
    await openEditor();

    await fireEvent.press(screen.getByTestId('delete-workout'));
    await confirmDialog();

    expect(store().sessions.find((x) => x.id === sessionId)).toBeUndefined();
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

it('renders an empty state rather than crashing on a missing workout', async () => {
  mockParams = { id: 'gone' };
  await renderScreen(<HistoryDetailScreen />);
  expect(screen.getByText('Workout not found')).toBeTruthy();
});
