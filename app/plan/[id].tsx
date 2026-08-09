import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { getExercise } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { WEEKDAYS, WEEKDAY_LABEL, WEEKDAY_SHORT } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Button, Card, Chip, Dim, Empty, Screen } from '@/ui/components';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { useConfirm } from '@/ui/confirm';
import { SetFields } from '@/ui/SetFields';
import { theme } from '@/ui/theme';


export default function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useStore((s) => s.plans.find((p) => p.id === id));
  const unit = useStore((s) => s.settings.unit);
  const setPlanDay = useStore((s) => s.setPlanDay);
  const removePlanItem = useStore((s) => s.removePlanItem);
  const movePlanItem = useStore((s) => s.movePlanItem);
  const addPlanTemplate = useStore((s) => s.addPlanTemplate);
  const removePlanTemplate = useStore((s) => s.removePlanTemplate);
  const updatePlanTemplate = useStore((s) => s.updatePlanTemplate);
  const startSession = useStore((s) => s.startSession);
  const deletePlan = useStore((s) => s.deletePlan);
  const confirm = useConfirm();

  const [expanded, setExpanded] = useState<string | null>(null);

  if (!plan) {
    return (
      <Screen>
        <Empty title="Plan not found" hint="It may have been deleted." />
      </Screen>
    );
  }

  // An empty plan starts like any other - see the note on the Plans screen.
  function handleStart() {
    if (!plan) return;
    const sessionId = startSession(plan.id);
    if (sessionId) router.replace(`/session/${sessionId}`);
  }

  async function handleDelete() {
    if (!plan) return;
    const ok = await confirm({
      title: `Delete ${WEEKDAY_LABEL[plan.day]}?`,
      message:
        plan.items.length > 0
          ? `${plan.items.length} exercise${plan.items.length === 1 ? '' : 's'} will be removed from your week. Workouts you have already recorded from this plan are kept.`
          : 'This day will be removed from your week.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deletePlan(plan.id);
    // Back to the week, because the page this is on no longer describes anything.
    router.replace('/');
  }

  const totalSets = plan.items.reduce((n, i) => n + i.templates.length, 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: WEEKDAY_LABEL[plan.day] }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={s.label}>TRAINING DAY</Text>
          {/*
            * Choosing the day, not typing a name. Picking one already used swaps the two plans,
            * so rearranging a week is one tap rather than "free Wednesday first, then move".
            */}
          <View style={s.dayChips}>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={WEEKDAY_SHORT[day]}
                active={plan.day === day}
                onPress={() => setPlanDay(plan.id, day)}
                testID={`day-${day}`}
                // Seven across one row, as on My week. At full padding the last day or two
                // wrapped, and a week broken across two lines does not read as a week.
                compact
              />
            ))}
          </View>
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

              {/*
                * No "what this set records" picker and no rest picker.
                *
                * Both were asking the user to restate something already known. A plank is timed,
                * a sprint is distance and time, a bench press is weight and reps - the catalog
                * says so per exercise, and the set fields above are already laid out from it.
                * Rest comes from the default in Settings. Two rows of chips per exercise, on
                * every exercise, to re-enter facts the app has: they made the editor longer and
                * gave nobody anything. The store still exposes setPlanItemKind and
                * setPlanItemRest for a future per-exercise override worth surfacing.
                */}
              <View style={s.options}>
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

        {/*
          * Deleting the day lives here, at the bottom of the thing it deletes, rather than on
          * the week screen where it used to sit beside Start. Here you have scrolled past every
          * exercise in it, so you can see what you are throwing away - and the button is far
          * from the one you came to press.
          */}
        <View style={s.danger}>
          <Button
            label="Delete this plan"
            variant="danger"
            onPress={() => void handleDelete()}
            testID="delete-plan"
          />
          <Dim style={s.dangerHint}>
            Workouts you have already recorded from it are kept.
          </Dim>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Button label="Start this workout" onPress={handleStart} testID="start-plan" />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(6) },
  // Set apart from the editing above it, so it is never the button you meant to hit.
  danger: {
    marginTop: theme.space(6),
    paddingTop: theme.space(4),
    gap: theme.space(2),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  dangerHint: { textAlign: 'center' },
  label: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: theme.space(1.5),
  },
  dayChips: {
    flexDirection: 'row',
    // No wrapping. With `compact` chips all seven fit, and letting them wrap is what put
    // Sunday alone on a second line.
    gap: theme.space(1.5),
    marginTop: theme.space(2),
    marginBottom: theme.space(2),
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
  footer: {
    padding: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
});
