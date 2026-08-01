/** Single source of truth for colour and spacing. Dark-only in the PoC. */
export const theme = {
  color: {
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
    /** Heatmap ramp, coldest to hottest. Index 0 is "untouched". */
    ramp: ['#1E293B', '#164E63', '#0E7490', '#0891B2', '#F59E0B', '#EF4444'],
  },
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
} as const;

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
