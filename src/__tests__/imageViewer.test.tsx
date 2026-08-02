import { fireEvent, render, screen } from '@testing-library/react-native';
import { getExercise } from '@/catalog';
import { useStore } from '@/store/useStore';
import { ExerciseDetail } from '@/ui/ExerciseDetail';
import { ImageViewer } from '@/ui/ImageViewer';
import { MAX_SCALE } from '@/ui/zoom';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const store = () => useStore.getState();

const PHOTOS = [
  { uri: 'https://example.test/0.jpg', caption: 'START' },
  { uri: 'https://example.test/1.jpg', caption: 'FINISH' },
];

beforeEach(() => {
  store().resetAll();
});

describe('the full-screen photo viewer', () => {
  const scale = () => screen.getByTestId('viewer-scale').props.children;

  it('renders nothing at all while closed', async () => {
    await render(<ImageViewer images={PHOTOS} index={null} onClose={jest.fn()} />);
    expect(screen.queryByTestId('viewer-close')).toBeNull();
  });

  it('opens on the photo that was tapped, not the first one', async () => {
    await render(<ImageViewer images={PHOTOS} index={1} onClose={jest.fn()} />);
    expect(screen.getByText('FINISH')).toBeTruthy();
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    await render(<ImageViewer images={PHOTOS} index={0} onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('viewer-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zooms in and back out from the buttons', async () => {
    await render(<ImageViewer images={PHOTOS} index={0} onClose={jest.fn()} />);
    expect(scale()).toBe('100%');

    await fireEvent.press(screen.getByTestId('viewer-zoom-in'));
    expect(scale()).toBe('150%');

    await fireEvent.press(screen.getByTestId('viewer-zoom-out'));
    expect(scale()).toBe('100%');
  });

  it('will not zoom out past fitted, or in past the limit', async () => {
    await render(<ImageViewer images={PHOTOS} index={0} onClose={jest.fn()} />);

    for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByTestId('viewer-zoom-out'));
    expect(scale()).toBe('100%');

    for (let i = 0; i < 20; i++) await fireEvent.press(screen.getByTestId('viewer-zoom-in'));
    expect(scale()).toBe(`${MAX_SCALE * 100}%`);
  });

  it('steps between the start and finish frames without closing', async () => {
    await render(<ImageViewer images={PHOTOS} index={0} onClose={jest.fn()} />);
    expect(screen.getByText('START')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('viewer-next'));
    expect(screen.getByText('FINISH')).toBeTruthy();

    // And wraps, so two frames are a loop rather than a dead end.
    await fireEvent.press(screen.getByTestId('viewer-next'));
    expect(screen.getByText('START')).toBeTruthy();
  });

  it('returns to fitted when the other frame is stepped to', async () => {
    await render(<ImageViewer images={PHOTOS} index={0} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('viewer-zoom-in'));
    expect(scale()).toBe('150%');

    await fireEvent.press(screen.getByTestId('viewer-next'));

    // A zoom set for one photo means nothing on the next, and being dropped into a corner of
    // an image you have not seen yet is disorienting.
    expect(scale()).toBe('100%');
  });

  it('hides the stepping controls when there is only one photo', async () => {
    await render(<ImageViewer images={[PHOTOS[0]]} index={0} onClose={jest.fn()} />);
    expect(screen.queryByTestId('viewer-next')).toBeNull();
    expect(screen.queryByTestId('viewer-prev')).toBeNull();
    expect(screen.getByTestId('viewer-close')).toBeTruthy();
  });

  it('renders nothing rather than crashing on an index past the end', async () => {
    await render(<ImageViewer images={PHOTOS} index={9} onClose={jest.fn()} />);
    expect(screen.queryByTestId('viewer-close')).toBeNull();
  });
});

describe('opening a photo from an exercise description', () => {
  it('is closed until a photo is tapped', async () => {
    await render(<ExerciseDetail exerciseId={BENCH} />);
    expect(screen.queryByTestId('viewer-close')).toBeNull();
  });

  it('opens the tapped photo full screen', async () => {
    await render(<ExerciseDetail exerciseId={BENCH} />);

    await fireEvent.press(screen.getByTestId('photo-1'));

    expect(screen.getByTestId('viewer-close')).toBeTruthy();
    expect(screen.getByTestId('viewer-image').props.source).toEqual({
      uri: expect.stringContaining(getExercise(BENCH)!.images[1]),
    });
  });

  it('closes again and leaves the description behind it', async () => {
    await render(<ExerciseDetail exerciseId={BENCH} />);
    await fireEvent.press(screen.getByTestId('photo-0'));

    await fireEvent.press(screen.getByTestId('viewer-close'));

    expect(screen.queryByTestId('viewer-close')).toBeNull();
    expect(screen.getByText('How to')).toBeTruthy();
  });

  it('has no photos to open when photos are switched off', async () => {
    store().updateSettings({ showExercisePhotos: false });
    await render(<ExerciseDetail exerciseId={BENCH} />);

    expect(screen.queryByTestId('photo-0')).toBeNull();
  });
});
