import { fireEvent, render, screen } from '@testing-library/react-native';
import { RECOMMENDED } from '@/catalog';
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
    expect(screen.getByPlaceholderText('Search 879 exercises, or a muscle')).toBeTruthy();
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
