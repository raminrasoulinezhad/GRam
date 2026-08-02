import { StyleSheet, View } from 'react-native';
import { getExercise } from '@/catalog';
import { MuscleGlyph } from './MuscleGlyph';
import { theme } from './theme';

/**
 * Row thumbnail: the body, with this movement's primary muscle lit up.
 *
 * The exercise dataset links to photographs whose licence was never established upstream, so
 * they are not used anywhere in this app. A drawn glyph carries no third-party rights, needs
 * no network, and survives offline - and at 44px it tells you more than a photo would.
 */
export function ExerciseThumb({ exerciseId, size = 44 }: { exerciseId: string; size?: number }) {
  const exercise = getExercise(exerciseId);
  const muscle = exercise?.primaryMuscles[0];

  return (
    <View
      style={[s.tile, { width: size, height: size }]}
      accessibilityLabel={exercise ? `${exercise.name}, works ${muscle}` : 'Unknown exercise'}
    >
      <MuscleGlyph muscle={muscle} size={size - 6} />
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
