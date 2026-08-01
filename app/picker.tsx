import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useStore } from '@/store/useStore';
import { Button, Screen } from '@/ui/components';
import { ExerciseList } from '@/ui/ExerciseList';
import { theme } from '@/ui/theme';

/**
 * Shared "add exercise" modal. Targets either a plan or a live session depending on the
 * param it was opened with, and stays open so several exercises can be added in one visit.
 */
export default function PickerScreen() {
  const { planId, sessionId } = useLocalSearchParams<{ planId?: string; sessionId?: string }>();
  const addPlanItem = useStore((s) => s.addPlanItem);
  const addSessionExercise = useStore((s) => s.addSessionExercise);
  const [added, setAdded] = useState<string[]>([]);

  function handleAdd(exerciseId: string) {
    if (planId) addPlanItem(planId, exerciseId);
    else if (sessionId) addSessionExercise(sessionId, exerciseId);
    setAdded((prev) => [...prev, exerciseId]);
  }

  return (
    <Screen>
      <ExerciseList
        onSelect={(exercise) => handleAdd(exercise.id)}
        accessory={(exercise) => {
          const count = added.filter((id) => id === exercise.id).length;
          return count > 0 ? (
            <View style={s.addedBadge}>
              <Ionicons name="checkmark" size={14} color={theme.color.accent} />
              {count > 1 ? <Text style={s.addedCount}>{count}</Text> : null}
            </View>
          ) : (
            <Ionicons name="add-circle-outline" size={22} color={theme.color.textDim} />
          );
        }}
      />
      <View style={s.footer}>
        <Button
          label={added.length > 0 ? `Done - added ${added.length}` : 'Done'}
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
  addedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addedCount: { color: theme.color.accent, fontWeight: '800', fontSize: theme.font.small },
});
