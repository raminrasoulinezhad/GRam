import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getExercise, imageUrl, SET_KIND_LABEL } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { formatDate, formatSet, relativeTime, titleCase } from '@/lib/format';
import { selectExerciseHistory, useStore } from '@/store/useStore';
import { Body, Card, Chip, Dim, Empty, H2, Screen } from '@/ui/components';
import { theme } from '@/ui/theme';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = getExercise(id);
  const unit = useStore((s) => s.settings.unit);
  const history = useStore(selectExerciseHistory(id));

  if (!exercise) {
    return (
      <Screen>
        <Empty title="Exercise not found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{exercise.name}</Text>

        <View style={s.facts}>
          {exercise.equipment ? <Chip label={titleCase(exercise.equipment)} /> : null}
          <Chip label={titleCase(exercise.level)} />
          {exercise.mechanic ? <Chip label={titleCase(exercise.mechanic)} /> : null}
          {exercise.force ? <Chip label={`${titleCase(exercise.force)} force`} /> : null}
          <Chip label={titleCase(exercise.category)} />
          <Chip label={SET_KIND_LABEL[exercise.kind]} />
        </View>

        {/* The dataset ships a start and an end frame - shown side by side, they read as the movement. */}
        {exercise.images.length > 0 ? (
          <View style={s.images}>
            {exercise.images.map((path, i) => (
              <View key={path} style={s.imageWrap}>
                <Image
                  source={{ uri: imageUrl(path) }}
                  style={s.image}
                  resizeMode="cover"
                  accessibilityLabel={`${exercise.name}, position ${i + 1}`}
                />
                <Text style={s.imageCaption}>{i === 0 ? 'Start' : 'Finish'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Card>
          <H2>Muscles worked</H2>
          <Dim style={{ marginTop: theme.space(1) }}>Primary</Dim>
          <View style={s.muscleRow}>
            {exercise.primaryMuscles.map((m) => (
              <Chip key={m} label={MUSCLE_LABEL[m]} tone="primary" />
            ))}
          </View>
          {exercise.secondaryMuscles.length > 0 ? (
            <>
              <Dim style={{ marginTop: theme.space(3) }}>Secondary</Dim>
              <View style={s.muscleRow}>
                {exercise.secondaryMuscles.map((m) => (
                  <Chip key={m} label={MUSCLE_LABEL[m]} tone="secondary" />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        <Card>
          <H2>How to</H2>
          {exercise.instructions.length === 0 ? (
            <Dim style={{ marginTop: theme.space(2) }}>
              No written instructions in the dataset for this movement.
            </Dim>
          ) : (
            exercise.instructions.map((step, i) => (
              <View key={i} style={s.step}>
                <Text style={s.stepNum}>{i + 1}</Text>
                <Body style={{ flex: 1, lineHeight: 21 }}>{step}</Body>
              </View>
            ))
          )}
        </Card>

        <Card>
          <H2>History</H2>
          {history.length === 0 ? (
            <Dim style={{ marginTop: theme.space(2) }}>
              No recorded sets yet. Logged sets of this exercise show up here, newest first.
            </Dim>
          ) : (
            history.slice(0, 40).map(({ session, set, kind }) => (
              <View key={set.id} style={s.histRow}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{formatSet(set, kind, unit)}</Body>
                  <Dim>{session.planName}</Dim>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Dim>{formatDate(set.loggedAt ?? session.startedAt)}</Dim>
                  <Text style={s.histAgo}>{relativeTime(set.loggedAt ?? session.startedAt)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800', letterSpacing: -0.5 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1.5) },
  images: { flexDirection: 'row', gap: theme.space(2) },
  imageWrap: { flex: 1 },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
  },
  imageCaption: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: theme.space(1),
    textAlign: 'center',
  },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1.5), marginTop: theme.space(1.5) },
  step: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(3) },
  stepNum: {
    color: theme.color.accent,
    fontWeight: '800',
    fontSize: theme.font.small,
    width: 16,
    lineHeight: 21,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  histAgo: { color: theme.color.textFaint, fontSize: theme.font.tiny },
});
