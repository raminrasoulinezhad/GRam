import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { Muscle } from '@/catalog';
import { theme } from './theme';

/**
 * A small body silhouette with one muscle lit up.
 *
 * Replaces the photographs the exercise dataset links to, whose licence was never established
 * upstream. Drawn here, so it carries no third-party rights, needs no network, and works
 * offline. It also happens to say more than a photo at 44px: you can see at a glance whether a
 * row trains the front or the back of the body, which is the same idea the Body tab is built on.
 *
 * Deliberately blocky - at thumbnail size anything finer turns to mush.
 */

type Side = 'front' | 'back';

/** Where each catalog muscle lives, and which view shows it. */
const MUSCLE_VIEW: Record<Muscle, Side> = {
  neck: 'front',
  traps: 'back',
  shoulders: 'front',
  chest: 'front',
  biceps: 'front',
  triceps: 'back',
  forearms: 'front',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  abdominals: 'front',
  glutes: 'back',
  quadriceps: 'front',
  hamstrings: 'back',
  adductors: 'front',
  abductors: 'front',
  calves: 'back',
};

/**
 * Highlight shapes, in a 100x164 portrait box. Mirrored pairs are listed separately rather
 * than transformed, so each stays readable when it is the only thing drawn.
 */
const REGIONS: Record<Muscle, string[]> = {
  neck: ['M43,25 h14 v9 h-14 z'],
  traps: ['M33,30 L67,30 L60,44 L40,44 z'],
  shoulders: ['M23,38 a10,9 0 0 1 12,-4 l2,11 l-13,4 z', 'M77,38 a10,9 0 0 0 -12,-4 l-2,11 l13,4 z'],
  chest: ['M36,40 h12 v18 h-14 z', 'M64,40 h-12 v18 h14 z'],
  biceps: ['M21,52 h10 v18 h-10 z', 'M79,52 h-10 v18 h10 z'],
  triceps: ['M20,52 h10 v18 h-10 z', 'M80,52 h-10 v18 h10 z'],
  forearms: ['M19,72 h10 v20 h-10 z', 'M81,72 h-10 v20 h10 z'],
  lats: ['M34,44 l6,2 v20 l-8,-6 z', 'M66,44 l-6,2 v20 l8,-6 z'],
  'middle back': ['M38,44 h24 v20 h-24 z'],
  'lower back': ['M40,64 h20 v14 h-20 z'],
  abdominals: ['M42,58 h16 v22 h-16 z'],
  glutes: ['M38,78 h24 v16 h-24 z'],
  quadriceps: ['M39,84 h9 v28 h-10 z', 'M61,84 h-9 v28 h10 z'],
  hamstrings: ['M39,88 h9 v26 h-10 z', 'M61,88 h-9 v26 h10 z'],
  adductors: ['M45,84 h10 v24 h-10 z'],
  abductors: ['M35,80 h6 v20 h-6 z', 'M65,80 h-6 v20 h6 z'],
  calves: ['M40,118 h8 v22 h-8 z', 'M60,118 h-8 v22 h8 z'],
};

/** The body outline, shared by both views. */
function Silhouette({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Circle cx={50} cy={14} r={11} />
      <Rect x={45} y={24} width={10} height={7} />
      {/* torso */}
      <Path d="M32,32 h36 l4,14 l-4,36 h-36 l-4,-36 z" />
      {/* arms */}
      <Path d="M20,38 h12 l-2,54 h-10 z" />
      <Path d="M80,38 h-12 l2,54 h10 z" />
      {/* legs */}
      <Path d="M36,82 h12 l-1,60 h-11 z" />
      <Path d="M64,82 h-12 l1,60 h11 z" />
    </G>
  );
}

export function MuscleGlyph({
  muscle,
  size = 44,
  highlight = theme.color.accent,
}: {
  muscle: Muscle | undefined;
  size?: number;
  highlight?: string;
}) {
  const side: Side = muscle ? MUSCLE_VIEW[muscle] : 'front';
  const shapes = muscle ? REGIONS[muscle] : [];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 164" accessibilityLabel={muscle ?? 'body'}>
      {/* A back view is the same outline without the face, which is enough of a cue at this size. */}
      <Silhouette fill={theme.color.border} />
      {side === 'front' ? (
        <G fill={theme.color.surfaceAlt}>
          <Circle cx={45} cy={12} r={2} />
          <Circle cx={55} cy={12} r={2} />
        </G>
      ) : null}
      <G fill={highlight}>
        {shapes.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}

export { MUSCLE_VIEW, REGIONS };
