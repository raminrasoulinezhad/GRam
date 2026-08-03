import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { MUSCLES, type Muscle } from '@/catalog';
import { TRACKED_SLUGS, toSlugValues } from '@/analytics/muscleMap';
import { emptyTotals } from '@/analytics/volume';
import { rampIntensity, theme } from './theme';

/**
 * The anatomical front/back figure, coloured by a per-muscle value.
 *
 * Shared by the Body tab and every exercise page so that "which muscles does this work" and
 * "which muscles have I worked" are drawn the same way and read the same way.
 */
export function BodyMap({
  values,
  max,
  scale = 0.85,
  gender = 'male',
  showLabels = true,
}: {
  values: Record<Muscle, number>;
  /** Value that maps to the hottest colour. */
  max: number;
  scale?: number;
  gender?: 'male' | 'female';
  showLabels?: boolean;
}) {
  const data = useMemo<ExtendedBodyPart[]>(() => {
    const bySlug = toSlugValues(values);
    // Every tracked slug gets an explicit entry. The library's `defaultFill` prop never
    // reaches the rendered paths, so untouched muscles would otherwise keep its grey and
    // clash with the cold end of our own ramp.
    return TRACKED_SLUGS.map((slug) => ({
      slug,
      intensity: rampIntensity(bySlug.get(slug) ?? 0, max),
    }));
  }, [values, max]);

  return (
    <View style={s.row}>
      {(['front', 'back'] as const).map((side) => (
        <View key={side} style={s.column}>
          <Body
            data={data}
            gender={gender}
            side={side}
            scale={scale}
            colors={[...theme.color.ramp]}
            defaultFill={theme.color.ramp[0]}
            border={theme.color.border}
          />
          {showLabels ? <Text style={s.sideLabel}>{side.toUpperCase()}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Per-muscle values for a single exercise: full weight for what it targets, half for what it
 * assists - the same 1.0 / 0.5 split the training-volume maths uses, so the picture and the
 * numbers agree.
 */
export function exerciseMuscleValues(
  primary: Muscle[],
  secondary: Muscle[],
): Record<Muscle, number> {
  const values = emptyTotals();
  for (const m of secondary) values[m] = 0.5;
  for (const m of primary) values[m] = 1;
  return values;
}

export { MUSCLES };

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.space(3), justifyContent: 'center' },
  column: { alignItems: 'center', gap: theme.space(2) },
  sideLabel: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
