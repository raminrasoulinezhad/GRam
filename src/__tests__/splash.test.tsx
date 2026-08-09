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
   * Not a launch: the user tapped a colour a second ago and is still on the page they tapped it
   * from. But the hydration gap is real on this path too, so a cover is unavoidable - and since
   * it is unavoidable it carries the logo, because a blank coloured screen reads as a glitch.
   *
   * What goes is the brand delay. These tests are about the timing, not the artwork.
   */
  beforeEach(() => {
    mockQuiet = true;
  });

  it('still covers the gap, logo and all', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    expect(screen.getByTestId('splash')).toBeTruthy();
    expect(screen.getByLabelText('GRam')).toBeTruthy();
  });

  it('lifts without waiting out the brand moment', async () => {
    await render(
      <Splash>
        <Text>Plans</Text>
      </Splash>,
    );

    // The launch path is still showing at this point; see the 1000ms assertion above.
    await advance(600);
    expect(screen.queryByTestId('splash')).toBeNull();
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
    expect(screen.queryByTestId('splash')).toBeNull();

    hasHydrated.mockRestore();
    onFinish.mockRestore();
  });
});
