import { Platform } from 'react-native';

/**
 * Sending a note to whoever maintains this.
 *
 * WHY THERE IS NO EMAIL ADDRESS IN THIS FILE
 * The obvious build is a `mailto:` with the address in it, or a fetch to an inbox API with a
 * key. Both put the address in the JavaScript bundle, and a bundle is a file anyone can
 * download - devtools, `curl`, View Source on a phone. Base64 or a string split across
 * variables does not change that; it costs an attacker one console command and costs the reader
 * of this code the truth. So the address is not here, and there is nothing here to find.
 *
 * Instead the note is posted to the site's own origin as a Netlify form submission. Netlify
 * matches it against the hidden form declared in public/index.html, and mails it on to whatever
 * address is configured in the Netlify dashboard - which is server-side settings, not code. The
 * repository never learns the address, this bundle never carries it, and changing it later is a
 * dashboard edit rather than a release.
 *
 * WHAT TRAVELS
 * The typed message and the app version. Not the name in Profile, not a single logged set, not
 * a device id. The card that calls this says so on screen, and this is where that promise is
 * either kept or broken - so keep the field list below short and obvious.
 */

/** Must match the `name` of the hidden form in public/index.html. Netlify pairs them by this. */
export const FEEDBACK_FORM = 'gram-feedback';

/**
 * Where the submission goes when there is no page origin to post to - Expo Go, or a native
 * build. The public address of the site, which is on the front of the README; it is not a
 * secret and it is not an inbox.
 */
export const FEEDBACK_ORIGIN = 'https://grambygram.netlify.app';

/** Long enough for a paragraph of detail, short enough that a stuck key cannot post a novel. */
export const MAX_FEEDBACK_CHARS = 1500;

export type SendResult = 'sent' | 'failed';

/**
 * Posts the note. Resolves rather than throwing: the caller has a message box on screen holding
 * text the user typed, and the one unacceptable outcome is losing it to an unhandled rejection.
 */
export async function sendFeedback(message: string, version: string): Promise<SendResult> {
  const trimmed = message.trim();
  if (trimmed.length === 0) return 'failed';

  /*
   * Relative on web so it works on localhost and on a deploy preview as well as in production -
   * a form that only submits from one hostname is one nobody tests until it is broken.
   */
  const url = Platform.OS === 'web' ? '/' : `${FEEDBACK_ORIGIN}/`;

  const body = new URLSearchParams({
    'form-name': FEEDBACK_FORM,
    message: trimmed.slice(0, MAX_FEEDBACK_CHARS),
    version,
    // The honeypot Netlify checks. Empty from a human; a bot fills every field it finds.
    'bot-field': '',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    // Offline, or the gym has no signal. Indistinguishable from here, and the caller says so.
    return 'failed';
  }
}
