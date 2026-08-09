import { Platform } from 'react-native';
import { DEFAULT_THEME, THEMES, type Palette, type ThemeId } from './themes';

/**
 * The colours and metrics every screen draws with.
 *
 * HOW THE CHOSEN THEME GETS IN HERE
 * This module is a dependency of every file that has a `StyleSheet.create`, so it evaluates
 * before any of them. That ordering is the whole mechanism: the palette is resolved here, at
 * import, and by the time the first stylesheet is built `theme.color` already holds the right
 * values. Nothing flashes and no screen has to know a theme setting exists.
 *
 * The cost of doing it that way is that the read has to be **synchronous**, and the store this
 * app persists to is not - AsyncStorage resolves a promise, and by then the stylesheets are
 * built. So the chosen theme is mirrored into its own tiny key, `gram-theme`, which on the web
 * is localStorage and can be read in a straight line. The store's `settings.themeId` remains
 * the source of truth - it is what a backup carries and what a restore brings back; this key
 * is only a cache so the next launch paints correctly. `useThemeSync` reconciles the two.
 *
 * And because the stylesheets are already built, *changing* the theme cannot repaint what is on
 * screen. The app reloads instead. That is a deliberate trade: the alternative is making all
 * 29 stylesheets rebuild per render, which turns every one of the ~360 colour references into
 * something that has to re-run at the right moment, and gets you stale rows in any list that
 * memoises. A reload is a second, loses nothing (all state is persisted) and cannot be wrong.
 */

/**
 * DO NOT put this inside the main blob. Reading it must not mean parsing the whole store -
 * that payload reaches megabytes after a few years of training, and this runs before paint.
 */
export const THEME_KEY = 'gram-theme';

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}

/**
 * The web's localStorage, when there is one.
 *
 * Native has no synchronous storage, so it always gets the default palette - see
 * `themeAppliesImmediately`. Private-mode Safari throws on access rather than returning null,
 * hence the try.
 */
function syncStore(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether a theme chosen now can actually be shown, on this platform. */
export const themeAppliesImmediately = syncStore() !== null;

export function readLaunchTheme(): ThemeId {
  try {
    const raw = syncStore()?.getItem(THEME_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Caches the choice for the next launch. Returns whether it stuck - the caller uses that to
 * decide whether reloading would actually change anything, because reloading into the same
 * palette that failed to save is how you build an infinite loop.
 */
export function writeLaunchTheme(id: ThemeId): boolean {
  const store = syncStore();
  if (!store) return false;
  try {
    store.setItem(THEME_KEY, id);
    return readLaunchTheme() === id;
  } catch {
    return false;
  }
}

const active = THEMES[readLaunchTheme()] ?? THEMES[DEFAULT_THEME];

export const theme = {
  /** Which palette is painted right now. Fixed for the lifetime of this launch. */
  id: active.id as ThemeId,
  /** Dark ink on a light ground. Drives the status bar and anything else that must invert. */
  light: active.light,
  color: { ...active.colors } as Palette,
  space: (n: number) => n * 4,
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  font: {
    h1: 28,
    h2: 20,
    h3: 16,
    body: 15,
    small: 13,
    tiny: 11,
  },
};

/**
 * Paints the parts of the page that are not React's to paint.
 *
 * Three things in public/index.html assumed a navy app: the html background, which shows in the
 * overscroll gutter and under the notch; `theme-color`, which colours the browser chrome and the
 * iOS status bar area on an installed app; and `color-scheme`, which decides whether scrollbars
 * and form controls come out dark or light. Left alone, choosing Chalk gives you a white app in
 * a navy frame with dark scrollbars.
 *
 * Done here rather than in a component because it has to be true before the first paint, and
 * this module already runs then. It is also the reason the static values stay in index.html:
 * they are what the page shows in the moment before the bundle executes.
 */
function paintDocument() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  document.documentElement.style.backgroundColor = active.colors.bg;
  if (document.body) document.body.style.backgroundColor = active.colors.bg;

  const set = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  set('theme-color', active.colors.bg);
  set('color-scheme', active.light ? 'light' : 'dark');
}

paintDocument();

/**
 * Maps a value in [0, max] onto the heatmap ramp.
 * Zero always returns the "untouched" colour rather than the coldest live colour, so a muscle
 * you have not trained is visually distinct from one you barely trained.
 */
export function rampColor(value: number, max: number): string {
  const { ramp } = theme.color;
  if (value <= 0) return ramp[0];
  const t = Math.min(1, value / max);
  const idx = Math.min(ramp.length - 1, 1 + Math.floor(t * (ramp.length - 1.001)));
  return ramp[idx];
}

/** 1-based index into `theme.color.ramp`, which is what react-native-body-highlighter wants. */
export function rampIntensity(value: number, max: number): number {
  const { ramp } = theme.color;
  if (value <= 0) return 1;
  const t = Math.min(1, value / max);
  return Math.min(ramp.length, 2 + Math.floor(t * (ramp.length - 2.001)));
}
