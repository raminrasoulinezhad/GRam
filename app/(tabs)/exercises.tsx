import { router } from 'expo-router';
import { ExerciseList } from '@/ui/ExerciseList';
import { Screen } from '@/ui/components';

export default function ExercisesScreen() {
  return (
    <Screen>
      <ExerciseList onSelect={(exercise) => router.push(`/exercise/${exercise.id}`)} />
    </Screen>
  );
}
