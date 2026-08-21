import { useState } from 'react';
import { act, render } from '@testing-library/react-native';
import { useWakeLock } from '@/lib/wakeLock';

/*
 * The screen staying on during a timed set.
 *
 * None of this can be checked by looking at the app, which is exactly why it is worth pinning
 * down: the failure mode is a display that dims sixty seconds into a plank, on somebody else's
 * phone, with nothing logged anywhere. So the browser API is stood up in full - including the
 * part where the browser quietly takes the lock back - and the hook is held to it.
 *
 * ONE render() PER TEST, AND NO rerender()/unmount()
 * Calling either detaches this library's renderer for the remainder of the file: every later
 * test then renders nothing at all and fails claiming the hook never ran. It has bitten this
 * codebase before. So the component under test is wrapped in a harness that owns both its prop
 * and whether it exists, and both are changed from inside React instead.
 */

type FakeSentinel = { released: boolean; release: jest.Mock };

let granted: FakeSentinel[];
let request: jest.Mock;
/** Set to make `request` reject, the way a hidden page does. */
let refuse: Error | null;

function makeSentinel(): FakeSentinel {
  const sentinel: FakeSentinel = {
    released: false,
    release: jest.fn(async () => {
      sentinel.released = true;
    }),
  };
  return sentinel;
}

/*
 * There is no DOM here; these tests run in the native environment like the rest of the suite.
 * Building the two globals by hand is not a workaround but the point, because it pins down
 * exactly how little of a browser the hook is allowed to assume.
 */
type Listener = () => void;

let listeners: Set<Listener>;

/** The browser objects the hook looks for, and a function to put the globals back. */
function installApi() {
  granted = [];
  refuse = null;
  listeners = new Set();
  request = jest.fn(async (type: string) => {
    expect(type).toBe('screen');
    if (refuse) throw refuse;
    const sentinel = makeSentinel();
    granted.push(sentinel);
    return sentinel;
  });

  const g = globalThis as Record<string, unknown>;
  const hadNavigator = 'navigator' in g;
  const hadDocument = 'document' in g;
  g.navigator = { wakeLock: { request } };
  g.document = {
    visibilityState: 'visible',
    addEventListener: (type: string, fn: Listener) => {
      if (type === 'visibilitychange') listeners.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      if (type === 'visibilitychange') listeners.delete(fn);
    },
  };

  return () => {
    if (!hadNavigator) delete g.navigator;
    if (!hadDocument) delete g.document;
  };
}

/** What the document reports, and the event that says it changed. */
function setVisibility(state: 'visible' | 'hidden') {
  const doc = (globalThis as Record<string, unknown>).document as { visibilityState: string };
  doc.visibilityState = state;
  for (const fn of [...listeners]) fn();
}

function Holder({ active }: { active: boolean }) {
  useWakeLock(active);
  return null;
}

/** Set by the harness on its first render; both drive React from inside. */
let setActive: (on: boolean) => void;
let setMounted: (on: boolean) => void;

function Harness({ start }: { start: boolean }) {
  const [active, onActive] = useState(start);
  const [mounted, onMounted] = useState(true);
  setActive = onActive;
  setMounted = onMounted;
  return mounted ? <Holder active={active} /> : null;
}

/** Mounts the harness and lets the first wake lock request settle. */
async function mount(start = true) {
  await render(<Harness start={start} />);
  await act(async () => undefined);
}

let uninstall: () => void;

beforeEach(() => {
  uninstall = installApi();
});

afterEach(() => uninstall());

describe('holding the screen awake', () => {
  it('takes a lock as soon as it is asked to', async () => {
    await mount();

    expect(request).toHaveBeenCalledTimes(1);
    expect(granted).toHaveLength(1);
    expect(granted[0].released).toBe(false);
  });

  it('takes nothing while inactive', async () => {
    await mount(false);

    expect(request).not.toHaveBeenCalled();
  });

  it('releases when it stops being wanted', async () => {
    await mount();

    await act(async () => setActive(false));

    expect(granted[0].release).toHaveBeenCalled();
  });

  it('releases when it goes away, so a closed sheet cannot leave the display burning', async () => {
    await mount();

    await act(async () => setMounted(false));

    expect(granted[0].release).toHaveBeenCalled();
  });

  /*
   * The case that motivated re-requesting at all. The browser drops the lock when the page is
   * hidden and does not hand it back, so without this the screen stayed on right up until you
   * glanced at a message and came back, and then died mid-set.
   */
  it('takes a fresh lock when the page comes back into view', async () => {
    await mount();
    expect(request).toHaveBeenCalledTimes(1);

    // What the browser does on its way out: released by it, not by us.
    granted[0].released = true;
    await act(async () => setVisibility('hidden'));
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));

    expect(request).toHaveBeenCalledTimes(2);
    expect(granted[1].released).toBe(false);
  });

  it('does not stack a second lock while the first is still held', async () => {
    await mount();

    await act(async () => setVisibility('visible'));

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops listening once inactive, so a hidden tab cannot re-arm it', async () => {
    await mount();
    await act(async () => setActive(false));

    await act(async () => setVisibility('visible'));

    expect(request).toHaveBeenCalledTimes(1);
  });

  /*
   * A rejection is ordinary, not exceptional: ask from a hidden page, or on a browser wanting a
   * gesture it did not get, and it throws. The timer must not care.
   */
  it('carries on when the browser refuses', async () => {
    refuse = new Error('NotAllowedError');

    await expect(mount()).resolves.toBeUndefined();

    expect(granted).toHaveLength(0);
  });

  /*
   * The race worth a test of its own. Stopping a set early can tear this down inside the gap
   * between asking for the lock and being handed it, and a sentinel arriving after the cleanup
   * has run would otherwise be held by nobody, for the rest of the session.
   */
  it('releases a lock granted after it was already told to stop', async () => {
    let hand: (s: FakeSentinel) => void = () => undefined;
    const late = makeSentinel();
    request.mockImplementationOnce(
      () =>
        new Promise<FakeSentinel>((resolve) => {
          hand = resolve;
        }),
    );

    await render(<Harness start />);
    await act(async () => setMounted(false));
    await act(async () => hand(late));

    expect(late.release).toHaveBeenCalled();
  });

  it('is inert where the browser has no wake lock at all', async () => {
    const nav = (globalThis as Record<string, unknown>).navigator as Record<string, unknown>;
    delete nav.wakeLock;

    await expect(mount()).resolves.toBeUndefined();
  });
});
