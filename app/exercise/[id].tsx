import { Stack, useLocalSearchParams } from 'expo-router';
import { getExercise } from '@/catalog';
import { Screen } from '@/ui/components';
import { ExerciseDetail } from '@/ui/ExerciseDetail';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = getExercise(id);

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise?.name ?? 'Exercise' }} />
      <ExerciseDetail exerciseId={id} />
    </Screen>
  );
}
