import { memo, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  exerciseName,
  getExercise,
  implementWord,
  isPerSideLoad,
  type SetKind,
} from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { countLoggedSets, rankMuscles, sessionTonnage, sessionVolume } from '@/analytics/volume';
import {
  formatDate,
  formatDuration,
  formatSet,
  formatTime,
  toDateInput,
  toDisplayWeight,
  toTimeInput,
  withDateInput,
  withTimeInput,
} from '@/lib/format';
import type { SessionEntry, SessionSet, SetValues } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Button, Card, Chip, Dim, Empty, H2, NameField, NumberField, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { SetFields } from '@/ui/SetFields';
import { theme } from '@/ui/theme';

/**
 * One set of a finished workout, editable.
 *
 * Memoised for the same reason the live session's row is: a long workout holds dozens of
 * these and a keystroke in one of them should not re-render the rest.
 *
 * There is no record/un-record toggle here. Every set in a finished workout is by definition
 * one that happened - endSession drops the rest - and an un-recorded set left inside history
 * would show on screen while counting for nothing in the volume, the tonnage or the body map.
 * Deleting is the way to say a set did not happen.
 */
const EditSetRow = memo(function EditSetRow({
  set,
  index,
  kind,
  unit,
  onChange,
  onRemove,
}: {
  set: SessionSet;
  index: number;
  kind: SetKind;
  unit: 'kg' | 'lb';
  onChange: (setId: string, patch: SetValues) => void;
  onRemove: (setId: string) => void;
}) {
  return (
    <View style={s.editRow}>
      <Text style={s.setNum}>{index + 1}</Text>
      <SetFields
        kind={kind}
        values={set}
        unit={unit}
        idPrefix={`edit-set-${set.id}`}
        onChange={(patch) => onChange(set.id, patch)}
      />
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete set"
        testID={`edit-del-${set.id}`}
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
  editing,
  onChangeSet,
  onRemoveSet,
  onAddSet,
  onRemoveEntry,
}: {
  entry: SessionEntry;
  unit: 'kg' | 'lb';
  editing: boolean;
  onChangeSet: (entryId: string, setId: string, patch: SetValues) => void;
  onRemoveSet: (entryId: string, setId: string) => void;
  onAddSet: (entryId: string) => void;
  onRemoveEntry: (entryId: string, name: string) => void;
}) {
  const exercise = getExercise(entry.exerciseId);
  const name = exerciseName(entry.exerciseId);
  const perSide = exercise !== undefined && isPerSideLoad(exercise);

  const handleChange = useCallback(
    (setId: string, patch: SetValues) => onChangeSet(entry.id, setId, patch),
    [entry.id, onChangeSet],
  );
  const handleRemove = useCallback(
    (setId: string) => onRemoveSet(entry.id, setId),
    [entry.id, onRemoveSet],
  );

  return (
    <Card testID={`history-entry-${entry.id}`}>
      <Text style={s.exName}>{name}</Text>

      {/* Only while editing: reading back a workout, the number means what it meant on the day. */}
      {editing && perSide ? (
        <Dim style={s.perSide} testID={`history-per-side-${entry.id}`}>
          Weight is per {implementWord(exercise!)}, one in each hand.
        </Dim>
      ) : null}

      {editing ? (
        <>
          {entry.sets.length === 0 ? (
            <Dim style={{ paddingVertical: theme.space(2) }}>
              No sets left. Add one, or remove the exercise.
            </Dim>
          ) : (
            entry.sets.map((set, i) => (
              <EditSetRow
                key={set.id}
                set={set}
                index={i}
                kind={entry.kind}
                unit={unit}
                onChange={handleChange}
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
              testID={`history-add-set-${entry.id}`}
            />
            <Button
              label="Remove"
              variant="danger"
              onPress={() => onRemoveEntry(entry.id, name)}
              testID={`history-remove-entry-${entry.id}`}
            />
          </View>
        </>
      ) : (
        entry.sets.map((set, i) => (
          <View key={set.id} style={s.setRow}>
            <Text style={s.setNum}>{i + 1}</Text>
            <Text style={s.setValue}>{formatSet(set, entry.kind, unit)}</Text>
            <View style={{ flex: 1 }} />
            <Dim>{set.loggedAt ? formatTime(set.loggedAt) : ''}</Dim>
          </View>
        ))
      )}
    </Card>
  );
});

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useStore((st) => st.sessions.find((x) => x.id === id));
  const unit = useStore((st) => st.settings.unit);
  const updateSet = useStore((st) => st.updateSet);
  const removeSet = useStore((st) => st.removeSet);
  const addSet = useStore((st) => st.addSet);
  const removeSessionEntry = useStore((st) => st.removeSessionEntry);
  const renameSession = useStore((st) => st.renameSession);
  const setSessionStart = useStore((st) => st.setSessionStart);
  const setSessionDuration = useStore((st) => st.setSessionDuration);
  const tidySession = useStore((st) => st.tidySession);
  const discardSession = useStore((st) => st.discardSession);
  const confirm = useConfirm();

  /*
   * History reads as a record until you say otherwise.
   *
   * The alternative - always editable - puts a delete button next to every set of every past
   * workout, where a mistap silently rewrites something you cannot get back. One tap on Edit
   * is a small price for that not being possible by accident.
   */
  const [editing, setEditing] = useState(false);

  const handleChangeSet = useCallback(
    (entryId: string, setId: string, patch: SetValues) => updateSet(id, entryId, setId, patch),
    [id, updateSet],
  );
  const handleRemoveSet = useCallback(
    (entryId: string, setId: string) => removeSet(id, entryId, setId),
    [id, removeSet],
  );
  const handleAddSet = useCallback((entryId: string) => addSet(id, entryId), [id, addSet]);

  const handleRemoveEntry = useCallback(
    (entryId: string, name: string) => {
      void (async () => {
        const ok = await confirm({
          title: 'Remove exercise?',
          message: `${name} and its sets will be dropped from this workout.`,
          confirmLabel: 'Remove',
          destructive: true,
        });
        if (ok) removeSessionEntry(id, entryId);
      })();
    },
    [id, removeSessionEntry, confirm],
  );

  if (!session) {
    return (
      <Screen>
        <Empty title="Workout not found" />
      </Screen>
    );
  }

  async function handleDelete() {
    if (!session) return;
    const ok = await confirm({
      title: 'Delete workout?',
      message: 'This removes it from your log and the body map.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) {
      discardSession(session.id);
      router.back();
    }
  }

  /** Finishing an edit tidies up after it: no exercise is left behind with nothing in it. */
  async function handleDone() {
    if (!session) return;
    tidySession(session.id);
    /*
     * The name field defaults a blank on blur, but blur is not guaranteed - tapping Done
     * straight from the keyboard, or leaving the screen, can skip it, and a workout with no
     * title at all is an unreadable row in the log. Finishing the edit is the reliable moment.
     */
    if (session.planName.trim() === '') renameSession(session.id, 'Workout');
    /*
     * Counted the way tidySession counts, not by how many rows are on screen. There are two
     * ways to empty a workout in here - deleting every set, and un-ticking every set - and the
     * second leaves rows in place that tidySession has just thrown away. Asking about row count
     * would skip the question on that path and leave a workout in the log with nothing in it.
     */
    const emptied = countLoggedSets(session) === 0;
    if (emptied) {
      const ok = await confirm({
        title: 'Nothing left in this workout',
        message: 'Every set has been removed. Delete the workout as well?',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep it',
        destructive: true,
      });
      if (ok) {
        discardSession(session.id);
        router.back();
        return;
      }
    }
    setEditing(false);
  }

  const sets = countLoggedSets(session);
  const tonnage = sessionTonnage(session);
  const muscles = rankMuscles(sessionVolume(session));
  const durationSec =
    session.endedAt !== null ? Math.round((session.endedAt - session.startedAt) / 1000) : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: session.planName }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          {editing ? (
            <>
              <Text style={s.label}>WORKOUT</Text>
              <NameField
                key={`name-${session.id}`}
                testID="history-name"
                initialValue={session.planName}
                onChange={(next) => renameSession(session.id, next)}
                onCommit={(current) => {
                  if (current.trim() === '') renameSession(session.id, 'Workout');
                }}
                placeholder="Workout"
                style={s.input}
              />
              <View style={s.whenRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>DATE</Text>
                  <NameField
                    key={`date-${session.id}`}
                    testID="history-date"
                    initialValue={toDateInput(session.startedAt)}
                    onChange={(next) => {
                      const at = withDateInput(session.startedAt, next);
                      if (at !== null) setSessionStart(session.id, at);
                    }}
                    placeholder="YYYY-MM-DD"
                    style={s.input}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Text style={s.label}>TIME</Text>
                  <NameField
                    key={`time-${session.id}`}
                    testID="history-time"
                    initialValue={toTimeInput(session.startedAt)}
                    onChange={(next) => {
                      const at = withTimeInput(session.startedAt, next);
                      if (at !== null) setSessionStart(session.id, at);
                    }}
                    placeholder="HH:MM"
                    style={s.input}
                  />
                </View>
              </View>
              {session.endedAt !== null ? (
                <View style={{ marginTop: theme.space(3) }}>
                  <Text style={s.label}>LENGTH</Text>
                  <NumberField
                    testID="history-length"
                    value={Math.round(durationSec / 60)}
                    suffix="min"
                    width={140}
                    step={5}
                    onChange={(n) => setSessionDuration(session.id, (n ?? 0) * 60)}
                  />
                </View>
              ) : null}
              <Dim style={{ marginTop: theme.space(2) }}>
                Moving a workout moves every set in it, so it counts on the day you did it.
              </Dim>
            </>
          ) : (
            <>
              <Text style={s.title}>{session.planName}</Text>
              <Dim testID="history-when">
                {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
                {durationSec > 0 ? ` · ${formatDuration(durationSec)}` : ''}
              </Dim>
            </>
          )}
          <View style={s.statRow}>
            <View>
              <Text style={s.statValue}>{sets}</Text>
              <Text style={s.statLabel}>sets</Text>
            </View>
            <View>
              <Text style={s.statValue}>{session.entries.length}</Text>
              <Text style={s.statLabel}>exercises</Text>
            </View>
            {tonnage > 0 ? (
              <View>
                <Text style={s.statValue}>
                  {Math.round(toDisplayWeight(tonnage, unit)).toLocaleString()}
                </Text>
                <Text style={s.statLabel}>{unit} moved</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {muscles.length > 0 ? (
          <Card>
            <H2>Muscles worked</H2>
            <View style={s.chips}>
              {muscles.map(({ muscle, value }) => (
                <Chip key={muscle} label={`${MUSCLE_LABEL[muscle]} ${value}`} tone="primary" />
              ))}
            </View>
          </Card>
        ) : null}

        {session.entries.length === 0 ? (
          <Empty
            title="Nothing recorded"
            hint={
              editing
                ? 'Add an exercise below to say what you did.'
                : 'Edit this workout to add what you did.'
            }
          />
        ) : null}

        {session.entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            unit={unit}
            editing={editing}
            onChangeSet={handleChangeSet}
            onRemoveSet={handleRemoveSet}
            onAddSet={handleAddSet}
            onRemoveEntry={handleRemoveEntry}
          />
        ))}

        {editing ? (
          <Button
            label="+ Add exercise"
            variant="secondary"
            onPress={() => router.push(`/picker?sessionId=${session.id}`)}
            testID="history-add-exercise"
          />
        ) : null}
      </ScrollView>

      <View style={s.footer}>
        {editing ? (
          <>
            <Button
              label="Done"
              onPress={() => void handleDone()}
              style={{ flex: 1 }}
              testID="history-done"
            />
            <Button
              label="Delete"
              variant="danger"
              onPress={() => void handleDelete()}
              testID="delete-workout"
            />
          </>
        ) : (
          <Button
            label="Edit this workout"
            variant="secondary"
            onPress={() => setEditing(true)}
            style={{ flex: 1 }}
            testID="history-edit"
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(6) },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800', letterSpacing: -0.5 },
  label: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: theme.space(1),
  },
  input: {
    backgroundColor: theme.color.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    color: theme.color.text,
    fontSize: theme.font.body,
    fontWeight: '600',
    paddingVertical: theme.space(2.5),
    paddingHorizontal: theme.space(3),
  },
  whenRow: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(3) },
  statRow: { flexDirection: 'row', gap: theme.space(6), marginTop: theme.space(3) },
  statValue: { color: theme.color.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: theme.color.textFaint, fontSize: theme.font.tiny, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1), marginTop: theme.space(2) },
  exName: {
    color: theme.color.text,
    fontSize: theme.font.h3,
    fontWeight: '700',
    marginBottom: theme.space(2),
  },
  entryActions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(2) },
  perSide: { paddingBottom: theme.space(1), lineHeight: 18 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(1),
  },
  setNum: { color: theme.color.textFaint, fontSize: theme.font.small, fontWeight: '800', width: 16 },
  setValue: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: theme.space(2),
    padding: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
});
