import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useStore } from '@/store/useStore';
import { Button, Screen } from '@/ui/components';
import { ExerciseList } from '@/ui/ExerciseList';
import { theme } from '@/ui/theme';

/**
 * Shared "add exercise" modal. Targets either a plan or a live session depending on the
 * param it was opened with, and stays open so several exercises can be chosen in one visit.
 *
 * A TOGGLE, NOT A TALLY
 * Tapping a row used to append another copy, so a second tap - which is what anyone does when
 * they are not sure the first one registered, or when they change their mind - quietly gave you
 * the same exercise twice. It counted taps when what it should track is whether the exercise is
 * in the plan. Now the tick is read from the plan itself, and tapping a ticked row takes it out
 * again. There is one exception, below, and it is the one that protects recorded work.
 */
export default function PickerScreen() {
  const { planId, sessionId } = useLocalSearchParams<{ planId?: string; sessionId?: string }>();
  const plan = useStore((s) => s.plans.find((p) => p.id === planId));
  const session = useStore((s) => s.sessions.find((x) => x.id === sessionId));
  const addPlanItem = useStore((s) => s.addPlanItem);
  const removePlanItem = useStore((s) => s.removePlanItem);
  const addSessionExercise = useStore((s) => s.addSessionExercise);
  const removeSessionEntry = useStore((s) => s.removeSessionEntry);

  /*
   * What this visit put there, and it only ever matters for a FINISHED workout.
   *
   * The history editor opens this same screen, and adding to a workout that has ended stamps
   * the set as recorded on the spot - there is no workout left to record it during. So in that
   * one case "recorded" says nothing about what the user did, and without this the padlock
   * would snap shut on the tap just made, leaving no way to undo it from here.
   *
   * In a live workout a recorded set means someone ticked it, and that is protected however it
   * got there. The exemption below is deliberately not extended to it.
   */
  const addedHere = useRef(new Set<string>()).current;
  const finished = session !== undefined && session.endedAt !== null;

  /**
   * What the target already holds: exerciseId -> whether it can still be taken out.
   *
   * An exercise with a recorded set against it is locked. Removing it would delete work that
   * actually happened, from a list of nearly nine hundred names where the row above and the row
   * below look exactly the same - the one place in this app where a mis-tap could cost you
   * training history, and adding it back would not bring the sets with it.
   */
  const chosen = new Map<string, { removable: boolean }>();
  for (const item of plan?.items ?? []) chosen.set(item.exerciseId, { removable: true });
  for (const entry of session?.entries ?? []) {
    const recorded = entry.sets.some((x) => x.loggedAt !== null);
    const free = !recorded || (finished && addedHere.has(entry.exerciseId));
    const already = chosen.get(entry.exerciseId);
    chosen.set(entry.exerciseId, { removable: free && (already?.removable ?? true) });
  }

  const handleToggle = useCallback(
    (exerciseId: string) => {
      const current = useStore.getState();
      if (planId) {
        const target = current.plans.find((p) => p.id === planId);
        const existing = target?.items.filter((i) => i.exerciseId === exerciseId) ?? [];
        if (existing.length === 0) return addPlanItem(planId, exerciseId);
        // Every copy, because a plan written before this screen toggled may hold several.
        for (const item of existing) removePlanItem(planId, item.id);
        return;
      }
      if (!sessionId) return;
      const target = current.sessions.find((x) => x.id === sessionId);
      const existing = target?.entries.filter((e) => e.exerciseId === exerciseId) ?? [];
      if (existing.length === 0) {
        addedHere.add(exerciseId);
        return addSessionExercise(sessionId, exerciseId);
      }
      const mine = (target?.endedAt ?? null) !== null && addedHere.has(exerciseId);
      for (const entry of existing) {
        if (!mine && entry.sets.some((x) => x.loggedAt !== null)) continue;
        removeSessionEntry(sessionId, entry.id);
      }
      addedHere.delete(exerciseId);
    },
    [
      planId,
      sessionId,
      addedHere,
      addPlanItem,
      removePlanItem,
      addSessionExercise,
      removeSessionEntry,
    ],
  );

  const total = plan?.items.length ?? session?.entries.length ?? 0;

  return (
    <Screen>
      <ExerciseList
        onSelect={(exercise) => handleToggle(exercise.id)}
        accessory={(exercise) => {
          const state = chosen.get(exercise.id);
          if (state === undefined) {
            return <Ionicons name="add-circle-outline" size={22} color={theme.color.textDim} />;
          }
          /*
           * A filled box for "in the list, tap to take it out", and a padlock for "in the list
           * and staying". Two different states need two different pictures: a tick that
           * sometimes responds and sometimes does not is worse than either.
           */
          return state.removable ? (
            <View style={s.chosen} testID={`chosen-${exercise.id}`}>
              <Ionicons name="checkmark" size={15} color={theme.color.onAccent} />
            </View>
          ) : (
            <View style={s.locked} testID={`locked-${exercise.id}`}>
              <Ionicons name="lock-closed" size={13} color={theme.color.textFaint} />
            </View>
          );
        }}
      />
      <View style={s.footer}>
        <Button
          // The running total, not this visit's tally: the question when you are done adding is
          // how big the workout got, and the answer is the same whichever way you arrived at it.
          label={total > 0 ? `Done - ${total} exercise${total === 1 ? '' : 's'}` : 'Done'}
          onPress={() => router.back()}
          testID="picker-done"
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  footer: {
    padding: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  chosen: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.accent,
  },
  locked: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceAlt,
  },
});
