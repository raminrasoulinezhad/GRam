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
  | 'blueprint'
  | 'neon'
  | 'chalk'
  | 'platinum'
  | 'logbook';

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
   * A CREATIVE ONE. Technical drawing: deep blue ground, fine cyan rule, everything laid out
   * like a plan. It suits what the app actually is - a thing for measuring a body and drawing a
   * schedule against it - and the cyan accent is unusual enough to be recognisably this app
   * rather than a template.
   *
   * The risk, stated so it can be judged rather than discovered: cyan and the cold end of the
   * heat ramp are close relatives, so the body map has less room to say "barely trained" versus
   * "untrained" than it does in Midnight.
   */
  blueprint: {
    id: 'blueprint',
    name: 'Blueprint',
    blurb: 'Technical drawing. Deep blue and electric cyan.',
    light: false,
    colors: {
      bg: '#071A2B',
      surface: '#0C2438',
      surfaceAlt: '#123049',
      border: '#1C4463',
      text: '#E3F2FD',
      textDim: '#8FB6D1',
      textFaint: '#5B84A3',
      accent: '#22D3EE',
      accentDim: '#0E4F5C',
      danger: '#FF6B81',
      warn: '#FFC145',
      onAccent: '#04161C',
      onDanger: '#2A0A0A',
      ramp: ['#16283A', '#194156', '#165869', '#22754B', '#A37409', '#F16C51'],
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
   * A second light option, cooler and more clinical than Chalk. Neutral greys, a lot of white
   * space, and a single deep blue accent - the register of a measuring instrument rather than
   * a gym.
   *
   * The case for it: this app's actual job is measurement, and its voice everywhere else is
   * plain and evidence-first. This is what that voice looks like as a colour scheme.
   */
  platinum: {
    id: 'platinum',
    name: 'Platinum',
    blurb: 'Light, neutral and clinical. An instrument, not a gym.',
    light: true,
    colors: {
      bg: '#FAFAFA',
      surface: '#FFFFFF',
      surfaceAlt: '#F0F1F3',
      border: '#DADCE0',
      text: '#1A1C1E',
      textDim: '#4A4E54',
      textFaint: '#6E727A',
      accent: '#1A56DB',
      accentDim: '#DBE5FB',
      danger: '#B42318',
      warn: '#8A5A00',
      onAccent: '#FFFFFF',
      onDanger: '#FFFFFF',
      ramp: ['#EEEEF0', '#BFCFE7', '#8EB3DE', '#C68B23', '#D4581A', '#C33222'],
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
};

/**
 * Carbon, not the navy the app shipped with.
 *
 * A true-black ground is the one choice here with a measurable argument behind it rather than
 * only a visual one: on the OLED panel in almost every recent phone a black pixel is switched
 * off, and a workout screen is mostly background held awake for the length of a session.
 */
export const DEFAULT_THEME: ThemeId = 'carbon';

/*
 * Picker order: the default first, then the other darks, then the lights.
 *
 * Two candidates were cut after being seen side by side. **Iron** was the conventional
 * charcoal-and-safety-orange every lifting app converges on - dropped for sitting too close to
 * Carbon and Graphite to earn its own slot. **Ember** was the warm dark: chalk, leather and a
 * low fire. Dropping both leaves the shortlist entirely cool, which is a deliberate outcome
 * rather than an oversight; if the warm end is ever wanted back, they are in the git history.
 */
export const THEME_ORDER: readonly ThemeId[] = [
  'carbon',
  'midnight',
  'graphite',
  'blueprint',
  'neon',
  'chalk',
  'platinum',
  'logbook',
];
