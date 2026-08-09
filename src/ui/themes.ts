/**
 * Candidate palettes.
 *
 * A shortlist, not a set of shipped themes - it is meant to keep shrinking as they are seen on
 * a phone in a real gym, which is the only place the judgement can be made.
 *
 * WHAT EVERY PALETTE HAS TO SURVIVE
 * This app is read at arm's length, mid-set, by someone slightly out of breath and often with
 * one hand. That rules out a lot of otherwise handsome colour:
 *
 *   - **Body text against its background must stay legible under gym lighting**, which is
 *     brighter and greyer than a desk. Low-contrast "elegant" greys fail here first.
 *   - **The accent has to survive being the only colour on screen.** It marks the record button
 *     and the active state, and those are what the eye hunts for between sets.
 *   - **`danger` and `warn` must not be confusable with the accent**, because one of them means
 *     "your data is about to be lost" and the accent means "well done".
 *   - **The six-stop `ramp` has to read as one ordered scale** from untouched to hammered. It
 *     draws the body map, so it is the one place where colour carries meaning rather than
 *     decoration. Index 0 is "not trained at all" and must look inert, not merely cold.
 *
 * MEASURED, NOT EYEBALLED
 * Every palette here was checked rather than judged by looking at hex codes, and the checking
 * found real faults each time: text below the contrast floor in two of them, an accent and a
 * warning twenty-four degrees apart in hue, and ramps whose adjacent steps were within 1.1:1 -
 * close enough that two different training loads drew the same colour on the body map.
 *
 * The floors, all enforced by __tests__/themes.test.ts:
 *   - `text` clears 4.5:1 against both `bg` and `surface`, since it carries body copy
 *   - every other foreground colour clears 3:1 against `bg`
 *   - the accent is tellable apart from `danger` and `warn`, by lightness or by hue
 *   - adjacent ramp steps are tellable apart, so the gradation is visible
 *   - the hot end of the ramp is actually warm
 */

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentDim: string;
  danger: string;
  warn: string;
  /**
   * Label colour for text sitting *on* a filled accent button, and likewise for danger.
   *
   * These exist because the accent flips from bright to dark between the dark and light
   * palettes. Every filled button used to hardcode a near-black label, which is right on
   * Carbon's #00E676 and unreadable on Chalk's #15803D. `text` cannot stand in: it is chosen
   * against `bg`, and on a light theme that is dark ink on a dark button.
   */
  onAccent: string;
  onDanger: string;
  ramp: readonly [string, string, string, string, string, string];
};

export type ThemeId =
  | 'midnight'
  | 'carbon'
  | 'graphite'
  | 'neon'
  | 'mocha'
  | 'lemon'
  | 'chalk'
  | 'logbook'
  | 'canadian';

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  /** One line for the picker. */
  blurb: string;
  /** Whether text is dark on light, which some components need to know. */
  light: boolean;
  colors: Palette;
};

export const THEMES: Record<ThemeId, ThemeMeta> = {
  /*
   * The incumbent. Navy rather than grey, which keeps it from looking like a developer tool,
   * and a green accent because the thing you press most is "I did that" and green is the one
   * colour nobody has to learn.
   */
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Navy and green. What the app has always looked like.',
    light: false,
    colors: {
      bg: '#0B1220',
      surface: '#141C2B',
      surfaceAlt: '#1C2637',
      border: '#26334A',
      text: '#E8EDF7',
      textDim: '#93A1BA',
      textFaint: '#64748B',
      accent: '#4ADE80',
      accentDim: '#166534',
      danger: '#F87171',
      warn: '#FBBF24',
      onAccent: '#04120A',
      onDanger: '#2A0A0A',
      ramp: ['#1E293B', '#164E63', '#0E7490', '#0891B2', '#F59E0B', '#EF4444'],
    },
  },

  /*
   * A CLEVER ONE. True black, not dark grey, and one vivid accent against it.
   *
   * On the OLED panel in almost every phone sold since 2018, a black pixel is a pixel that is
   * switched off. A workout screen is mostly background and is held awake for an hour or more
   * between sets, which is exactly the shape of usage where that matters - and a phone that
   * lasts the session is worth more to a lifter than any amount of styling.
   *
   * It also gives the deepest contrast available, which is the other thing a screen read at
   * arm's length wants. The cost is that pure black borders disappear, so structure here comes
   * from slightly lifted surfaces rather than from rules.
   */
  carbon: {
    id: 'carbon',
    name: 'Carbon',
    blurb: 'True black. Saves battery on OLED and reads hardest at a glance.',
    light: false,
    colors: {
      bg: '#000000',
      surface: '#0C0C0E',
      surfaceAlt: '#16161A',
      border: '#2A2A30',
      text: '#FFFFFF',
      textDim: '#A8A8B3',
      textFaint: '#76767F',
      accent: '#00E676',
      accentDim: '#0B3D24',
      danger: '#FF5370',
      warn: '#FFC400',
      onAccent: '#04120A',
      onDanger: '#2A0A0A',
      ramp: ['#141418', '#0B3D4D', '#0E6B7C', '#12A0A0', '#FFB300', '#FF3D00'],
    },
  },

  /*
   * A CREATIVE ONE, and the one with an actual argument behind it.
   *
   * The interface is greyscale from top to bottom - no coloured buttons, no green tick, nothing
   * tinted for decoration. The only hue anywhere in the app is the body map. Colour stops being
   * styling and becomes the single thing it is used to mean: this is how hard that muscle has
   * been worked.
   *
   * The trade is real and worth saying plainly: without a green accent, "recorded" has to be
   * carried by weight, fill and position instead of by colour. In exchange, the one screen that
   * is genuinely a data visualisation becomes impossible to overlook.
   */
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    blurb: 'Greyscale everywhere. The body map is the only colour in the app.',
    light: false,
    colors: {
      bg: '#0F0F11',
      surface: '#1A1A1D',
      surfaceAlt: '#26262B',
      border: '#3A3A41',
      text: '#F2F2F4',
      textDim: '#A6A6AE',
      textFaint: '#74747C',
      // Near-white: bright enough to be the loudest thing on a grey screen without introducing
      // a hue that would compete with the body map.
      accent: '#E8E8EC',
      accentDim: '#3A3A41',
      danger: '#FF6B6B',
      // Darker than the other themes' amber. The accent here is almost white and has no hue to
      // be told apart by, so the difference has to be carried by lightness alone.
      warn: '#D99400',
      onAccent: '#141418',
      onDanger: '#2A0A0A',
      ramp: ['#26262B', '#0E4B6E', '#1D7FA8', '#3FB0A0', '#F2A007', '#E03131'],
    },
  },

  /*
   * The outlier, kept so it can be rejected knowingly rather than never considered.
   *
   * Dark slate with electric lime and magenta - the register of sports drinks and running
   * watches. It is the most energetic thing here and the furthest from the rest of the app's
   * voice, which is measured, plain and slightly sceptical.
   */
  neon: {
    id: 'neon',
    name: 'Neon',
    blurb: 'Electric lime on slate. Loud, energetic, least like the rest of the app.',
    light: false,
    colors: {
      bg: '#0D1117',
      surface: '#151B24',
      surfaceAlt: '#1E2632',
      border: '#2D3846',
      text: '#F0F6FC',
      textDim: '#9BA8B8',
      textFaint: '#6B7A8C',
      accent: '#CCFF00',
      accentDim: '#37440A',
      danger: '#FF2E88',
      warn: '#FFB300',
      // The fifth step was lime, the same colour as the accent, so a hammered muscle looked
      // like a button. Amber instead, which also keeps the ramp warming toward the magenta top.
      onAccent: '#141A00',
      onDanger: '#2A0011',
      ramp: ['#1E2632', '#12556B', '#0E8F9E', '#5FD68A', '#E8A317', '#FF2E88'],
    },
  },

  /*
   * A CREATIVE ONE, and the warm end of the set coming back.
   *
   * Espresso, crema and a cup of latte for the accent. The shortlist was cut to eight entirely
   * cool palettes at 1.4.5 and that was noted at the time as deliberate but lopsided; this is
   * the correction. It is the only theme here that feels like a room rather than a screen.
   *
   * The accent is the *lightest* thing in the palette rather than the most saturated. A caramel
   * or amber accent - the obvious choice on this ground - lands within twenty degrees of the
   * warning colour, and "well done" and "your data is at risk" cannot be the same colour. Going
   * pale instead separates them by lightness, which no amount of hue-matching can undo.
   */
  mocha: {
    id: 'mocha',
    name: 'Mocha',
    blurb: 'Espresso and cream. The warm one.',
    light: false,
    colors: {
      bg: '#1C1410',
      surface: '#261C16',
      surfaceAlt: '#33261E',
      border: '#4A382C',
      text: '#F5EBE0',
      textDim: '#C4AE9C',
      textFaint: '#9A8574',
      accent: '#F0D9B5',
      accentDim: '#4A3320',
      danger: '#E8837C',
      warn: '#D9A441',
      onAccent: '#241A12',
      onDanger: '#2A0A0A',
      ramp: ['#2A1F19', '#2F4F4F', '#3E7C6B', '#7FA05A', '#D99A2B', '#C4452D'],
    },
  },

  /*
   * A light one, and the brightest thing here. Pale lemon paper, ink, and rind for the accent.
   *
   * Worth saying plainly, because the name promises something the maths will not allow: the
   * accent is NOT lemon yellow. A saturated yellow cannot clear 3:1 against any ground pale
   * enough to read as lemon - it is the single least contrasty hue there is. So the citrus is
   * carried by the paper, which is where most of the screen is anyway, and the accent is the
   * dark olive-lime of the rind. The alternative was a yellow nobody could see.
   */
  lemon: {
    id: 'lemon',
    name: 'Lemon',
    blurb: 'Pale citrus paper and rind green. The brightest one.',
    light: true,
    colors: {
      bg: '#FFFDF0',
      surface: '#FFFFFF',
      surfaceAlt: '#FBF4D9',
      border: '#E5DBB0',
      text: '#262418',
      textDim: '#5C5842',
      textFaint: '#7A7458',
      accent: '#4F7A00',
      accentDim: '#DDEEB0',
      danger: '#B91C1C',
      warn: '#9A6A00',
      onAccent: '#FFFFFF',
      onDanger: '#FFFFFF',
      ramp: ['#F2EFDC', '#8FBFDC', '#4E93BE', '#D4B02E', '#D9601F', '#B8261A'],
    },
  },

  /*
   * THE CLEVER ONE. A light theme, which is contrarian for a gym app and is the point.
   *
   * Every lifting app ships dark by default, inherited from the assumption that phones are used
   * in bed. A gym is one of the brightest rooms anyone trains in - overhead fluorescents, often
   * mirrors and windows - and a dark screen at arm's length in that room is the harder read,
   * because the pupil is stopped down for the room, not for the screen. Light-on-dark also
   * blooms for anyone with astigmatism, which is a large minority squinting at a rep count.
   *
   * Chalk and steel: paper-white ground, graphite text, and the same green so the muscle memory
   * of "green means recorded" survives a theme change.
   */
  chalk: {
    id: 'chalk',
    name: 'Chalk',
    blurb: 'Light and high-contrast. Easiest to read in a bright gym.',
    light: true,
    colors: {
      bg: '#F7F8FA',
      surface: '#FFFFFF',
      surfaceAlt: '#EDF0F4',
      border: '#D3D9E2',
      text: '#111827',
      textDim: '#4B5563',
      // Darkened from #8A94A6, which measured 2.9:1 on this ground - below the 3:1 floor.
      textFaint: '#6B7280',
      // Darkened from the dark themes' green: #4ADE80 on white is unreadable.
      accent: '#15803D',
      accentDim: '#BBF7D0',
      danger: '#B91C1C',
      warn: '#B45309',
      onAccent: '#FFFFFF',
      onDanger: '#FFFFFF',
      ramp: ['#EDEFF1', '#B2D2E9', '#69BBD9', '#C38C1C', '#D05B17', '#C23520'],
    },
  },

  /*
   * A CREATIVE ONE. The paper training log this app replaces: warm off-white stock, graphite
   * writing, and a red pencil for the thing that matters. Distinctive, warmer than Chalk, and
   * it carries an idea - that a training diary is a personal document, not a dashboard - which
   * is also the app's whole position on where your data lives.
   */
  logbook: {
    id: 'logbook',
    name: 'Logbook',
    blurb: 'Paper and pencil. Like the training diary it replaces.',
    light: true,
    colors: {
      bg: '#F4EFE6',
      surface: '#FBF8F2',
      surfaceAlt: '#EAE3D6',
      border: '#D6CCBA',
      text: '#2B2621',
      textDim: '#5C5347',
      textFaint: '#8C8274',
      accent: '#A83A0B',
      accentDim: '#F3D9CB',
      danger: '#7F1D1D',
      // Pushed toward olive: at #8A6100 it sat 24 degrees from the burnt-orange accent, close
      // enough that "worth a look" and "well done" read as the same colour.
      warn: '#6E5A00',
      onAccent: '#FFF6EF',
      onDanger: '#FFFFFF',
      ramp: ['#E8E4DB', '#BAC7A2', '#98AD54', '#A8832A', '#AE581F', '#A52D1B'],
    },
  },

  /*
   * THE NOVELTY ONE, and it needed a real fix to work at all.
   *
   * The flag: white field, red bar. Which walks straight into a problem no other palette here
   * has - the accent IS red, and red is what danger has to be. An accent that means "well done"
   * and an alarm that means "your data is about to go" cannot be the same colour.
   *
   * Resolved by lightness rather than by hue: the accent is flag red and danger is a much
   * darker crimson, far enough apart to be unmistakable side by side. The warning is pushed
   * down to a dark amber for the same reason. That is the honest cost of the theme, and it is
   * why this one is at the end of the list rather than presented as an equal.
   */
  canadian: {
    id: 'canadian',
    name: 'Canadian',
    blurb: 'Flag red on white. A novelty, and it knows it.',
    light: true,
    colors: {
      bg: '#FFFFFF',
      surface: '#FFF7F6',
      surfaceAlt: '#FDEBE9',
      border: '#F0CFCB',
      text: '#1A1A1A',
      textDim: '#565656',
      textFaint: '#6E6E6E',
      accent: '#D52B1E',
      accentDim: '#FBD5D1',
      danger: '#7A0F0F',
      warn: '#8A5A00',
      onAccent: '#FFFFFF',
      onDanger: '#FFFFFF',
      ramp: ['#EFEFEF', '#B9CFE3', '#7FA8C9', '#C99A2B', '#D9601F', '#C0201A'],
    },
  },
};

/**
 * Midnight, the navy the app shipped with.
 *
 * Carbon held this for one release on a battery argument - a black pixel on an OLED panel is a
 * pixel switched off, and a workout screen is mostly background held awake for an hour. True,
 * and not the whole question: seen on a phone rather than reasoned about, the navy is the one
 * that looks like this app. The saving is real but small, and Carbon is one tap away for anyone
 * who wants it.
 */
export const DEFAULT_THEME: ThemeId = 'midnight';

/*
 * Picker order: the default first, then the other darks, then the lights, novelty last.
 *
 * Four have been cut across the reviews. **Iron** and **Ember** went before 1.4.5 - the first
 * for sitting too close to Carbon and Graphite, the second unseen. **Blueprint** went at 1.6:
 * its cyan accent was a close relative of the cold end of the heat ramp, which left the body
 * map less room to separate "barely trained" from "untrained" than any other palette.
 * **Platinum** went with it, for the reason Iron did - a second cool, neutral light theme next
 * to Chalk was a variation rather than a choice.
 *
 * All four are in the git history if the judgement ever changes.
 */
export const THEME_ORDER: readonly ThemeId[] = [
  'midnight',
  'carbon',
  'graphite',
  'neon',
  'mocha',
  'chalk',
  'lemon',
  'logbook',
  'canadian',
];
