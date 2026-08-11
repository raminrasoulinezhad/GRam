import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MUSCLES, type Muscle } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { Dim, Empty, Screen } from '@/ui/components';
import { ExerciseList } from '@/ui/ExerciseList';
import { theme } from '@/ui/theme';

/** The muscle a route param names, or null if it names nothing this catalog has. */
export function muscleFromParam(value: string | undefined): Muscle | null {
  if (value === undefined) return null;
  // Two of the seventeen have a space in them - "middle back", "lower back" - so the param
  // arrives percent-encoded from some navigators and plain from others. Decoding a string with
  // no escapes in it is a no-op, and a malformed one throws rather than corrupting the compare.
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return (MUSCLES as readonly string[]).includes(decoded) ? (decoded as Muscle) : null;
}

/**
 * Everything that trains one muscle, reached by tapping its tag on an exercise.
 *
 * PRIMARY ONLY, and that is the whole point of the page.
 *
 * "Chest" as a text search answers with two hundred movements, because the bench press, the
 * dip, the overhead press and half the catalog involve the chest somewhere. Someone who taps
 * the Chest tag on an exercise is asking the narrower question - what else is a chest exercise -
 * and the answer is the forty-odd the dataset files chest as the target of. The wider set is
 * still one search box away, on the tab this page borrows its list from.
 */
export default function MuscleScreen() {
  const params = useLocalSearchParams<{ muscle: string }>();
  const muscle = muscleFromParam(params.muscle);

  if (muscle === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Muscle' }} />
        <Empty title="No such muscle" hint="This catalog files exercises under seventeen." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: MUSCLE_LABEL[muscle] }} />
      <ExerciseList
        pinnedMuscle={muscle}
        onSelect={(exercise) => router.push(`/exercise/${exercise.id}`)}
        header={
          <View style={s.header}>
            <Text style={s.title}>{MUSCLE_LABEL[muscle]}</Text>
            <Dim style={s.hint}>
              Exercises this is the target of, best first. Movements that only assist with it are
              not here — search the name instead.
            </Dim>
          </View>
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: theme.space(4), paddingTop: theme.space(3) },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800', letterSpacing: -0.5 },
  hint: { marginTop: theme.space(1), lineHeight: 19 },
});
