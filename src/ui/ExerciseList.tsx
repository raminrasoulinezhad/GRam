import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EXERCISES,
  focusMuscles,
  recommendedRanks,
  searchExercises,
  type Exercise,
} from '@/catalog';
import { slopeFor } from '@/catalog/slope';
import { titleCase } from '@/lib/format';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import {
  GROUP_LABEL,
  GROUP_MUSCLES,
  TRAINING_GROUPS,
  type TrainingGroup,
} from '@/analytics/balance';
import { selectSessions, setCountsByExercise, useStore } from '@/store/useStore';
import { Chip, Empty } from './components';
import { ExerciseThumb } from './ExerciseThumb';
import { theme } from './theme';

type Props = {
  onSelect: (exercise: Exercise) => void;
  /**
   * Opens with the search box already filled in - used when the caller knows what the user is
   * looking for, e.g. the week review asking for a chest exercise. Still fully editable, so it
   * narrows the starting point without taking the choice away.
   */
  initialQuery?: string;
  /** Rendered at the right edge of each row - e.g. a plus icon in the picker. */
  accessory?: (exercise: Exercise) => React.ReactNode;
  header?: React.ReactNode;
};

/** "1 set" / "24 sets", so the chip reads as a sentence rather than a bare number. */
function setsLabel(count: number): string {
  return `${count} set${count === 1 ? '' : 's'}`;
}

export function ExerciseList({ onSelect, accessory, header, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState<TrainingGroup | null>(null);
  const muscle = group ? GROUP_MUSCLES[group] : null;

  const sessions = useStore(selectSessions);
  const history = useMemo(() => setCountsByExercise(sessions), [sessions]);

  const results = useMemo(
    () => searchExercises({ query, muscle, history }),
    [query, muscle, history],
  );

  // When the search is about a muscle, the first two rows are the evidence-based picks for it.
  // Labelling them is the difference between a helpful order and an arbitrary one.
  const topPicks = useMemo(
    () => recommendedRanks(focusMuscles({ query, muscle })),
    [query, muscle],
  );

  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={s.searchRow}>
        <Ionicons name="search" size={16} color={theme.color.textFaint} />
        <TextInput
          testID="exercise-search"
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${EXERCISES.length} exercises, or a muscle`}
          placeholderTextColor={theme.color.textFaint}
          style={s.searchInput}
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            testID="clear-search"
            onPress={() => setQuery('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={theme.color.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {/*
       * The only filter, and every option is on screen at once.
       *
       * Nine tags fit in two wrapped lines, so nothing hides behind a horizontal scroll the way
       * seventeen muscles did - a filter you have to go looking for is one nobody uses. These
       * are the eight groups people actually plan around, the same ones the week review checks;
       * calves, abs, forearms and the rest are still a word away in the search box.
       *
       * Filtering keeps exercises whose PRIMARY muscle is in the group, so tapping Chest gets
       * chest exercises rather than the hundred movements that involve the chest somewhere.
       * Equipment, category and difficulty had rows of their own behind a toggle once; they are
       * gone, because the text search reads all three anyway.
       */}
      <View style={s.filters}>
        <Chip
          label="All"
          active={group === null}
          onPress={() => setGroup(null)}
          testID="muscle-all"
        />
        {TRAINING_GROUPS.map((g) => (
          <Chip
            key={g}
            label={GROUP_LABEL[g]}
            active={group === g}
            onPress={() => setGroup(group === g ? null : g)}
            testID={`muscle-${GROUP_LABEL[g]}`}
          />
        ))}
      </View>

      <Text style={s.count}>
        {results.length} exercise{results.length === 1 ? '' : 's'}
      </Text>

      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={16}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: theme.space(12) }}
        ListEmptyComponent={
          <Empty title="Nothing matches" hint="Try a different search or clear the filters." />
        }
        renderItem={({ item }) => (
          /*
           * Two press targets side by side, never one inside the other: the picture opens the
           * description, the rest of the row selects the exercise. Nesting them renders a
           * <button> inside a <button> on web - invalid HTML, and a screen reader announces two
           * overlapping controls with no boundary between them.
           */
          <View style={s.row}>
            <ExerciseThumb exerciseId={item.id} />
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                s.rowMain,
                pressed && { backgroundColor: theme.color.surfaceAlt },
              ]}
              testID={`exercise-${item.id}`}
            >
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  {topPicks.has(item.id) ? (
                    <View style={s.pick} testID={`top-pick-${item.id}`}>
                      <Ionicons name="star" size={10} color={theme.color.bg} />
                      <Text style={s.pickText}>TOP PICK</Text>
                    </View>
                  ) : null}
                  <Text style={s.name}>{item.name}</Text>
                </View>
                <View style={s.meta}>
                  {/*
                    * What you have actually done with it, ahead of what it is.
                    *
                    * Eight hundred-odd exercises all look equally plausible in a list, and the
                    * ones worth telling apart are the few you already train. This is the only
                    * place that separates "never tried" from "my main lift" without opening
                    * the exercise. Counted in sets - the unit the rest of the app reasons in,
                    * and a session count would call one warm-up set and five working sets the
                    * same amount of work.
                    */}
                  {(history.get(item.id) ?? 0) > 0 ? (
                    <Chip label={setsLabel(history.get(item.id)!)} testID={`logged-${item.id}`} />
                  ) : null}
                  {/*
                    * The bench angle, where "Incline" in the name does not say it. Tone
                    * "primary" because it is a setup instruction, not a fact about the kit.
                    */}
                  {slopeFor(item.id) ? (
                    <Chip
                      label={slopeFor(item.id)!.degrees}
                      tone="primary"
                      testID={`slope-${item.id}`}
                    />
                  ) : null}
                  {item.primaryMuscles.map((m) => (
                    <Chip key={m} label={MUSCLE_LABEL[m]} tone="primary" />
                  ))}
                  {item.equipment ? (
                    <Chip label={titleCase(item.equipment)} tone="secondary" />
                  ) : null}
                  {item.mechanic ? (
                    <Chip label={titleCase(item.mechanic)} tone="secondary" />
                  ) : null}
                </View>
              </View>
              {/* Accessories are badges and icons, never controls, so they stay inside. */}
              {accessory ? (
                accessory(item)
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.color.textFaint} />
              )}
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    margin: theme.space(4),
    marginBottom: theme.space(1),
    paddingHorizontal: theme.space(3),
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
  },
  searchInput: {
    flex: 1,
    color: theme.color.text,
    fontSize: theme.font.body,
    paddingVertical: theme.space(3),
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(1.5),
    paddingHorizontal: theme.space(4),
    paddingTop: theme.space(2),
    paddingBottom: theme.space(2.5),
  },
  count: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: theme.space(4),
    paddingBottom: theme.space(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingLeft: theme.space(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  // Carries the row's vertical padding so the tap target still spans the full row height,
  // and the right-hand padding so the chevron sits where it always did.
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingRight: theme.space(4),
    paddingVertical: theme.space(3),
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space(1.5) },
  name: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.accent,
  },
  pickText: {
    color: theme.color.bg,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1), marginTop: theme.space(1.5) },
});
