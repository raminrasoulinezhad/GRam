import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  coachingVideos,
  exerciseName,
  getExercise,
  imageUrl,
  isPerSideLoad,
  regressionLadder,
  SET_KIND_LABEL,
  type Muscle,
} from '@/catalog';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { slopeFor } from '@/catalog/slope';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { formatDate, formatSet, relativeTime, titleCase } from '@/lib/format';
import { exerciseHistory, selectSessions, useStore } from '@/store/useStore';
import { Body, Card, Chip, Dim, Empty, H2 } from './components';
import { BodyMap, exerciseMuscleValues } from './BodyMap';
import { ImageViewer } from './ImageViewer';
import { theme } from './theme';

/**
 * Everything there is to say about one exercise: photos, the muscles it works, how to perform
 * it, and your own history of it.
 *
 * Shared by the full-page route and the sheet that opens from tapping a thumbnail, so both
 * always show the same thing.
 */
export function ExerciseDetail({
  exerciseId,
  onLeave,
}: {
  exerciseId: string;
  /**
   * Called just before this component navigates somewhere. The sheet renders above the
   * navigator, so without it a muscle tag tapped inside the sheet would open a page behind a
   * sheet still covering the whole screen. The full-page route has nothing to do here.
   *
   * A prop rather than a hook on the sheet's context: ExerciseSheet imports this file, and
   * importing back would make a cycle out of two modules that are otherwise a clean layer.
   */
  onLeave?: () => void;
}) {
  const exercise = getExercise(exerciseId);
  const unit = useStore((s) => s.settings.unit);
  const sessions = useStore(selectSessions);
  const bodyGender = useStore((s) => s.settings.bodyGender);
  const showPhotos = useStore((s) => s.settings.showExercisePhotos);
  const history = useMemo(() => exerciseHistory(sessions, exerciseId), [sessions, exerciseId]);
  /** Which photo is open full screen, if any. */
  const [viewing, setViewing] = useState<number | null>(null);
  const ladder = useMemo(() => regressionLadder(exerciseId), [exerciseId]);
  const videos = coachingVideos(exerciseId);
  const photos = useMemo(
    () =>
      (exercise?.images ?? []).map((path, i) => ({
        uri: imageUrl(path),
        // The dataset always ships exactly two frames, and the pair only means anything as a
        // before and after; anything beyond them is numbered rather than mislabelled.
        caption: i === 0 ? 'START' : i === 1 ? 'FINISH' : `FRAME ${i + 1}`,
      })),
    [exercise],
  );
  const muscleValues = useMemo(
    () => exerciseMuscleValues(exercise?.primaryMuscles ?? [], exercise?.secondaryMuscles ?? []),
    [exercise],
  );

  const slope = slopeFor(exerciseId);

  /*
   * A muscle tag is the shortest question in the app - "what else works this?" - and until now
   * it was a label you could only read. Both rows lead to the same place: the exercises that
   * muscle is the TARGET of. Asking from the secondary row is still asking what trains it, not
   * what happens to involve it, and answering with two hundred movements would be answering a
   * different question.
   */
  function openMuscle(muscle: Muscle) {
    onLeave?.();
    // Two of the seventeen have a space in them, and a raw space in a path is not a path.
    router.push(`/muscle/${encodeURIComponent(muscle)}`);
  }

  if (!exercise) return <Empty title="Exercise not found" />;

  return (
    <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{exercise.name}</Text>

        {/*
          * The bench angle, directly under the name, because "incline" on its own is the one
          * instruction in this catalog you cannot follow without already knowing the answer.
          * See catalog/slope.ts - these are conventions, not data, so the wording hedges.
          */}
        {slope ? (
          <View style={s.slope} testID="slope">
            <Ionicons name="options-outline" size={16} color={theme.color.accent} />
            <Text style={s.slopeText}>
              <Text style={s.slopeDegrees}>Bench at about {slope.degrees}. </Text>
              {slope.why}
            </Text>
          </View>
        ) : null}

        <View style={s.facts}>
          {exercise.equipment ? <Chip label={titleCase(exercise.equipment)} /> : null}
          <Chip label={titleCase(exercise.level)} />
          {exercise.mechanic ? <Chip label={titleCase(exercise.mechanic)} /> : null}
          {exercise.force ? <Chip label={`${titleCase(exercise.force)} force`} /> : null}
          <Chip label={titleCase(exercise.category)} />
          <Chip label={SET_KIND_LABEL[exercise.kind]} />
          {/* So the weight in the history below is read as one hand's, not the pair's. */}
          {isPerSideLoad(exercise) ? <Chip label="Weight per hand" tone="primary" /> : null}
        </View>

        {/*
          * The dataset ships a start and an end frame; side by side they read as the movement.
          * Side by side is also small, so either one opens full screen and zoomable on a tap -
          * where the elbow is, or how far the bar travels, is not legible at this size.
          */}
        {showPhotos && photos.length > 0 ? (
          <View style={s.images}>
            {photos.map((photo, i) => (
              <Pressable
                key={photo.uri}
                accessibilityRole="button"
                accessibilityLabel={`${exercise.name}, ${photo.caption.toLowerCase()} position. Opens full screen.`}
                testID={`photo-${i}`}
                onPress={() => setViewing(i)}
                style={s.imageWrap}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={s.image}
                  resizeMode="cover"
                  accessibilityLabel={`${exercise.name}, position ${i + 1}`}
                />
                <Text style={s.imageCaption}>{photo.caption}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <ImageViewer images={photos} index={viewing} onClose={() => setViewing(null)} />

        <Card>
          <H2>Muscles involved</H2>
          <Dim style={{ marginTop: theme.space(1) }}>
            Drawn the same way as the Body tab. Solid colour is the muscle this movement targets;
            cooler shades are the ones assisting it.
          </Dim>
          <View style={{ marginTop: theme.space(3) }}>
            <BodyMap values={muscleValues} max={1} scale={0.72} gender={bodyGender} />
          </View>
        </Card>

        <Card>
          <H2>Breakdown</H2>
          <Dim style={{ marginTop: theme.space(1) }}>
            Primary — tap one to see every exercise that targets it
          </Dim>
          <View style={s.muscleRow}>
            {exercise.primaryMuscles.map((m) => (
              <Chip
                key={m}
                label={MUSCLE_LABEL[m]}
                tone="primary"
                onPress={() => openMuscle(m)}
                testID={`muscle-link-${m}`}
              />
            ))}
          </View>
          {exercise.secondaryMuscles.length > 0 ? (
            <>
              <Dim style={{ marginTop: theme.space(3) }}>Secondary</Dim>
              <View style={s.muscleRow}>
                {exercise.secondaryMuscles.map((m) => (
                  <Chip
                    key={m}
                    label={MUSCLE_LABEL[m]}
                    tone="secondary"
                    onPress={() => openMuscle(m)}
                    testID={`muscle-link-${m}`}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {/*
          * The way in, for a movement you cannot do yet. Every rung carries the published
          * progression it came from, because a suggestion with no source behind it is a guess -
          * and a plausible guess is exactly what the automatic version produced.
          */}
        {ladder.length > 0 ? (
          <Card testID="ladder">
            <H2>Not there yet?</H2>
            <Dim style={{ marginTop: theme.space(1) }}>
              Work down this list until you find one you can do for three sets, then climb back
              up. Nothing here trains the movement as well as the movement — it gets you to it.
            </Dim>
            {ladder.map((step, i) => (
              <View key={step.easier} style={s.rung}>
                <Text style={s.rungNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{exerciseName(step.easier)}</Body>
                  <Dim style={{ lineHeight: 18 }}>{step.why}</Dim>
                  <Text
                    style={s.rungSource}
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(step.source)}
                  >
                    Source
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/*
          * Coaches, not the app, explaining the movement. Each carries the name and the caption
          * it was accepted on - see src/catalog/coaching.ts for why that is the bar.
          */}
        {videos.length > 0 ? (
          <Card testID="coaching">
            <H2>Watch it done</H2>
            <Dim style={{ marginTop: theme.space(1) }}>
              Opens in Instagram. Chosen for the coach and what the post itself says it covers.
            </Dim>
            {videos.map((v) => (
              <Pressable
                key={v.url}
                accessibilityRole="link"
                accessibilityLabel={`${v.caption}, by ${v.coach}. Opens Instagram.`}
                testID={`video-${v.handle}`}
                onPress={() => void Linking.openURL(v.url)}
                style={s.video}
              >
                <Ionicons name="logo-instagram" size={20} color={theme.color.accent} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{v.coach}</Body>
                  <Dim numberOfLines={2}>{v.caption}</Dim>
                </View>
                <Ionicons name="open-outline" size={16} color={theme.color.textFaint} />
              </Pressable>
            ))}
          </Card>
        ) : null}

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
          {/*
            * The total in the heading, because the list below is capped at forty rows - without
            * it, someone two hundred sets into their bench press cannot see that from here.
            */}
          <H2>
            History
            {history.length > 0 ? (
              <Text style={s.histCount} testID="history-count">
                {`  ${history.length} set${history.length === 1 ? '' : 's'}`}
              </Text>
            ) : null}
          </H2>
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
  slope: {
    flexDirection: 'row',
    gap: theme.space(2),
    marginTop: theme.space(2),
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.accent,
  },
  slopeText: { flex: 1, color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 19 },
  slopeDegrees: { color: theme.color.text, fontWeight: '700' },
  // Sits inside the heading, so it has to read as a subtitle rather than part of the title.
  histCount: { color: theme.color.textFaint, fontSize: theme.font.small, fontWeight: '600' },
  video: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rung: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(3) },
  rungNum: {
    color: theme.color.accent,
    fontWeight: '800',
    fontSize: theme.font.small,
    width: 16,
    lineHeight: 21,
  },
  rungSource: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
});
