import { Linking, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OpenInBrowser } from '@/ui/OpenInBrowser';

/**
 * The bar that tells someone in the wrong browser how to get out of it.
 *
 * The detection is tested on its own in src/lib/__tests__/browser.test.ts. What is left here is
 * what the bar does with the answer, and the two ways a banner like this goes wrong: it appears
 * where it is not wanted, or its one useful button does not work.
 */

const IOS_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.3.28.104';
const ANDROID_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/**
 * There is no `navigator` in the test environment, so one is stood up per test. The component
 * reads it defensively for exactly this reason: a webview that hides it must not crash the app.
 */
let clipboard: { writeText: jest.Mock } | undefined;

function pretend(agent: string, standalone = false) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: agent, standalone, clipboard },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  // The component is web-only. jest-expo reports ios, so this is the switch that lets it render.
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  // @ts-expect-error putting the environment back the way it was found
  delete globalThis.navigator;
});

describe('when it stays out of the way', () => {
  it('shows nothing in Safari on an iPhone', async () => {
    pretend(IOS_SAFARI);
    await render(<OpenInBrowser />);

    expect(screen.queryByTestId('open-in-browser')).toBeNull();
  });

  it('shows nothing in a native build, which is not in a browser at all', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    expect(screen.queryByTestId('open-in-browser')).toBeNull();
  });

  it('goes away when dismissed', async () => {
    pretend(ANDROID_SAMSUNG);
    await render(<OpenInBrowser />);

    await fireEvent.press(screen.getByTestId('open-dismiss'));
    expect(screen.queryByTestId('open-in-browser')).toBeNull();
  });
});

describe('on iOS, where Safari cannot be forced', () => {
  it('says how to get to Safari, since no link can do it', async () => {
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    expect(screen.getByTestId('open-in-browser')).toBeTruthy();
    expect(screen.getByText(/Open in Safari/)).toBeTruthy();
  });

  it('offers the address on the clipboard, not a button that cannot work', async () => {
    // Retyping a URL off a screen is where people give up, and there is nothing else to give.
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    expect(screen.getByTestId('open-copy')).toBeTruthy();
    expect(screen.queryByTestId('open-chrome')).toBeNull();
  });

  it('confirms the copy, so the tap does not feel dead', async () => {
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    await fireEvent.press(screen.getByTestId('open-copy'));
    expect(clipboard?.writeText).toHaveBeenCalledWith('https://grambygram.netlify.app');
    expect(await screen.findByText('Link copied')).toBeTruthy();
  });

  it('survives a browser with no clipboard at all', async () => {
    // Absent on insecure origins and inside several webviews.
    clipboard = undefined;
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    await fireEvent.press(screen.getByTestId('open-copy'));
    expect(screen.getByTestId('open-in-browser')).toBeTruthy();
  });

  it('survives a clipboard that rejects, which is what iOS actually does', async () => {
    /*
     * The one that caught me. `navigator.clipboard` exists, so the optional chain passes and
     * the synchronous try/catch sees nothing wrong, and then writeText rejects because the
     * document is not focused. Uncaught, that is an unhandled rejection on top of a screen the
     * user is reading.
     */
    clipboard = { writeText: jest.fn().mockRejectedValue(new Error('Document is not focused')) };
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    await fireEvent.press(screen.getByTestId('open-copy'));
    expect(screen.getByText('Copy link')).toBeTruthy();
    expect(screen.getByTestId('open-in-browser')).toBeTruthy();
  });

  it('prints the address too, since the clipboard cannot be relied on', async () => {
    pretend(IOS_INSTAGRAM);
    await render(<OpenInBrowser />);

    expect(screen.getByText('grambygram.netlify.app')).toBeTruthy();
  });
});

describe('on Android, where Chrome can be opened outright', () => {
  it('offers a button that names Chrome in the intent', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    pretend(ANDROID_SAMSUNG);
    await render(<OpenInBrowser />);

    await fireEvent.press(screen.getByTestId('open-chrome'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('package=com.android.chrome'));
    open.mockRestore();
  });

  it('survives a phone that cannot handle the intent', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no activity'));
    pretend(ANDROID_SAMSUNG);
    await render(<OpenInBrowser />);

    await fireEvent.press(screen.getByTestId('open-chrome'));
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });
});
