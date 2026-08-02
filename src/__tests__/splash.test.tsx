import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Splash } from '@/ui/Splash';
import { useStore } from '@/store/useStore';

/** Advances timers and lets the resulting state updates flush. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
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
