import { steerFor } from '../browser';

/**
 * Who gets told to switch browser.
 *
 * Both mistakes cost something. Missing a webview leaves someone unable to install the app with
 * no explanation, which is the whole reason this exists. Firing on real Safari or real Chrome
 * puts a banner over the app telling people to go where they already are, which is worse than
 * saying nothing at all, so the false positives are tested as carefully as the true ones.
 *
 * The agents below are real strings, not invented ones. Detection by user agent is guesswork
 * dressed as logic, and it only holds up against what devices actually send.
 */

const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iosInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.3.28.104 (iPhone14,5; iOS 17_5)',
  iosFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.44.107]',
  iPadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1',

  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidFirefox:
    'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  androidWebview:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0',

  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('who is left alone', () => {
  it('says nothing to Safari on an iPhone', () => {
    expect(steerFor(UA.iosSafari, false).kind).toBe('none');
  });

  it('says nothing to Safari on an iPad', () => {
    expect(steerFor(UA.iPadSafari, false).kind).toBe('none');
  });

  it('says nothing to Chrome on Android', () => {
    expect(steerFor(UA.androidChrome, false).kind).toBe('none');
  });

  it('says nothing on a desktop, where none of this applies', () => {
    expect(steerFor(UA.macSafari, false).kind).toBe('none');
    expect(steerFor(UA.windowsChrome, false).kind).toBe('none');
  });

  it('says nothing to someone who already installed it', () => {
    // Launched from the home screen. Telling them to install it would be wrong and rude.
    expect(steerFor(UA.iosChrome, true).kind).toBe('none');
    expect(steerFor(UA.androidSamsung, true).kind).toBe('none');
  });
});

describe('who gets pointed at Safari', () => {
  it.each([
    ['Chrome on iOS', UA.iosChrome],
    ['Firefox on iOS', UA.iosFirefox],
    ['the Instagram browser', UA.iosInstagram],
    ['the Facebook browser', UA.iosFacebook],
  ])('%s', (_name, agent) => {
    expect(steerFor(agent, false).kind).toBe('safari');
  });
});

describe('who gets a button that opens Chrome', () => {
  it.each([
    ['Samsung Internet', UA.androidSamsung],
    ['Firefox on Android', UA.androidFirefox],
    ['an embedded webview', UA.androidWebview],
    ['Edge on Android', UA.androidEdge],
  ])('%s', (_name, agent) => {
    expect(steerFor(agent, false).kind).toBe('chrome');
  });

  it('names Chrome explicitly and falls back if it is not installed', () => {
    const steer = steerFor(UA.androidSamsung, false);
    if (steer.kind !== 'chrome') throw new Error('expected a chrome steer');

    expect(steer.intentUrl).toContain('package=com.android.chrome');
    // Without a fallback, a phone with Chrome removed gets an error page instead of the app,
    // which is worse than the browser it was already in.
    expect(steer.intentUrl).toContain('S.browser_fallback_url=');
    expect(steer.intentUrl.startsWith('intent://')).toBe(true);
  });
});

describe('the edges', () => {
  it('says nothing when there is no user agent to read', () => {
    expect(steerFor('', false).kind).toBe('none');
  });

  it('does not mistake Samsung Internet for Chrome, though it claims to be', () => {
    // The trap: Samsung's agent carries "Chrome/126" as well as its own token.
    expect(UA.androidSamsung).toContain('Chrome/');
    expect(steerFor(UA.androidSamsung, false).kind).toBe('chrome');
  });

  it('does not mistake an iOS browser for Safari, though they all claim to be', () => {
    expect(UA.iosChrome).toContain('Safari/');
    expect(steerFor(UA.iosChrome, false).kind).toBe('safari');
  });
});
