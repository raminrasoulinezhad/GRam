import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getExercise, imageUrl } from '@/catalog';
import { useStore } from '@/store/useStore';
import { MuscleGlyph } from './MuscleGlyph';
import { theme } from './theme';

/**
 * Row thumbnail: the exercise photograph, with a drawn muscle glyph behind it.
 *
 * The photographs live on a remote CDN, so they are absent offline and for the first moment of
 * every cold start. The glyph sits underneath rather than replacing them - it shows the body
 * with this movement's primary muscle lit up, so a row still reads as chest or legs while the
 * photo is on its way, and keeps reading that way if it never arrives.
 */
export function ExerciseThumb({ exerciseId, size = 44 }: { exerciseId: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showPhotos = useStore((s) => s.settings.showExercisePhotos);
  const exercise = getExercise(exerciseId);
  const photo = exercise?.images[0];
  const muscle = exercise?.primaryMuscles[0];

  return (
    <View
      style={[s.tile, { width: size, height: size }]}
      accessibilityLabel={exercise ? `${exercise.name}, works ${muscle}` : 'Unknown exercise'}
    >
      <MuscleGlyph muscle={muscle} size={size - 6} />
      {showPhotos && photo && !failed ? (
        <Image
          testID={`thumb-photo-${exerciseId}`}
          source={{ uri: imageUrl(photo) }}
          style={[s.photo, { width: size, height: size }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : null}
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
  photo: { position: 'absolute', top: 0, left: 0 },
});
