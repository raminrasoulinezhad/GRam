import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HoldTimer, LEAD_IN_SEC } from '@/ui/HoldTimer';
import { RestTimer } from '@/ui/RestTimer';

jest.mock('@/lib/beep', () => ({ beep: jest.fn(), primeBeep: jest.fn() }));

/*
 * The screen not going dark while a clock is running.
 *
 * The hook itself is tested in src/lib/__tests__/wakeLock.test.tsx. What is checked here is the
 * wiring, which is the half that actually broke: a timed set is the one moment nobody touches
 * the phone, so the display used to dim halfway through a plank and lock before the beep. And
 * the mirror of that bug matters just as much - a timer that takes the lock and never gives it
 * back would hold the screen on for the rest of the workout.
 */

type FakeSentinel = { released: boolean; release: jest.Mock };

let granted: FakeSentinel[];
let request: jest.Mock;
let restore: () => void;

/** True while at least one lock is outstanding. */
const holding = () => granted.some((s) => !s.released);

beforeEach(() => {
  jest.useFakeTimers();
  granted = [];
  request = jest.fn(async () => {
    const sentinel: FakeSentinel = {
      released: false,
      release: jest.fn(async () => {
        sentinel.released = true;
      }),
    };
    granted.push(sentinel);
    return sentinel;
  });

  const g = globalThis as Record<string, unknown>;
  const hadNavigator = 'navigator' in g;
  const hadDocument = 'document' in g;
  g.navigator = { wakeLock: { request } };
  g.document = {
    visibilityState: 'visible',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  restore = () => {
    if (!hadNavigator) delete g.navigator;
    if (!hadDocument) delete g.document;
  };
});

afterEach(() => {
  restore();
  jest.useRealTimers();
});

/** Moves the clock and runs the repaints, then lets the wake lock promise settle. */
async function passSeconds(seconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(seconds * 1000);
  });
}

describe('a timed set', () => {
  it('does not hold the screen before Start is pressed', async () => {
    await render(<HoldTimer target={60} onDone={jest.fn()} onClose={jest.fn()} />);
    await act(async () => undefined);

    expect(request).not.toHaveBeenCalled();
  });

  it('holds the screen from the lead-in onwards', async () => {
    await render(<HoldTimer target={60} onDone={jest.fn()} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await act(async () => undefined);

    // The lead-in counts too: you are already on the floor getting into position.
    expect(holding()).toBe(true);

    await passSeconds(LEAD_IN_SEC + 10);

    expect(screen.getByTestId('hold-remaining')).toBeTruthy();
    expect(holding()).toBe(true);
  });

  it('lets the screen go once the set is recorded', async () => {
    await render(<HoldTimer target={5} onDone={jest.fn()} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC + 5);

    expect(screen.getByTestId('hold-done')).toBeTruthy();
    expect(holding()).toBe(false);
  });

  it('lets the screen go when the set is stopped early', async () => {
    await render(<HoldTimer target={600} onDone={jest.fn()} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC + 20);

    await fireEvent.press(screen.getByTestId('hold-finish'));
    await act(async () => undefined);

    expect(holding()).toBe(false);
  });
});

describe('resting between sets', () => {
  it('holds the screen while the countdown runs', async () => {
    await render(<RestTimer startedAt={Date.now()} seconds={90} onDismiss={jest.fn()} />);
    await act(async () => undefined);

    expect(holding()).toBe(true);
  });

  it('holds nothing when there is no rest running', async () => {
    await render(<RestTimer startedAt={null} seconds={90} onDismiss={jest.fn()} />);
    await act(async () => undefined);

    expect(request).not.toHaveBeenCalled();
  });

  /*
   * The bar stays on screen until it is dismissed, and it is easy not to dismiss it. If the
   * lock outlived the countdown, one forgotten bar would keep the display lit for the rest of
   * the session.
   */
  it('lets the screen go the moment the rest is over', async () => {
    await render(<RestTimer startedAt={Date.now()} seconds={30} onDismiss={jest.fn()} />);
    await passSeconds(31);

    expect(screen.getByText('Rest complete')).toBeTruthy();
    expect(holding()).toBe(false);
  });
});
