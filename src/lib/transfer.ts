import { Platform, Share } from 'react-native';

/**
 * Getting a text file out of, and into, an app that may be running as an iOS home-screen web app.
 *
 * That environment is the whole difficulty. A standalone PWA on iOS is not Safari: there is no
 * address bar, no downloads shelf, and `<a download>` - the normal way to save a file from a web
 * page - does nothing at all. What does work is the Web Share API with a File attached, which
 * hands the file to the system sheet and lets the user drop it into Files, Notes, Mail or
 * AirDrop. So that is the primary route, with the desktop download as the fallback rather than
 * the other way round.
 *
 * Everything here degrades instead of failing. If sharing is unavailable it downloads; if that
 * is unavailable it copies to the clipboard; and the calling screen always shows the raw text as
 * selectable copy anyway, so there is no arrangement in which a user cannot get their data out.
 */

const isWeb = Platform.OS === 'web';
const hasDom = () => isWeb && typeof document !== 'undefined';

export type ExportOutcome = 'shared' | 'downloaded' | 'copied' | 'shown';

/** True when the platform can hand a real file to the system share sheet. */
export function canShareFile(filename: string): boolean {
  if (!isWeb || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { canShare?: (data: unknown) => boolean };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [new File(['{}'], filename, { type: 'application/json' })] });
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (!isWeb || typeof navigator === 'undefined') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Offers `text` to the user as a file. Returns how it managed it, so the screen can say.
 *
 * A share the user cancels reports 'shown' rather than an error - dismissing the sheet is a
 * decision, not a failure, and the text is on screen behind it either way.
 */
export async function exportText(text: string, filename: string): Promise<ExportOutcome> {
  if (!isWeb) {
    // Native has no filesystem module in this build; the share sheet takes the text itself.
    try {
      await Share.share({ message: text, title: filename });
      return 'shared';
    } catch {
      return 'shown';
    }
  }

  const type = 'application/json';

  if (canShareFile(filename)) {
    try {
      await (navigator as Navigator & { share: (d: unknown) => Promise<void> }).share({
        files: [new File([text], filename, { type })],
        title: filename,
      });
      return 'shared';
    } catch {
      // Cancelled, or the sheet refused the file. Fall through to the other routes.
    }
  }

  if (hasDom()) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return 'downloaded';
    } catch {
      // Fall through.
    }
  }

  return (await copyText(text)) ? 'copied' : 'shown';
}

/**
 * Opens the system file picker and reads the chosen file as text.
 *
 * Built from a detached `<input type="file">` because react-native-web has no equivalent. It
 * works in an iOS standalone web app, where it opens the Files browser - which is where an
 * exported backup will have been put.
 *
 * Resolves null when the user cancels. Rejects only when the file cannot be read.
 */
export function pickTextFile(accept = 'application/json,.json'): Promise<string | null> {
  if (!hasDom()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    document.body.appendChild(input);

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      input.remove();
      fn();
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(() => resolve(null));
      const reader = new FileReader();
      reader.onload = () => finish(() => resolve(String(reader.result ?? '')));
      reader.onerror = () => finish(() => reject(new Error('That file could not be read.')));
      reader.readAsText(file);
    });

    // There is no reliable "cancelled" event across browsers. `cancel` fires on modern ones;
    // elsewhere the promise stays pending and is discarded with the screen, which is harmless.
    input.addEventListener('cancel', () => finish(() => resolve(null)));

    input.click();
  });
}

/** Whether the file picker is available, so the screen can hide a button that cannot work. */
export function canPickFile(): boolean {
  return hasDom();
}
