import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getExercise, imageUrl } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { theme } from './theme';

/**
 * Small square photo of a movement, for list rows.
 *
 * The photographs live on a remote CDN, so they are absent offline and on first paint. Rather
 * than leave a hole in the row, the fallback is the first two letters of the primary muscle on
 * a tinted tile - it still tells you at a glance whether a row is chest or legs.
 */
export function ExerciseThumb({ exerciseId, size = 44 }: { exerciseId: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const exercise = getExercise(exerciseId);
  const photo = exercise?.images[0];
  const muscle = exercise?.primaryMuscles[0];

  const box = { width: size, height: size, borderRadius: theme.radius.sm };

  if (!photo || failed) {
    return (
      <View style={[s.fallback, box]}>
        <Text style={[s.fallbackText, { fontSize: size * 0.3 }]}>
          {muscle ? MUSCLE_LABEL[muscle].slice(0, 2).toUpperCase() : '--'}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl(photo) }}
      style={[s.image, box]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel={exercise?.name}
    />
  );
}

const s = StyleSheet.create({
  image: { backgroundColor: theme.color.surfaceAlt },
  fallback: {
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { color: theme.color.textFaint, fontWeight: '800', letterSpacing: 0.5 },
});
