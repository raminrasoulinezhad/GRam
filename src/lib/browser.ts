import { APP_URL } from './appLink';

/**
 * Which browser someone is in, and whether that is going to be a problem.
 *
 * WHY THIS EXISTS
 * GRam installs as a PWA and nothing else. There is no store listing and never will be, so
 * "Add to Home Screen" is the install, and that button only exists in two places: Safari on
 * iOS and Chrome on Android. Land in Firefox, Samsung Internet, or the webview inside
 * Instagram or LinkedIn, and there is simply no way to install the app - the menu item is not
 * there. The page works, the user reads "add it to your home screen", and nothing they tap
 * does that. It looks like the app is broken.
 *
 * WHAT CANNOT BE DONE, SO NOBODY TRIES IT AGAIN
 * A link cannot choose a browser on iOS. Every iOS browser is Safari's engine wearing a
 * different coat, and Apple ships no public URL scheme that opens Safari specifically
 * (`x-safari-https:` is private and does not work from a page or a QR code). So on iOS the
 * honest move is to say the words: Share, then Open in Safari.
 *
 * Android does have a scheme. `intent://` with an explicit package opens Chrome and only
 * Chrome. It cannot go in the QR code, because that string is unreadable rubbish to an
 * iPhone and one QR has to serve both, but it works perfectly well as a button on a page
 * someone has already reached.
 */

export type Steer =
  /** They are somewhere that can install the app. Say nothing. */
  | { kind: 'none' }
  /** iOS, wrong browser. All that can be offered is the instruction and the address. */
  | { kind: 'safari' }
  /** Android, wrong browser. This actually opens Chrome. */
  | { kind: 'chrome'; intentUrl: string };

/** Chrome, Firefox, Edge and Opera on iOS. All WebKit, none of them able to install a PWA. */
const IOS_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//;

/** Android browsers that are not Chrome. Note Samsung and Edge both also claim "Chrome/". */
const ANDROID_BROWSERS = /SamsungBrowser|OPR\/|EdgA\/|Firefox\/|UCBrowser|MiuiBrowser|HuaweiBrowser/;

/**
 * Apps that open links inside themselves rather than handing them to a browser.
 *
 * The likeliest way anyone reaches this link, given it gets shared in a message. Several of
 * these fake a convincing Safari or Chrome user agent, so the app's own token is the only
 * reliable tell.
 */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Twitter|MicroMessenger|Snapchat|Pinterest|TikTok|GSA\//;

/**
 * Opens Chrome and nothing else, falling back to a normal navigation if Chrome is absent.
 *
 * Without the fallback a phone with Chrome uninstalled gets an error page instead of the app,
 * which is a worse outcome than the browser it was already in.
 */
const CHROME_INTENT = `intent://${APP_URL.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(APP_URL)};end`;

/**
 * What to tell this visitor, from their user agent alone.
 *
 * `installed` covers the case that matters most: somebody who already added the app to their
 * home screen is launching it from there, and telling them to go and install it would be both
 * wrong and slightly insulting.
 */
export function steerFor(userAgent: string, installed: boolean): Steer {
  if (installed) return { kind: 'none' };

  const ios = /iPhone|iPad|iPod/.test(userAgent);
  const android = /Android/.test(userAgent);
  if (!ios && !android) return { kind: 'none' };

  const inApp = IN_APP.test(userAgent);

  if (ios) {
    // Real Safari says "Safari/" and carries no other browser's token. Everything else on iOS
    // either adds its own or, in the case of a bare webview, drops Safari entirely.
    const safari = /Safari\//.test(userAgent) && !IOS_BROWSERS.test(userAgent) && !inApp;
    return safari ? { kind: 'none' } : { kind: 'safari' };
  }

  // "; wv)" is Android's own marker for a webview embedded in another app.
  const webview = /; wv\)/.test(userAgent);
  const chrome =
    /Chrome\//.test(userAgent) && !ANDROID_BROWSERS.test(userAgent) && !webview && !inApp;
  return chrome ? { kind: 'none' } : { kind: 'chrome', intentUrl: CHROME_INTENT };
}
