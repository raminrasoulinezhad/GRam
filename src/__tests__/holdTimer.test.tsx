import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HoldTimer, LEAD_IN_SEC } from '@/ui/HoldTimer';

const mockBeep = jest.fn();
const mockPrime = jest.fn();
jest.mock('@/lib/beep', () => ({
  beep: (kind: string) => mockBeep(kind),
  primeBeep: () => mockPrime(),
}));

/** Which sounds have fired, in order. Which one is as much the point as how many. */
const sounded = (): string[] => mockBeep.mock.calls.map(([kind]) => kind);

/*
 * Timing a plank.
 *
 * Jest's fake timers move Date.now along with the scheduled callbacks, which is what makes the
 * anchoring testable at all: `skipAhead` below moves the clock WITHOUT running the repaints,
 * which is exactly what a throttled tab or a sleeping phone does to this component.
 */

const onDone = jest.fn();
const onClose = jest.fn();

/** Awaited, because render resolves asynchronously here and `screen` is empty until it does. */
async function show(target = 60) {
  await render(<HoldTimer target={target} onDone={onDone} onClose={onClose} />);
}

/** Time passing normally: the clock moves and the repaints happen. */
async function passSeconds(seconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(seconds * 1000);
  });
}

/** Time passing while nothing repaints - a backgrounded tab, or a phone asleep. */
async function skipAhead(seconds: number) {
  jest.setSystemTime(Date.now() + seconds * 1000);
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('before it is started', () => {
  it('shows the target and waits', async () => {
    await show(90);
    expect(screen.getByTestId('hold-target')).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();
    expect(screen.getByTestId('hold-start')).toBeTruthy();
  });

  it('records nothing until asked', async () => {
    await show();
    await passSeconds(30);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('the lead-in', () => {
  it('counts down from five so you can get into position', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('hold-start'));

    expect(screen.getByTestId('hold-leadin')).toBeTruthy();
    expect(screen.getByText(String(LEAD_IN_SEC))).toBeTruthy();

    await passSeconds(2);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('opens the audio device on the tap, not when the beep is due', async () => {
    /*
     * Browsers only allow audio to start inside a user gesture, and the beep is wanted a minute
     * later. Priming during the tap is the whole reason the sound works at all.
     */
    await show();
    await fireEvent.press(screen.getByTestId('hold-start'));
    expect(mockPrime).toHaveBeenCalledTimes(1);
  });

  it('does not start counting the set during it', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC - 1);

    expect(screen.queryByTestId('hold-remaining')).toBeNull();
  });

  it('hands over to the set when it runs out', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC);

    expect(screen.getByTestId('hold-remaining')).toBeTruthy();
    expect(screen.queryByTestId('hold-leadin')).toBeNull();
  });

  it('can be abandoned without recording anything', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('hold-start'));
    await fireEvent.press(screen.getByTestId('hold-finish'));

    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the sounds', () => {
  /*
   * Three moments, three different sounds, and the middle one is the one that has to work: the
   * phone is on the floor by then and "the clock has started" cannot be conveyed any other way.
   * Testing the KIND rather than the count is what stops a refactor from quietly reducing all
   * three to the same tone, which would still pass a count.
   */
  it('sounds when Start is pressed', async () => {
    await show(60);
    await fireEvent.press(screen.getByTestId('hold-start'));
    expect(sounded()).toEqual(['press']);
  });

  it('sounds when the lead-in expires and the set begins', async () => {
    await show(60);
    await fireEvent.press(screen.getByTestId('hold-start'));
    expect(sounded()).not.toContain('go');

    await passSeconds(LEAD_IN_SEC);
    expect(sounded()).toEqual(['press', 'go']);
  });

  it('sounds once at the handover, not on every repaint of the set', async () => {
    await show(120);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC + 20);
    expect(sounded().filter((k) => k === 'go')).toHaveLength(1);
  });

  it('gives starting and finishing different sounds', async () => {
    // If they were the same, a beep heard from the floor would not say which one it was.
    await show(60);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC + 5);
    await fireEvent.press(screen.getByTestId('hold-finish'));

    const [first] = sounded();
    const last = sounded()[sounded().length - 1];
    expect(first).not.toBe(last);
  });

  it('stays quiet when the lead-in is cancelled', async () => {
    // Nothing was held and nothing was recorded, so there is nothing to announce.
    await show(60);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(2);
    await fireEvent.press(screen.getByTestId('hold-finish'));

    expect(sounded()).toEqual(['press']);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('the set itself', () => {
  /** Starts and clears the lead-in, leaving the timer running from zero. */
  async function begin(target = 60) {
    await show(target);
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC);
  }

  it('counts down the time left, not up', async () => {
    // "How much longer" is the question mid-plank; reading it off an ascending number means
    // doing arithmetic while shaking.
    await begin(60);
    await passSeconds(20);

    expect(screen.getByText('40s')).toBeTruthy();
  });

  it('does not count the lead-in as part of the set', async () => {
    await begin(60);
    expect(screen.getByText('1:00')).toBeTruthy();
  });

  it('beeps and records the target when the time is up', async () => {
    await begin(30);
    await passSeconds(30);

    expect(sounded()).toEqual(['press', 'go', 'done']);
    expect(onDone).toHaveBeenCalledWith(30);
  });

  it('sounds the end once, not on every tick afterwards', async () => {
    await begin(30);
    await passSeconds(45);
    expect(sounded().filter((k) => k === 'done')).toHaveLength(1);
  });

  it('records what was actually held when stopped early', async () => {
    await begin(60);
    await passSeconds(22);
    await fireEvent.press(screen.getByTestId('hold-finish'));

    expect(onDone).toHaveBeenCalledWith(22);
    // Finishing by hand is the same event as running out of time, and sounds the same.
    expect(sounded()).toEqual(['press', 'go', 'done']);
  });

  it('still says it was stopped early after the set has been rewritten', async () => {
    /*
     * Found in a browser, not here. Finishing writes the held time into the same field the
     * target is read from, so the component re-rendered with target = 7 after a 7-second hold
     * of a 45-second plank - and congratulated the user on completing it. The goal is frozen at
     * mount for exactly this reason; this is what would notice if that were undone.
     */
    const { rerender } = await render(
      <HoldTimer target={45} onDone={onDone} onClose={onClose} />,
    );
    await fireEvent.press(screen.getByTestId('hold-start'));
    await passSeconds(LEAD_IN_SEC + 7);
    await fireEvent.press(screen.getByTestId('hold-finish'));

    // The set now says 7 seconds, so the parent re-renders the sheet with that as the target.
    await act(async () => {
      rerender(<HoldTimer target={7} onDone={onDone} onClose={onClose} />);
    });

    expect(screen.getByText('Stopped early, and recorded.')).toBeTruthy();
  });

  it('survives a gap in the repaints without losing time', async () => {
    /*
     * The property the whole design turns on. A backgrounded tab is throttled to roughly one
     * timer a second, and a sleeping phone stops them entirely - so the number on screen has to
     * come from the clock, never from how many times the interval managed to fire.
     */
    await begin(120);
    await skipAhead(47);

    expect(screen.getByText('1:13')).toBeTruthy();
  });
});
