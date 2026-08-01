import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CATEGORIES,
  EQUIPMENT,
  LEVELS,
  MUSCLES,
  searchExercises,
  type Exercise,
  type Muscle,
} from '@/catalog';
import { titleCase } from '@/lib/format';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { Chip, ChipRow, Empty } from './components';
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
  const [equipment, setEquipment] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(
    () => searchExercises({ query, muscle, equipment, category, level }),
    [query, muscle, equipment, category, level],
  );

  const activeFilters = [muscle, equipment, category, level].filter(Boolean).length;

  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={s.searchRow}>
        <Ionicons name="search" size={16} color={theme.color.textFaint} />
        <TextInput
          testID="exercise-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search 873 exercises"
          placeholderTextColor={theme.color.textFaint}
          style={s.searchInput}
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.color.textFaint} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setFiltersOpen((v) => !v)}
          hitSlop={8}
          testID="toggle-filters"
        >
          <View style={s.filterToggle}>
            <Ionicons
              name="options"
              size={16}
              color={activeFilters > 0 ? theme.color.accent : theme.color.textFaint}
            />
            {activeFilters > 0 ? <Text style={s.filterCount}>{activeFilters}</Text> : null}
          </View>
        </Pressable>
      </View>

      {/* Muscle is always visible - browsing by muscle is the primary way lifters explore. */}
      <ChipRow
        options={MUSCLES.map((m) => MUSCLE_LABEL[m])}
        value={muscle ? MUSCLE_LABEL[muscle] : null}
        onChange={(label) =>
          setMuscle(label === null ? null : (MUSCLES.find((m) => MUSCLE_LABEL[m] === label) ?? null))
        }
        allLabel="All muscles"
      />

      {filtersOpen ? (
        <View>
          <ChipRow options={EQUIPMENT} value={equipment} onChange={setEquipment} allLabel="Any kit" />
          <ChipRow options={CATEGORIES} value={category} onChange={setCategory} allLabel="Any type" />
          <ChipRow options={LEVELS} value={level} onChange={setLevel} allLabel="Any level" />
        </View>
      ) : null}

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
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.name}</Text>
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
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  filterCount: { color: theme.color.accent, fontSize: theme.font.tiny, fontWeight: '800' },
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
  name: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1), marginTop: theme.space(1.5) },
});
