import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  FEEDBACK_FORM,
  FEEDBACK_ORIGIN,
  MAX_FEEDBACK_CHARS,
  sendFeedback,
} from '@/lib/feedback';
import { FeedbackCard } from '@/ui/FeedbackCard';

/**
 * The one thing in this app that sends anything anywhere.
 *
 * Two separate promises are under test. The first is behavioural: a note that fails to send
 * must leave every word of it on screen, because the usual reason it fails is no signal and
 * retyping a bug report is how people decide not to file the next one. The second is a contract
 * with a file this code cannot import - the hidden form in public/index.html that Netlify parses
 * at deploy time. Field names that drift apart produce a 404 nobody sees.
 */

const INDEX_HTML = readFileSync(
  resolve(__dirname, '..', '..', 'public', 'index.html'),
  'utf8',
);

const originalFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true });
  // A stand-in for the browser's fetch: only the two arguments this code passes are honoured.
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('what gets posted', () => {
  it('sends the message and the version, and nothing else', async () => {
    // The card promises this on screen in as many words. This is where it is kept.
    await sendFeedback('the wheel skips 12', '1.9.0');

    const [, init] = fetchMock.mock.calls[0];
    const sent = new URLSearchParams(init.body as string);
    expect([...sent.keys()].sort()).toEqual(['bot-field', 'form-name', 'message', 'version']);
    expect(sent.get('message')).toBe('the wheel skips 12');
    expect(sent.get('version')).toBe('1.9.0');
  });

  it('names the form Netlify is looking for', async () => {
    await sendFeedback('hello', '1.0.0');
    const [, init] = fetchMock.mock.calls[0];
    expect(new URLSearchParams(init.body as string).get('form-name')).toBe(FEEDBACK_FORM);
  });

  it('posts form-encoded to the site itself, not to a third party', async () => {
    await sendFeedback('hello', '1.0.0');
    const [url, init] = fetchMock.mock.calls[0];
    /*
     * Relative on the web so it works on localhost and on a deploy preview as well as in
     * production; absolute where there is no page origin to be relative to. Either way it is
     * this app's own host, which is the part that matters - nothing here talks to anyone else.
     */
    expect(url).toBe(Platform.OS === 'web' ? '/' : `${FEEDBACK_ORIGIN}/`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('leaves the honeypot empty', async () => {
    await sendFeedback('hello', '1.0.0');
    const [, init] = fetchMock.mock.calls[0];
    expect(new URLSearchParams(init.body as string).get('bot-field')).toBe('');
  });

  it('trims, and refuses to send whitespace', async () => {
    expect(await sendFeedback('   ', '1.0.0')).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();

    await sendFeedback('  spaced  ', '1.0.0');
    const [, init] = fetchMock.mock.calls[0];
    expect(new URLSearchParams(init.body as string).get('message')).toBe('spaced');
  });

  it('caps the length rather than posting a stuck key forever', async () => {
    await sendFeedback('x'.repeat(MAX_FEEDBACK_CHARS * 3), '1.0.0');
    const [, init] = fetchMock.mock.calls[0];
    expect(new URLSearchParams(init.body as string).get('message')!.length).toBe(
      MAX_FEEDBACK_CHARS,
    );
  });

  it('reports failure instead of throwing when the network is gone', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    // Unhandled here would take down a screen holding text the user typed.
    await expect(sendFeedback('hello', '1.0.0')).resolves.toBe('failed');
  });

  it('reports failure on a rejected response', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    expect(await sendFeedback('hello', '1.0.0')).toBe('failed');
  });
});

describe('no email address anywhere in the shipped app', () => {
  /*
   * The requirement was an address that users cannot reach. A bundle is a file anyone can
   * download, so the only way to keep that promise is for the address never to be in the code
   * at all - it lives in Netlify's dashboard. These two guard the promise against a future
   * "quick fix" that hardcodes a mailto.
   */
  // Comments stripped: they are not in the bundle, and this file's own explanation of why
  // there is no mailto: here would otherwise trip the check that there is no mailto: here.
  const code = readFileSync(resolve(__dirname, '..', 'lib', 'feedback.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('has no address in the module that does the sending', () => {
    expect(code).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(code).not.toContain('mailto:');
  });

  it('has none in the HTML template either', () => {
    expect(INDEX_HTML).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});

describe('the contract with public/index.html', () => {
  /*
   * Netlify discovers forms by parsing the DEPLOYED html, so this hidden form is the only
   * reason submissions are accepted. Nothing at runtime can check the two agree - the app never
   * reads its own index.html - so it is checked here, where a rename fails the build instead of
   * silently dropping every note anyone writes.
   */
  it('declares the form under the name the code posts', () => {
    expect(INDEX_HTML).toContain(`name="${FEEDBACK_FORM}"`);
    expect(INDEX_HTML).toContain('data-netlify="true"');
  });

  it('declares every field the code sends', () => {
    for (const field of ['message', 'version', 'bot-field']) {
      expect([field, INDEX_HTML.includes(`name="${field}"`)]).toEqual([field, true]);
    }
  });

  it('wires the honeypot to the field that is left empty', () => {
    expect(INDEX_HTML).toContain('netlify-honeypot="bot-field"');
  });

  it('keeps the form out of sight', () => {
    const form = INDEX_HTML.slice(INDEX_HTML.indexOf(`name="${FEEDBACK_FORM}"`));
    expect(form.slice(0, form.indexOf('>'))).toContain('hidden');
  });
});

describe('the card', () => {
  const write = async (text: string) => {
    await fireEvent.changeText(screen.getByTestId('feedback-message'), text);
  };
  const send = async () => {
    await fireEvent.press(screen.getByTestId('feedback-send'));
  };

  it('will not send an empty note', async () => {
    await render(<FeedbackCard />);
    await send();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends what was typed and then clears the box', async () => {
    await render(<FeedbackCard />);
    await write('the squat wheel starts at 20');
    await send();

    await waitFor(() => expect(screen.getByTestId('feedback-sent')).toBeTruthy());
    expect(screen.getByTestId('feedback-message').props.value).toBe('');
  });

  it('keeps every word when the send fails', async () => {
    // The whole point. Losing a bug report to a dropped connection teaches people not to write
    // the next one.
    fetchMock.mockRejectedValue(new Error('offline'));
    await render(<FeedbackCard />);
    await write('long and carefully written report');
    await send();

    await waitFor(() => expect(screen.getByTestId('feedback-failed')).toBeTruthy());
    expect(screen.getByTestId('feedback-message').props.value).toBe(
      'long and carefully written report',
    );
  });

  it('clears the last verdict as soon as you start editing again', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await render(<FeedbackCard />);
    await write('first go');
    await send();
    await waitFor(() => expect(screen.getByTestId('feedback-failed')).toBeTruthy());

    await write('first go, with more detail');
    expect(screen.queryByTestId('feedback-failed')).toBeNull();
  });

  it('says what leaves the phone, before anything is typed', async () => {
    // This is the only outbound request in an app whose pitch is that nothing leaves the phone,
    // so the exception is stated where the exception is made.
    await render(<FeedbackCard />);
    expect(screen.getByText(/not your name, not a single logged set/)).toBeTruthy();
  });
});
