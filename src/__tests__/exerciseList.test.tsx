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
