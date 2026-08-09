import { fireEvent, render, screen } from '@testing-library/react-native';
import { EXERCISES, RECOMMENDED } from '@/catalog';
import { useStore } from '@/store/useStore';
import { ExerciseList } from '@/ui/ExerciseList';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const renderList = () => render(<ExerciseList onSelect={jest.fn()} />);

const search = async (text: string) => {
  await fireEvent.changeText(screen.getByTestId('exercise-search'), text);
};

describe('the exercise list', () => {
  it('says how many exercises there are, and that a muscle works too', async () => {
    await renderList();
    // Counted rather than written down: the catalog grows when scripts/build-catalog.mjs is
    // rerun, and a hard-coded number here only ever fails long after the change that moved it.
    expect(
      screen.getByPlaceholderText(`Search ${EXERCISES.length} exercises, or a muscle`),
    ).toBeTruthy();
  });

  it('marks the recommended picks when a muscle is searched', async () => {
    await renderList();
    await search('chest');

    for (const id of RECOMMENDED.chest) {
      expect(screen.getByTestId(`top-pick-${id}`)).toBeTruthy();
    }
    expect(screen.getAllByText('TOP PICK')).toHaveLength(2);
  });

  it('marks nothing on an ordinary name search', async () => {
    // "bench press" is not a question about a muscle, so no opinion is offered.
    await renderList();
    await search('bench press');
    expect(screen.queryByText('TOP PICK')).toBeNull();
  });

  it('marks nothing before anything is typed', async () => {
    await renderList();
    expect(screen.queryByText('TOP PICK')).toBeNull();
  });

  it('recognises slang as a muscle search', async () => {
    await renderList();
    await search('quads');
    expect(screen.getByTestId(`top-pick-${RECOMMENDED.quadriceps[0]}`)).toBeTruthy();
  });
});

describe('filters', () => {
  it('offers muscles and nothing else', async () => {
    await renderList();
    expect(screen.getByTestId('muscle-all')).toBeTruthy();
    expect(screen.getByTestId('muscle-Chest')).toBeTruthy();

    // The equipment, category and difficulty rows and their toggle are gone.
    expect(screen.queryByTestId('toggle-filters')).toBeNull();
    expect(screen.queryByText('Any kit')).toBeNull();
    expect(screen.queryByText('Any type')).toBeNull();
    expect(screen.queryByText('Any level')).toBeNull();
  });

  it('still reaches those facets through the search box', async () => {
    // Removing the rows lost no capability: equipment, category and level are searchable text.
    await renderList();
    for (const q of ['dumbbell', 'cardio', 'beginner']) {
      await search(q);
      expect([q, screen.queryByText('Nothing matches')]).toEqual([q, null]);
    }
  });

  it('narrows to exercises that target the muscle when a chip is tapped', async () => {
    await renderList();
    await fireEvent.press(screen.getByTestId('muscle-Chest'));
    // 151 exercises involve the chest; far fewer actually target it.
    expect(screen.getByText(/^\d+ exercises$/).props.children.join('')).not.toBe('151 exercises');
  });
});

describe('how much of an exercise you have actually done', () => {
  const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
  const store = () => useStore.getState();

  /** Logs `count` sets of `exerciseId` in one finished session. */
  function record(exerciseId: string, count: number) {
    const planId = store().createPlan('monday');
    store().addPlanItem(planId, exerciseId);
    const sessionId = store().startSession(planId)!;
    const entry = store().sessions.find((s) => s.id === sessionId)!.entries[0];
    while (
      store().sessions.find((s) => s.id === sessionId)!.entries[0].sets.length < count
    ) {
      store().addSet(sessionId, entry.id);
    }
    for (const set of store().sessions.find((s) => s.id === sessionId)!.entries[0].sets.slice(
      0,
      count,
    )) {
      store().toggleSetLogged(sessionId, entry.id, set.id);
    }
    store().endSession(sessionId);
  }

  beforeEach(() => store().resetAll());

  it('says nothing for an exercise never recorded', async () => {
    // 896 rows, and a badge on every one of them would be noise rather than information.
    await renderList();
    await search('bench press');
    expect(screen.queryByTestId(`logged-${BENCH}`)).toBeNull();
  });

  it('counts the sets recorded', async () => {
    record(BENCH, 4);
    await renderList();
    await search('bench press');

    expect(screen.getByTestId(`logged-${BENCH}`)).toBeTruthy();
    expect(screen.getByText('4 sets')).toBeTruthy();
  });

  it('says "1 set", not "1 sets"', async () => {
    record(BENCH, 1);
    await renderList();
    await search('bench press');
    expect(screen.getByText('1 set')).toBeTruthy();
  });

  it('adds up across sessions', async () => {
    // The number is a lifetime total, not this week's - the question it answers is "is this one
    // of mine", and one heavy week does not make it so.
    record(BENCH, 3);
    record(BENCH, 2);
    await renderList();
    await search('bench press');
    expect(screen.getByText('5 sets')).toBeTruthy();
  });
});
