import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Splash } from '@/ui/Splash';
import { useStore } from '@/store/useStore';

let mockQuiet = false;
jest.mock('@/ui/themeReload', () => ({
  isThemeReload: () => mockQuiet,
}));

/** Advances timers and lets the resulting state updates flush. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockQuiet = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('splash screen', () => {
  it('covers the app while starting up', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    expect(screen.getByTestId('splash')).toBeTruthy();
  });

  it('gets out of the way once the minimum time has passed', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    // Still up while the brand moment plays.
    await advance(1000);
    expect(screen.queryByTestId('splash')).toBeTruthy();

    // Minimum display plus the fade.
    await advance(1500);
    expect(screen.queryByTestId('splash')).toBeNull();
  });

  it('leaves the app usable underneath rather than replacing it', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    // Children mount immediately, so the app is warm by the time the logo lifts.
    expect(screen.getByText('Plans')).toBeTruthy();
  });

  it('never traps the user behind the logo if storage never resolves', async () => {
    // Pretend rehydration is still pending and no completion event ever arrives.
    const hasHydrated = jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(false);
    const onFinish = jest
      .spyOn(useStore.persist, 'onFinishHydration')
      .mockImplementation(() => () => {});

    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    expect(screen.getByTestId('splash')).toBeTruthy();

    // The backstop fires even though hydration never finished.
    await advance(6000);
    expect(screen.queryByTestId('splash')).toBeNull();

    hasHydrated.mockRestore();
    onFinish.mockRestore();
  });

  it('does not block touches on its way out', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    expect(screen.getByTestId('splash').props.pointerEvents).toBe('none');
  });
});

describe('coming back from a theme change', () => {
  /*
   * Not a launch. The user tapped a colour a second ago and is still on the page they tapped it
   * from, so the logo would turn a setting into an event - and waiting out the brand moment
   * would make trying a second colour cost two seconds.
   *
   * The cover stays, because the hydration gap is real on this path too; it is just the
   * background with nothing on it, and it lifts as soon as the store is ready.
   */
  beforeEach(() => {
    mockQuiet = true;
  });

  it('shows no logo', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    expect(screen.queryByTestId('splash')).toBeNull();
    expect(screen.getByTestId('splash-quiet')).toBeTruthy();
  });

  it('still covers the gap before the store has loaded', async () => {
    // Without this the page paints defaults for a frame and then snaps to the real data - the
    // same flash the logo screen exists to hide.
    const hasHydrated = jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(false);
    const onFinish = jest
      .spyOn(useStore.persist, 'onFinishHydration')
      .mockImplementation(() => () => {});

    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );
    expect(screen.getByTestId('splash-quiet')).toBeTruthy();

    hasHydrated.mockRestore();
    onFinish.mockRestore();
  });

  it('lifts without waiting out the brand moment', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    // The logo path is still up at 1000ms; this one is long gone.
    await advance(600);
    expect(screen.queryByTestId('splash-quiet')).toBeNull();
  });

  it('still cannot strand anyone if storage never resolves', async () => {
    const hasHydrated = jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(false);
    const onFinish = jest
      .spyOn(useStore.persist, 'onFinishHydration')
      .mockImplementation(() => () => {});

    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );
    await advance(4000);
    expect(screen.queryByTestId('splash-quiet')).toBeNull();

    hasHydrated.mockRestore();
    onFinish.mockRestore();
  });
});
