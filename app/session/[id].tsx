import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  exerciseName,
  getExercise,
  implementWord,
  isPerSideLoad,
  regressionFor,
  type SetKind,
} from '@/catalog';
import { countLoggedSets } from '@/analytics/volume';
import { formatDuration, relativeTime } from '@/lib/format';
import { orderEntries } from '@/lib/sessionOrder';
import type { SessionEntry, SessionSet, SetValues } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Button, Dim, Empty, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { HoldTimer } from '@/ui/HoldTimer';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { RestTimer } from '@/ui/RestTimer';
import { SetFields } from '@/ui/SetFields';
import { theme } from '@/ui/theme';
import { useKeyboardOpen } from '@/ui/useViewportHeight';

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
  /*
   * A held set is the only kind you cannot count yourself, so it gets a stopwatch. Offered for
   * time-based sets only; everything else is a number you already know when you finish.
   */
  const [timing, setTiming] = useState(false);

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

      {/*
        * Beside the seconds it is going to fill in, not over by the tick.
        *
        * It sat at the far right of the row, a thumb's width from Record, where the two most
        * consequential buttons in the app - "measure this set" and "this set happened" - were
        * neighbours with nothing between them. Here it reads as part of the field it writes to,
        * and a mis-tap costs you a sheet you close rather than a set you did not do.
        */}
      {kind === 'time' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Time this set"
          testID={`time-${set.id}`}
          hitSlop={8}
          onPress={() => setTiming(true)}
          style={s.timeBtn}
        >
          <Ionicons name="stopwatch-outline" size={19} color={theme.color.accent} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }} />

      {timing ? (
        <HoldTimer
          target={set.timeSec ?? 0}
          onClose={() => setTiming(false)}
          onDone={(seconds) => {
            // Record what was actually held, then mark the set done - the same two things you
            // would otherwise do by hand, in the order that leaves the number right.
            onChange(set.id, { timeSec: seconds });
            if (!logged) onToggle(set.id);
          }}
        />
      ) : null}

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
          color={logged ? theme.color.onAccent : theme.color.textFaint}
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
  onSwap,
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
  onSwap: (entryId: string, exerciseId: string) => void;
}) {
  const exercise = getExercise(entry.exerciseId);
  const name = exerciseName(entry.exerciseId);
  const perSide = exercise !== undefined && isPerSideLoad(exercise);
  const easier = regressionFor(entry.exerciseId);
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
      {/*
        * Offered only while nothing here has been recorded. Once a set is down you are doing
        * this exercise, and the question "can you do it?" has been answered.
        */}
      {easier && done === 0 ? (
        <View style={s.swap} testID={`easier-${entry.id}`}>
          <View style={{ flex: 1 }}>
            <Dim style={{ lineHeight: 18 }}>
              Not there yet?{' '}
              {/*
                * The suggestion is only useful if you know what it is, and most people will not
                * recognise the name - so it opens the how-to page.
                *
                * A Text with onPress rather than a Pressable: this sits mid-sentence, and a
                * Pressable is a block box that would break the line around it. It also keeps
                * react-native-web from nesting a <button> inside the Swap button's row.
                */}
              <Text
                style={s.swapName}
                onPress={() => router.push(`/exercise/${easier.easier}`)}
                accessibilityRole="link"
                accessibilityHint={`Show how to do ${exerciseName(easier.easier)}`}
                testID={`easier-name-${entry.id}`}
              >
                {exerciseName(easier.easier)}
              </Text>{' '}
              — {easier.why}
            </Dim>
          </View>
          <Button
            label="Swap"
            variant="secondary"
            onPress={() => onSwap(entry.id, easier.easier)}
            testID={`swap-${entry.id}`}
          />
        </View>
      ) : null}

      {perSide ? (
        <Dim style={s.perSide} testID={`per-side-${entry.id}`}>
          Weight is per {implementWord(exercise!)} — one in each hand. Your total lifted counts
          both.
        </Dim>
      ) : null}

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

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useStore((st) => st.sessions.find((x) => x.id === id));
  const unit = useStore((st) => st.settings.unit);
  const updateSet = useStore((st) => st.updateSet);
  const toggleSetLogged = useStore((st) => st.toggleSetLogged);
  const removeSet = useStore((st) => st.removeSet);
  const addSet = useStore((st) => st.addSet);
  const removeSessionEntry = useStore((st) => st.removeSessionEntry);
  const swapSessionExercise = useStore((st) => st.swapSessionExercise);
  const endSession = useStore((st) => st.endSession);
  const discardSession = useStore((st) => st.discardSession);
  const confirm = useConfirm();
  const typing = useKeyboardOpen();

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

  const handleSwap = useCallback(
    (entryId: string, exerciseId: string) => swapSessionExercise(id, entryId, exerciseId),
    [id, swapSessionExercise],
  );

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
  const ordered = useMemo(() => (session ? orderEntries(session.entries) : []), [session]);

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
            onSwap={handleSwap}
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

      {!finished && !typing ? (
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
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(6) },
  entryActions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(2) },
  perSide: { paddingBottom: theme.space(2), lineHeight: 18 },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(2),
    marginBottom: theme.space(1),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  // Underlined because it is a link, and nothing else in this row looks tappable except a button.
  swapName: { color: theme.color.text, fontWeight: '700', textDecorationLine: 'underline' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(1),
    paddingHorizontal: theme.space(1),
    borderRadius: theme.radius.sm,
  },
  setRowLogged: { backgroundColor: 'rgba(74,222,128,0.08)' },
  // Boxed like the field it belongs to, so it reads as "measure this" rather than as one more
  // icon in the row of actions at the other end.
  timeBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
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
