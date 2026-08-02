import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { theme } from './theme';

/**
 * A medal for a milestone level.
 *
 * The metal changes as you climb, so a glance at the Profile tab tells you roughly how far in
 * you are without reading a number. Level 0 - nothing reached yet - renders as an empty outline
 * rather than a medal, because awarding a medal for having done nothing cheapens the rest.
 */

type Band = { name: string; base: string; light: string; dark: string };

/** Six bands, each covering three levels, then the top band holds for everything beyond. */
const BANDS: Band[] = [
  { name: 'Bronze', base: '#C2703B', light: '#E9A171', dark: '#8A4A22' },
  { name: 'Silver', base: '#A8B4C0', light: '#DCE5EC', dark: '#6E7B87' },
  { name: 'Gold', base: '#D9A521', light: '#F6D470', dark: '#9A7010' },
  { name: 'Emerald', base: '#2FA36B', light: '#6BD9A2', dark: '#1B6B45' },
  { name: 'Sapphire', base: '#3B7BD9', light: '#7FB0F2', dark: '#22508F' },
  { name: 'Ember', base: '#E8752A', light: '#FFA968', dark: '#A84A12' },
];

export const LEVELS_PER_BAND = 3;

export function bandFor(level: number): Band {
  if (level <= 0) return BANDS[0];
  const index = Math.min(BANDS.length - 1, Math.floor((level - 1) / LEVELS_PER_BAND));
  return BANDS[index];
}

export function bandName(level: number): string {
  return level <= 0 ? 'Unranked' : bandFor(level).name;
}

export function MilestoneBadge({ level, size = 56 }: { level: number; size?: number }) {
  const band = bandFor(level);
  const earned = level > 0;
  const id = `mb${level}`;

  // Twelve-point star, drawn as alternating outer and inner radii.
  const points: string[] = [];
  const cx = 50;
  const cy = 50;
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 46 : 38;
    const a = (Math.PI / 12) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityLabel={earned ? `${band.name}, level ${level}` : 'No milestone yet'}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={band.light} />
          <Stop offset="0.55" stopColor={band.base} />
          <Stop offset="1" stopColor={band.dark} />
        </LinearGradient>
      </Defs>

      <Path
        d={`M${points.join(' L')} Z`}
        fill={earned ? band.dark : theme.color.surfaceAlt}
        opacity={earned ? 1 : 0.7}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={37}
        fill={earned ? `url(#${id})` : theme.color.surfaceAlt}
        stroke={earned ? band.light : theme.color.border}
        strokeWidth={2}
      />
      <Circle cx={cx} cy={cy} r={29} fill="none" stroke={earned ? band.dark : theme.color.border} strokeWidth={1.5} opacity={0.55} />

      {earned ? (
        <SvgText
          x={cx}
          y={cy + 11}
          fontSize={32}
          fontWeight="bold"
          fill="#12202E"
          textAnchor="middle"
        >
          {level}
        </SvgText>
      ) : (
        <G>
          {/* An empty socket: the shape of a medal without the medal. */}
          <Circle cx={cx} cy={cy} r={9} fill="none" stroke={theme.color.textFaint} strokeWidth={2} />
        </G>
      )}
    </Svg>
  );
}
