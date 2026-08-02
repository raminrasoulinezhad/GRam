import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EXERCISES,
  MUSCLES,
  focusMuscles,
  recommendedRanks,
  searchExercises,
  type Exercise,
  type Muscle,
} from '@/catalog';
import { titleCase } from '@/lib/format';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { selectSessions, setCountsByExercise, useStore } from '@/store/useStore';
import { Chip, ChipRow, Empty } from './components';
import { ExerciseThumb } from './ExerciseThumb';
import { theme } from './theme';

type Props = {
  onSelect: (exercise: Exercise) => void;
  /** Rendered at the right edge of each row - e.g. a plus icon in the picker. */
  accessory?: (exercise: Exercise) => React.ReactNode;
  header?: React.ReactNode;
};

export function ExerciseList({ onSelect, accessory, header }: Props) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);

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
       * The only filter. It keeps exercises whose PRIMARY muscle this is, so tapping Chest gets
       * you chest exercises rather than the hundred movements that involve the chest somewhere.
       *
       * Equipment, category and difficulty used to have chip rows of their own behind a toggle.
       * They are gone: nobody opened them, and the text search reads all three fields anyway -
       * "dumbbell chest", "beginner squat" and "cardio" all work, and rank better than a filter
       * would have, so removing the rows lost no capability and gave the list back its space.
       */}
      <ChipRow
        options={MUSCLES.map((m) => MUSCLE_LABEL[m])}
        value={muscle ? MUSCLE_LABEL[muscle] : null}
        onChange={(label) =>
          setMuscle(label === null ? null : (MUSCLES.find((m) => MUSCLE_LABEL[m] === label) ?? null))
        }
        allLabel="All muscles"
        testIDPrefix="muscle"
      />

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
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect(item)}
            style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.color.surfaceAlt }]}
            testID={`exercise-${item.id}`}
          >
            <ExerciseThumb exerciseId={item.id} />
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
                {item.primaryMuscles.map((m) => (
                  <Chip key={m} label={MUSCLE_LABEL[m]} tone="primary" />
                ))}
                {item.equipment ? <Chip label={titleCase(item.equipment)} tone="secondary" /> : null}
                {item.mechanic ? <Chip label={titleCase(item.mechanic)} tone="secondary" /> : null}
              </View>
            </View>
            {accessory ? (
              accessory(item)
            ) : (
              <Ionicons name="chevron-forward" size={18} color={theme.color.textFaint} />
            )}
          </Pressable>
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
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
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
