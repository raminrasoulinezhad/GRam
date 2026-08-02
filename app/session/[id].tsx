import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { exerciseName, type SetKind } from '@/catalog';
import { countLoggedSets, rankMuscles, sessionVolume } from '@/analytics/volume';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { formatDuration, relativeTime } from '@/lib/format';
import type { SessionEntry, SessionSet, SetValues } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Button, Chip, Dim, Empty, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { RestTimer } from '@/ui/RestTimer';
import { SetFields } from '@/ui/SetFields';
import { theme } from '@/ui/theme';

/**
 * One editable set. Memoised because a session can hold 40+ of these and every keystroke
 * in one of them would otherwise re-render the entire workout.
 */
const SetRow = memo(function SetRow({
  set,
  index,
  kind,
  unit,
  onChange,
  onToggle,
  onRemove,
}: {
  set: SessionSet;
  index: number;
  kind: SetKind;
  unit: 'kg' | 'lb';
  onChange: (setId: string, patch: SetValues) => void;
  onToggle: (setId: string) => void;
  onRemove: (setId: string) => void;
}) {
  const logged = set.loggedAt !== null;
  return (
    <View style={[s.setRow, logged && s.setRowLogged]}>
      <Text style={[s.setNum, logged && { color: theme.color.accent }]}>{index + 1}</Text>

      <SetFields
        kind={kind}
        values={set}
        unit={unit}
        idPrefix={`set-${set.id}`}
        onChange={(patch) => onChange(set.id, patch)}
      />

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={logged ? 'Un-record set' : 'Record set'}
        testID={`log-${set.id}`}
        hitSlop={6}
        onPress={() => onToggle(set.id)}
        style={[s.logBtn, logged && s.logBtnOn]}
      >
        <Ionicons
          name={logged ? 'checkmark' : 'ellipse-outline'}
          size={18}
          color={logged ? '#04120A' : theme.color.textFaint}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete set"
        testID={`del-${set.id}`}
        hitSlop={6}
        onPress={() => onRemove(set.id)}
      >
        <Ionicons name="trash-outline" size={17} color={theme.color.textFaint} />
      </Pressable>
    </View>
  );
});

const EntryCard = memo(function EntryCard({
  entry,
  unit,
  expanded,
  onToggleExpanded,
  onChange,
  onToggle,
  onRemoveSet,
  onAddSet,
  onRemoveEntry,
}: {
  entry: SessionEntry;
  unit: 'kg' | 'lb';
  expanded: boolean;
  onToggleExpanded: (entryId: string) => void;
  onChange: (entryId: string, setId: string, patch: SetValues) => void;
  onToggle: (entryId: string, setId: string, restSec: number) => void;
  onRemoveSet: (entryId: string, setId: string) => void;
  onAddSet: (entryId: string) => void;
  onRemoveEntry: (entryId: string, name: string) => void;
}) {
  const name = exerciseName(entry.exerciseId);
  const done = entry.sets.filter((x) => x.loggedAt !== null).length;
  const complete = entry.sets.length > 0 && done === entry.sets.length;

  const handleChange = useCallback(
    (setId: string, patch: SetValues) => onChange(entry.id, setId, patch),
    [entry.id, onChange],
  );
  const handleToggle = useCallback(
    (setId: string) => onToggle(entry.id, setId, entry.restSec),
    [entry.id, entry.restSec, onToggle],
  );
  const handleRemove = useCallback(
    (setId: string) => onRemoveSet(entry.id, setId),
    [entry.id, onRemoveSet],
  );

  return (
    <ExerciseCard
      exerciseId={entry.exerciseId}
      subtitle={
        entry.restSec > 0
          ? `${entry.sets.length} sets · ${formatDuration(entry.restSec)} rest`
          : `${entry.sets.length} sets`
      }
      status={`${done}/${entry.sets.length}`}
      done={complete}
      expanded={expanded}
      onToggle={() => onToggleExpanded(entry.id)}
      onHowTo={() => router.push(`/exercise/${entry.exerciseId}`)}
      testID={`entry-${entry.id}`}
    >
      {entry.sets.length === 0 ? (
        <Dim style={{ paddingVertical: theme.space(2) }}>
          No sets. Add one below, or remove this exercise.
        </Dim>
      ) : (
        entry.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i}
            kind={entry.kind}
            unit={unit}
            onChange={handleChange}
            onToggle={handleToggle}
            onRemove={handleRemove}
          />
        ))
      )}

      <View style={s.entryActions}>
        <Button
          label="+ Add set"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => onAddSet(entry.id)}
          testID={`add-set-${entry.id}`}
        />
        <Button
          label="Remove"
          variant="danger"
          onPress={() => void onRemoveEntry(entry.id, name)}
          testID={`remove-entry-${entry.id}`}
        />
      </View>
    </ExerciseCard>
  );
});

/**
 * Where an exercise sits in the workout: finished at the top, then what is under way, then
 * what has not been started.
 *
 * The list reorders as you record, which is the point - the run of exercises still to do stays
 * together at the bottom instead of being interrupted by the ones already ticked off. Sorting
 * is stable, so within each of the three groups the plan's own order survives.
 */
function progressRank(entry: SessionEntry): number {
  const logged = entry.sets.filter((x) => x.loggedAt !== null).length;
  if (logged === 0) return 2;
  return logged === entry.sets.length ? 0 : 1;
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useStore((st) => st.sessions.find((x) => x.id === id));
  const unit = useStore((st) => st.settings.unit);
  const updateSet = useStore((st) => st.updateSet);
  const toggleSetLogged = useStore((st) => st.toggleSetLogged);
  const removeSet = useStore((st) => st.removeSet);
  const addSet = useStore((st) => st.addSet);
  const removeSessionEntry = useStore((st) => st.removeSessionEntry);
  const endSession = useStore((st) => st.endSession);
  const discardSession = useStore((st) => st.discardSession);
  const confirm = useConfirm();

  const [rest, setRest] = useState<{ startedAt: number; seconds: number } | null>(null);

  /*
   * Which exercise is open. Initialised to the first one with sets still to record, so
   * reopening a workout mid-session lands you on what you were doing rather than a list of
   * closed rows. Only one is open at a time - the point of collapsing was to see the shape of
   * the session, which a screen full of open cards would undo.
   */
  const [openEntryId, setOpenEntryId] = useState<string | null>(() => {
    const current = useStore.getState().sessions.find((x) => x.id === id);
    const next = current?.entries.find((e) => e.sets.some((set) => set.loggedAt === null));
    return next?.id ?? current?.entries[0]?.id ?? null;
  });

  const handleToggleExpanded = useCallback(
    (entryId: string) => setOpenEntryId((open) => (open === entryId ? null : entryId)),
    [],
  );

  const handleChange = useCallback(
    (entryId: string, setId: string, patch: SetValues) => updateSet(id, entryId, setId, patch),
    [id, updateSet],
  );

  const handleToggle = useCallback(
    (entryId: string, setId: string, restSec: number) => {
      // Read the pre-toggle state so the timer starts on record and not on un-record.
      const before = useStore.getState().sessions.find((x) => x.id === id);
      const wasLogged =
        before?.entries
          .find((e) => e.id === entryId)
          ?.sets.find((x) => x.id === setId)?.loggedAt !== null;
      toggleSetLogged(id, entryId, setId);
      if (!wasLogged && restSec > 0) setRest({ startedAt: Date.now(), seconds: restSec });
    },
    [id, toggleSetLogged],
  );

  const handleRemoveSet = useCallback(
    (entryId: string, setId: string) => removeSet(id, entryId, setId),
    [id, removeSet],
  );

  const handleAddSet = useCallback((entryId: string) => addSet(id, entryId), [id, addSet]);

  const handleRemoveEntry = useCallback(
    async (entryId: string, name: string) => {
      const ok = await confirm({
        title: 'Remove exercise?',
        message: `${name} and its sets will be dropped from this workout.`,
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (ok) removeSessionEntry(id, entryId);
    },
    [id, removeSessionEntry, confirm],
  );

  const logged = useMemo(() => (session ? countLoggedSets(session) : 0), [session]);
  const ordered = useMemo(
    () => (session ? [...session.entries].sort((a, b) => progressRank(a) - progressRank(b)) : []),
    [session],
  );
  const worked = useMemo(
    () => (session ? rankMuscles(sessionVolume(session)).slice(0, 6) : []),
    [session],
  );

  if (!session) {
    return (
      <Screen>
        <Empty title="Workout not found" />
      </Screen>
    );
  }

  const finished = session.endedAt !== null;
  const totalSets = session.entries.reduce((n, e) => n + e.sets.length, 0);

  async function handleFinish() {
    if (logged === 0) {
      const discard = await confirm({
        title: 'Nothing recorded',
        message: 'No sets were recorded. Discard this workout instead of saving it?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep going',
        destructive: true,
      });
      if (discard) {
        discardSession(id);
        router.replace('/');
      }
      return;
    }
    const ok = await confirm({
      title: 'Finish workout?',
      message: `${logged} recorded set${logged === 1 ? '' : 's'} will be saved.`,
      confirmLabel: 'Finish',
    });
    if (ok) {
      endSession(id);
      router.replace('/(tabs)/history');
    }
  }

  async function handleDiscard() {
    const ok = await confirm({
      title: 'Discard workout?',
      message: 'Everything recorded in this session is lost.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (ok) {
      discardSession(id);
      router.replace('/');
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: session.planName }} />

      <View style={s.summary}>
        <View style={{ flex: 1 }}>
          <Text style={s.summaryBig}>
            {logged}
            <Text style={s.summarySmall}> / {totalSets} sets</Text>
          </Text>
          <Dim>Started {relativeTime(session.startedAt)}</Dim>
        </View>
        <View style={s.workedChips}>
          {worked.map(({ muscle, value }) => (
            <Chip key={muscle} label={`${MUSCLE_LABEL[muscle]} ${value}`} tone="primary" />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {session.entries.length === 0 ? (
          <Empty title="No exercises yet" hint="Add one to start recording sets." />
        ) : null}

        {ordered.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            unit={unit}
            expanded={openEntryId === entry.id}
            onToggleExpanded={handleToggleExpanded}
            onChange={handleChange}
            onToggle={handleToggle}
            onRemoveSet={handleRemoveSet}
            onAddSet={handleAddSet}
            onRemoveEntry={handleRemoveEntry}
          />
        ))}

        <Button
          label="+ Add exercise"
          variant="secondary"
          onPress={() => router.push(`/picker?sessionId=${id}`)}
          testID="session-add-exercise"
        />
      </ScrollView>

      <RestTimer
        startedAt={rest?.startedAt ?? null}
        seconds={rest?.seconds ?? 0}
        onDismiss={() => setRest(null)}
      />

      {!finished ? (
        <View style={s.footer}>
          <Button label="Finish workout" onPress={() => void handleFinish()} style={{ flex: 1 }} testID="finish" />
          <Button label="Discard" variant="danger" onPress={() => void handleDiscard()} testID="discard" />
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingBottom: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  summaryBig: { color: theme.color.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  summarySmall: { color: theme.color.textFaint, fontSize: theme.font.body, fontWeight: '600' },
  workedChips: {
    flex: 1.3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(1),
    justifyContent: 'flex-end',
  },
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(6) },
  entryActions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(2) },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(1),
    paddingHorizontal: theme.space(1),
    borderRadius: theme.radius.sm,
  },
  setRowLogged: { backgroundColor: 'rgba(74,222,128,0.08)' },
  setNum: { color: theme.color.textFaint, fontSize: theme.font.small, fontWeight: '800', width: 16 },
  logBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  logBtnOn: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  footer: {
    flexDirection: 'row',
    gap: theme.space(2),
    padding: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
});
