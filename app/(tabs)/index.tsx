import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { exerciseName } from '@/catalog';
import { relativeTime } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { Body, Button, Card, Dim, Empty, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { WeekReview } from '@/ui/WeekReview';
import { theme } from '@/ui/theme';

export default function PlansScreen() {
  const plans = useStore((s) => s.plans);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const createPlan = useStore((s) => s.createPlan);
  const deletePlan = useStore((s) => s.deletePlan);
  const duplicatePlan = useStore((s) => s.duplicatePlan);
  const startSession = useStore((s) => s.startSession);
  const startEmptySession = useStore((s) => s.startEmptySession);
  const confirm = useConfirm();

  const [draftName, setDraftName] = useState('');
  const activeSession = sessions.find((x) => x.id === activeSessionId);

  function handleCreate() {
    const id = createPlan(draftName);
    setDraftName('');
    router.push(`/plan/${id}`);
  }

  /*
   * An empty plan starts like any other.
   *
   * This used to refuse, which was inconsistent - "Start an empty workout" sits right below and
   * does exactly that - and wrong: turning up at the gym and building the session as you go is
   * a normal way to train. The session screen can add exercises live.
   */
  function handleStart(planId: string) {
    const id = startSession(planId);
    if (id) router.push(`/session/${id}`);
  }

  async function handleDelete(planId: string, name: string) {
    const ok = await confirm({
      title: 'Delete plan?',
      message: `"${name}" will be removed. Logged workouts are kept.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deletePlan(planId);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>
        {activeSession ? (
          <Pressable onPress={() => router.push(`/session/${activeSession.id}`)}>
            <Card style={s.resume}>
              <View style={{ flex: 1 }}>
                <Text style={s.resumeLabel}>WORKOUT IN PROGRESS</Text>
                <Text style={s.resumeName}>{activeSession.planName}</Text>
                <Dim>Started {relativeTime(activeSession.startedAt)}</Dim>
              </View>
              <Ionicons name="chevron-forward" size={22} color={theme.color.accent} />
            </Card>
          </Pressable>
        ) : null}

        {plans.length === 0 ? (
          <Empty
            title="No plans yet"
            hint="A plan is a reusable list of exercises with your default sets. Add one below, then start it at the gym."
          />
        ) : null}

        {plans.map((plan) => (
          <Card key={plan.id}>
            <Pressable onPress={() => router.push(`/plan/${plan.id}`)}>
              <View style={s.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{plan.name}</Text>
                  <Dim>
                    {plan.items.length} exercise{plan.items.length === 1 ? '' : 's'} ·{' '}
                    {plan.items.reduce((n, i) => n + i.templates.length, 0)} sets · updated{' '}
                    {relativeTime(plan.updatedAt)}
                  </Dim>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.color.textFaint} />
              </View>
              {plan.items.length > 0 ? (
                <Body style={s.preview} numberOfLines={2}>
                  {plan.items.map((i) => exerciseName(i.exerciseId)).join(' · ')}
                </Body>
              ) : null}
            </Pressable>
            <View style={s.planActions}>
              <Button
                label="Start"
                onPress={() => handleStart(plan.id)}
                style={{ flex: 1 }}
                testID={`start-${plan.id}`}
              />
              <Button label="Edit" variant="secondary" onPress={() => router.push(`/plan/${plan.id}`)} />
              <Button label="Copy" variant="secondary" onPress={() => duplicatePlan(plan.id)} />
              <Button label="Delete" variant="danger" onPress={() => void handleDelete(plan.id, plan.name)} />
            </View>
          </Card>
        ))}

        {/* Creating a plan is a once-in-a-while act, so it sits after the plans rather than
            above them - the same shape as adding an exercise inside a plan. */}
        <View style={s.addRow}>
          <Ionicons name="add" size={18} color={theme.color.textFaint} />
          <TextInput
            testID="new-plan-name"
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Add a plan, e.g. Push day"
            placeholderTextColor={theme.color.textFaint}
            style={s.addInput}
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <Button label="Add" onPress={handleCreate} testID="create-plan" />
        </View>

        <Button
          label="Start an empty workout"
          variant="ghost"
          onPress={() => router.push(`/session/${startEmptySession()}`)}
        />

        <WeekReview />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  sectionLabel: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: theme.space(2),
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingLeft: theme.space(3),
    paddingRight: theme.space(1.5),
    paddingVertical: theme.space(1.5),
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
  },
  addInput: {
    flex: 1,
    // Without this an <input> keeps its ~200px intrinsic width on web and overflows the row.
    minWidth: 0,
    color: theme.color.text,
    fontSize: theme.font.body,
    paddingVertical: theme.space(2),
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accentDim,
  },
  resumeLabel: {
    color: theme.color.accent,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resumeName: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  planName: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  preview: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: theme.space(2) },
  planActions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(3) },
});
