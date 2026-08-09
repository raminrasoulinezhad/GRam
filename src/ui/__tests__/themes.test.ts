import { DEFAULT_THEME, THEMES, THEME_ORDER, type ThemeMeta } from '@/ui/themes';

/**
 * Relative luminance, per WCAG 2.1. Enough of the maths to check a palette without pulling in
 * a colour library for six numbers.
 */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Hue in degrees, 0 = red, 120 = green, 240 = blue. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Shortest angular distance between two hues. */
function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** How colourful, 0-1. A near-grey has no meaningful hue to compare. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
}

/**
 * Two colours are telling apart if they differ in lightness OR in hue.
 *
 * Contrast ratio alone is the wrong test: a green accent and a yellow warning can sit at nearly
 * the same luminance and still be unmistakable. Hue alone is wrong too, for two greys.
 */
function distinguishable(a: string, b: string): boolean {
  if (contrast(a, b) >= 1.35) return true;
  return saturation(a) > 0.2 && saturation(b) > 0.2 && hueGap(a, b) >= 25;
}

const all = Object.values(THEMES);
const named = all.map((t) => [t.name, t] as const);

describe('every palette is usable, not just handsome', () => {
  it.each(named)('%s reads body copy at 4.5:1', (_n, t: ThemeMeta) => {
    // The floor for normal-size text. Everything else on screen is bolder or larger.
    expect(contrast(t.colors.text, t.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colors.text, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(named)('%s keeps every secondary colour above 3:1', (_n, t: ThemeMeta) => {
    // Dimmed text, the accent, and the two alarm colours. Below 3:1 they stop being readable
    // in a bright room, which is where this app is used.
    for (const key of ['textDim', 'textFaint', 'accent', 'danger', 'warn'] as const) {
      expect([key, contrast(t.colors[key], t.colors.bg) >= 3]).toEqual([key, true]);
    }
  });

  it.each(named)('%s labels its filled buttons legibly', (_n, t: ThemeMeta) => {
    /*
     * The label sitting *on* a solid accent or danger button. This is the check that caught the
     * real bug: every filled button used to hardcode a near-black label, which is correct on
     * Carbon's bright green and unreadable on Chalk's dark one. 4.5:1 because these are button
     * labels at body size, not headings.
     */
    expect(['onAccent', contrast(t.colors.onAccent, t.colors.accent) >= 4.5]).toEqual([
      'onAccent',
      true,
    ]);
    expect(['onDanger', contrast(t.colors.onDanger, t.colors.danger) >= 4.5]).toEqual([
      'onDanger',
      true,
    ]);
  });

  it.each(named)('%s does not confuse its accent with its alarms', (_n, t: ThemeMeta) => {
    // One of these means "well done" and the others mean "something is wrong". A palette where
    // they look alike turns a warning into decoration.
    expect(['danger', distinguishable(t.colors.accent, t.colors.danger)]).toEqual(['danger', true]);
    expect(['warn', distinguishable(t.colors.accent, t.colors.warn)]).toEqual(['warn', true]);
  });

  it.each(named)('%s draws six ramp steps you can tell apart', (_n, t: ThemeMeta) => {
    // Two training loads that draw the same colour make the body map a lie.
    const ramp = t.colors.ramp;
    for (let i = 1; i < ramp.length; i++) {
      expect([i, distinguishable(ramp[i], ramp[i - 1])]).toEqual([i, true]);
    }
  });

  it.each(named)('%s ramps from cold to hot, not the other way', (_n, t: ThemeMeta) => {
    /*
     * Ordering is carried by hue, not by lightness, and deliberately so: the familiar heat scale
     * runs blue - cyan - green - amber - red, in which yellow is the *brightest* step and red is
     * darker again. Requiring luminance to climb all the way would outlaw the one ramp everybody
     * already knows how to read.
     *
     * So the rule is about temperature. The last two steps must be warm - red, orange or amber -
     * and the second step, the first with any real colour in it, must not be.
     */
    const warm = (h: string) => hue(h) <= 60 || hue(h) >= 330;
    const ramp = t.colors.ramp;
    expect([t.name, 'hottest', warm(ramp[5])]).toEqual([t.name, 'hottest', true]);
    expect([t.name, 'second hottest', warm(ramp[4])]).toEqual([t.name, 'second hottest', true]);
    /*
     * A ramp that stays inside one hue family - Ember's, which runs brown to bright orange -
     * carries its order by intensity instead of by temperature, and the step-apart check above
     * already guarantees that. Only ramps that actually travel across hues have to start cold.
     */
    const travels = hueGap(ramp[1], ramp[5]) >= 40;
    if (travels && saturation(ramp[1]) > 0.2) {
      expect([t.name, 'coldest live step', warm(ramp[1])]).toEqual([t.name, 'coldest live step', false]);
    }
  });

  it.each(named)('%s separates untouched from barely trained', (_n, t: ThemeMeta) => {
    // Index 0 means "you have not trained this at all", and it has to be obviously different
    // from the first live step or the body map cannot say that.
    expect(contrast(t.colors.ramp[0], t.colors.ramp[1])).toBeGreaterThanOrEqual(1.2);
  });

  it.each(named)('%s puts its surfaces on the same side as its background', (_n, t: ThemeMeta) => {
    // A "light" theme with a dark card, or the reverse, is a palette someone half-converted.
    const bg = luminance(t.colors.bg);
    for (const key of ['surface', 'surfaceAlt'] as const) {
      const near = Math.abs(luminance(t.colors[key]) - bg) < 0.25;
      expect([key, near]).toEqual([key, true]);
    }
  });
});

describe('the set of palettes', () => {
  it('lists every theme exactly once, in picker order', () => {
    expect([...THEME_ORDER].sort()).toEqual(Object.keys(THEMES).sort());
    expect(new Set(THEME_ORDER).size).toBe(THEME_ORDER.length);
  });

  it('keys each entry by its own id', () => {
    for (const [key, t] of Object.entries(THEMES)) expect(t.id).toBe(key);
  });

  it('has a default that exists', () => {
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });

  it('gives every theme a distinct name and a blurb short enough to read', () => {
    expect(new Set(all.map((t) => t.name)).size).toBe(all.length);
    for (const t of all) expect(t.blurb.length).toBeLessThanOrEqual(80);
  });

  it('offers a light option as well as dark ones', () => {
    // The whole argument for Chalk is that a gym is a bright room. If every palette were dark
    // that argument would have nowhere to land.
    expect(all.some((t) => t.light)).toBe(true);
    expect(all.some((t) => !t.light)).toBe(true);
  });

  it('writes every colour as a six-digit hex', () => {
    for (const t of all) {
      const values = [...Object.values(t.colors).flat()] as string[];
      for (const v of values) expect([t.name, v]).toEqual([t.name, expect.stringMatching(/^#[0-9A-F]{6}$/i)]);
    }
  });
});

describe('the colours no JavaScript can reach', () => {
  /*
   * The install splash and the frame painted before the bundle runs come from static files, so
   * theme.ts cannot set them. They have to be written down as the default theme, and they have
   * to be kept in step with it - which they were not: they still said Midnight navy after the
   * default became Carbon black, so the app opened with a navy flash and installed with a navy
   * splash behind a black screen.
   */
  const read = (file: string) =>
    require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../..', file), 'utf8');

  const bg = THEMES[DEFAULT_THEME].colors.bg;

  it('paints the pre-bundle page in the default theme', () => {
    // Case-insensitive: the meta tag carries the palette's own casing and the CSS below it is
    // written lowercase by convention. Both are the same colour, which is the thing that matters.
    const html = read('public/index.html').toLowerCase();
    const want = bg.toLowerCase();
    expect(html).toContain(`<meta name="theme-color" content="${want}" />`);
    expect(html).toContain(`background-color: ${want};`);
  });

  it('declares the install splash in the default theme', () => {
    const manifest = JSON.parse(read('public/manifest.json')) as {
      background_color: string;
      theme_color: string;
    };
    const seen = [manifest.background_color, manifest.theme_color].map((c) => c.toLowerCase());
    expect(seen).toEqual([bg.toLowerCase(), bg.toLowerCase()]);
  });

  it('declares a colour scheme matching the default theme', () => {
    // Dark glyphs on a light default, or the browser draws white-on-white form controls.
    const expected = THEMES[DEFAULT_THEME].light ? 'light' : 'dark';
    expect(read('public/index.html')).toContain(`<meta name="color-scheme" content="${expected}" />`);
  });
});
