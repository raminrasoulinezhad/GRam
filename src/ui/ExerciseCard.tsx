import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { exerciseName } from '@/catalog';
import { slopeFor } from '@/catalog/slope';
import { Card } from './components';
import { ExerciseThumb } from './ExerciseThumb';
import { theme } from './theme';

/**
 * One exercise in a plan or a workout, collapsed to a single tappable row.
 *
 * A plan of eight movements is unreadable when every set of every exercise is on screen at
 * once - you cannot see the shape of the session, and in a gym you only care about the one
 * you are doing. So the row shows a photo, the name and where you are up to; tapping it opens
 * the sets underneath.
 */
export function ExerciseCard({
  exerciseId,
  subtitle,
  status,
  done,
  expanded,
  onToggle,
  onHowTo,
  children,
  testID,
}: {
  exerciseId: string;
  subtitle: string;
  /** Short right-aligned progress text, e.g. "2/3". */
  status?: string;
  /** Renders the row as finished. */
  done?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onHowTo?: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const name = exerciseName(exerciseId);
  /*
   * The bench angle joins the subtitle rather than getting a row of its own. This card is the
   * one you read while setting up, so it is exactly where the angle is wanted - but it is a
   * detail, and the set count is the headline.
   */
  const slope = slopeFor(exerciseId);
  const line = slope ? `${subtitle} · ${slope.degrees}` : subtitle;

  return (
    <Card style={[s.card, done && s.cardDone]}>
      {/*
       * The thumbnail is its own control - it opens the description - so it sits beside the
       * expand target rather than inside it. Nested Pressables become nested <button> elements
       * on web, which is invalid HTML and reads as two overlapping controls to a screen reader.
       */}
      <View style={s.header}>
        <ExerciseThumb exerciseId={exerciseId} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${line}${expanded ? ', open' : ', closed'}`}
          onPress={onToggle}
          testID={testID}
          style={s.headerMain}
        >
          <View style={s.headerText}>
            <Text style={s.name} numberOfLines={2}>
              {name}
            </Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {line}
            </Text>
          </View>

          {done ? (
            <View
              style={s.doneBadge}
              accessibilityLabel="Complete"
              testID={testID ? `${testID}-done` : undefined}
            >
              <Ionicons name="checkmark" size={15} color={theme.color.onAccent} />
            </View>
          ) : status ? (
            <Text style={s.status}>{status}</Text>
          ) : null}

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.color.textFaint}
          />
        </Pressable>
      </View>

      {expanded ? (
        <View style={s.body}>
          {onHowTo ? (
            <Pressable
              accessibilityRole="button"
              onPress={onHowTo}
              style={s.howTo}
              testID={`howto-${exerciseId}`}
            >
              <Ionicons name="help-circle-outline" size={15} color={theme.color.textDim} />
              <Text style={s.howToText}>How to do this</Text>
            </Pressable>
          ) : null}
          {children}
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { padding: theme.space(2.5) },
  cardDone: { borderColor: theme.color.accentDim },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.space(3) },
  // Fills the rest of the row so the whole card except the picture still toggles it.
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.space(3) },
  headerText: { flex: 1, gap: 2 },
  name: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  subtitle: { color: theme.color.textDim, fontSize: theme.font.tiny },
  status: { color: theme.color.textDim, fontSize: theme.font.small, fontWeight: '800' },
  doneBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: theme.space(3),
    paddingTop: theme.space(3),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    gap: theme.space(1),
  },
  howTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(1.5),
    paddingBottom: theme.space(2),
  },
  howToText: { color: theme.color.textDim, fontSize: theme.font.tiny, fontWeight: '600' },
});
