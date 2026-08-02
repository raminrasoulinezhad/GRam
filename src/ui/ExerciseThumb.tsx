import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { getExercise, imageUrl } from '@/catalog';
import { useStore } from '@/store/useStore';
import { useExerciseSheet } from './ExerciseSheet';
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
  const openSheet = useExerciseSheet();
  const showPhotos = useStore((s) => s.settings.showExercisePhotos);
  const exercise = getExercise(exerciseId);
  const photo = exercise?.images[0];
  const muscle = exercise?.primaryMuscles[0];

  return (
    <Pressable
      // Tapping the picture opens the description; the row's own press is left to the row.
      accessibilityRole={openSheet ? 'button' : 'image'}
      accessibilityLabel={
        exercise
          ? `${exercise.name}, works ${muscle}${openSheet ? '. Open description' : ''}`
          : 'Unknown exercise'
      }
      testID={`thumb-${exerciseId}`}
      disabled={!openSheet || !exercise}
      onPress={() => exercise && openSheet?.(exerciseId)}
      style={({ pressed }) => [s.tile, { width: size, height: size }, pressed && { opacity: 0.7 }]}
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
    </Pressable>
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
