import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { getExercise, SET_KIND_LABEL, type SetKind } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { formatDuration } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { Button, Card, Chip, Dim, Empty, Screen } from '@/ui/components';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { useConfirm } from '@/ui/confirm';
import { SetFields } from '@/ui/SetFields';
import { theme } from '@/ui/theme';

const KINDS: SetKind[] = ['weight_reps', 'reps', 'time', 'distance_time'];
const REST_OPTIONS = [0, 45, 60, 90, 120, 180, 300];

export default function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useStore((s) => s.plans.find((p) => p.id === id));
  const unit = useStore((s) => s.settings.unit);
  const renamePlan = useStore((s) => s.renamePlan);
  const removePlanItem = useStore((s) => s.removePlanItem);
  const movePlanItem = useStore((s) => s.movePlanItem);
  const setPlanItemKind = useStore((s) => s.setPlanItemKind);
  const setPlanItemRest = useStore((s) => s.setPlanItemRest);
  const addPlanTemplate = useStore((s) => s.addPlanTemplate);
  const removePlanTemplate = useStore((s) => s.removePlanTemplate);
  const updatePlanTemplate = useStore((s) => s.updatePlanTemplate);
  const startSession = useStore((s) => s.startSession);
  const confirm = useConfirm();

  const [expanded, setExpanded] = useState<string | null>(null);

  if (!plan) {
    return (
      <Screen>
        <Empty title="Plan not found" hint="It may have been deleted." />
      </Screen>
    );
  }

  async function handleStart() {
    if (!plan) return;
    if (plan.items.length === 0) {
      await confirm({
        title: 'Empty plan',
        message: 'Add at least one exercise before starting.',
        cancelLabel: null,
      });
      return;
    }
    const sessionId = startSession(plan.id);
    if (sessionId) router.replace(`/session/${sessionId}`);
  }

  const totalSets = plan.items.reduce((n, i) => n + i.templates.length, 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: plan.name }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={s.label}>PLAN NAME</Text>
          <TextInput
            testID="plan-name"
            value={plan.name}
            onChangeText={(t) => renamePlan(plan.id, t)}
            style={s.nameInput}
            placeholderTextColor={theme.color.textFaint}
          />
          <Dim>
            {plan.items.length} exercise{plan.items.length === 1 ? '' : 's'} · {totalSets} sets
          </Dim>
        </Card>

        {plan.items.length === 0 ? (
          <Empty
            title="No exercises yet"
            hint="Add movements from the catalog, then set how many sets you want and at what weight."
          />
        ) : null}

        {plan.items.map((item, index) => {
          const exercise = getExercise(item.exerciseId);
          const isOpen = expanded === item.id;
          const muscles = exercise?.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') ?? '';
          return (
            <ExerciseCard
              key={item.id}
              exerciseId={item.exerciseId}
              subtitle={muscles ? `${item.templates.length} sets · ${muscles}` : `${item.templates.length} sets`}
              status={`${item.templates.length}`}
              expanded={isOpen}
              onToggle={() => setExpanded(isOpen ? null : item.id)}
              onHowTo={() => router.push(`/exercise/${item.exerciseId}`)}
              testID={`item-${item.id}`}
            >
              {item.templates.map((template, i) => (
                <View key={template.id} style={s.setRow}>
                  <Text style={s.setNum}>{i + 1}</Text>
                  <SetFields
                    kind={item.kind}
                    values={template}
                    unit={unit}
                    idPrefix={`tpl-${template.id}`}
                    onChange={(patch) => updatePlanTemplate(plan.id, item.id, template.id, patch)}
                  />
                  <View style={{ flex: 1 }} />
                  <Pressable
                    accessibilityLabel="Remove set"
                    hitSlop={8}
                    onPress={() => removePlanTemplate(plan.id, item.id, template.id)}
                  >
                    <Ionicons name="close" size={18} color={theme.color.textFaint} />
                  </Pressable>
                </View>
              ))}

              <Button
                label="+ Add set"
                variant="secondary"
                style={{ marginTop: theme.space(2) }}
                onPress={() => addPlanTemplate(plan.id, item.id)}
                testID={`add-template-${item.id}`}
              />

              <View style={s.options}>
                <Text style={s.label}>REST BETWEEN SETS</Text>
                <View style={s.optionRow}>
                  {REST_OPTIONS.map((sec) => (
                    <Chip
                      key={sec}
                      label={sec === 0 ? 'None' : formatDuration(sec)}
                      active={item.restSec === sec}
                      onPress={() => setPlanItemRest(plan.id, item.id, sec)}
                    />
                  ))}
                </View>

                <Text style={[s.label, { marginTop: theme.space(3) }]}>WHAT THIS SET RECORDS</Text>
                <View style={s.optionRow}>
                  {KINDS.map((k) => (
                    <Chip
                      key={k}
                      label={SET_KIND_LABEL[k]}
                      active={item.kind === k}
                      onPress={() => setPlanItemKind(plan.id, item.id, k)}
                    />
                  ))}
                </View>
                <Dim style={{ marginTop: theme.space(2) }}>
                  Changing this resets the sets above, since the old numbers no longer apply.
                </Dim>

                <View style={s.itemActions}>
                  <Button
                    label="Move up"
                    variant="secondary"
                    disabled={index === 0}
                    onPress={() => movePlanItem(plan.id, item.id, -1)}
                  />
                  <Button
                    label="Move down"
                    variant="secondary"
                    disabled={index === plan.items.length - 1}
                    onPress={() => movePlanItem(plan.id, item.id, 1)}
                  />
                  <View style={{ flex: 1 }} />
                  <Button
                    label="Remove"
                    variant="danger"
                    onPress={() => removePlanItem(plan.id, item.id)}
                    testID={`remove-item-${item.id}`}
                  />
                </View>
              </View>
            </ExerciseCard>
          );
        })}

        <Button
          label="+ Add exercise"
          variant="secondary"
          onPress={() => router.push(`/picker?planId=${plan.id}`)}
          testID="add-exercise"
        />
      </ScrollView>

      <View style={s.footer}>
        <Button label="Start this workout" onPress={() => void handleStart()} testID="start-plan" />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(6) },
  label: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: theme.space(1.5),
  },
  nameInput: {
    color: theme.color.text,
    fontSize: theme.font.h2,
    fontWeight: '700',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2.5),
    marginBottom: theme.space(2),
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(1),
  },
  setNum: {
    color: theme.color.textFaint,
    fontSize: theme.font.small,
    fontWeight: '800',
    width: 16,
  },
  itemActions: {
    flexDirection: 'row',
    gap: theme.space(2),
    marginTop: theme.space(2),
    alignItems: 'center',
  },
  options: {
    marginTop: theme.space(3),
    paddingTop: theme.space(3),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1.5) },
  footer: {
    padding: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
});
