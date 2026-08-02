import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { exerciseName, getExercise } from '@/catalog';
import {
  DAYS_PER_WEEK_TARGET,
  GROUP_LABEL,
  GROUP_MUSCLES,
  plansMissing,
  reviewWeek,
  type GroupCoverage,
  type TrainingGroup,
} from '@/analytics/balance';
import { WEEKDAY_LABEL } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Body, Button, Card, Dim, H2 } from './components';
import { ExerciseList } from './ExerciseList';
import { theme } from './theme';

/**
 * Whether the week's plans add up to a balanced week, and what to do about it if not.
 *
 * Nothing else in the app looks across plans. A lifter can happily write three push days and
 * the app would show three tidy plans and say nothing. This is the one place that reads them
 * together. The rules it applies, and why they are narrow, are in analytics/balance.ts.
 *
 * Every issue is actionable, and every action leaves the choice with the user: fixing a gap
 * opens the exercise list filtered to that muscle, with the recommended picks on top, rather
 * than deciding on their behalf. Advice can be dismissed, and dismissing is reversible - a
 * review that cannot be argued with is one people learn to scroll past.
 */
export function WeekReview() {
  const plans = useStore((s) => s.plans);
  const ignored = useStore((s) => s.ignoredBalanceGroups);
  const addPlanItem = useStore((s) => s.addPlanItem);
  const createPlan = useStore((s) => s.createPlan);
  const ignoreGroup = useStore((s) => s.ignoreBalanceGroup);
  const clearIgnored = useStore((s) => s.clearIgnoredBalanceGroups);

  /** The gap being fixed, and the exercise chosen for it - null until the user picks one. */
  const [fixing, setFixing] = useState<TrainingGroup | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const review = useMemo(() => reviewWeek(plans, ignored), [plans, ignored]);

  const close = () => {
    setFixing(null);
    setChosen(null);
  };

  const candidates = fixing ? plansMissing(plans, fixing) : [];

  return (
    <>
      <Card testID="week-review">
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <H2>Your week</H2>
            <Dim>
              {review.covered.length} of {review.coverage.length} muscle groups trained{' '}
              {DAYS_PER_WEEK_TARGET}× across different days
            </Dim>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review again"
            testID="week-review-refresh"
            hitSlop={10}
            onPress={clearIgnored}
            style={s.refresh}
          >
            <Ionicons name="refresh" size={16} color={theme.color.accent} />
          </Pressable>
        </View>

        {review.tooFewDays !== null ? (
          /*
           * Nothing else is worth saying yet. "Twice, on different days" is part of the
           * definition, so with fewer than two plans every group fails by construction and no
           * exercise choice can change that. Listing eight identical unfixable gaps underneath
           * would bury the one thing that actually needs doing.
           */
          <View style={[s.issue, s.blocking]} testID="week-issue-days">
            <View style={s.issueHead}>
              <Ionicons name="calendar-outline" size={16} color={theme.color.warn} />
              <Text style={s.issueTitle}>Add another training day</Text>
              <Text style={s.issueCount}>
                {review.tooFewDays.have}/{review.tooFewDays.need} days
              </Text>
            </View>
            <Dim style={{ marginTop: theme.space(1) }}>
              {review.tooFewDays.have === 0
                ? 'A week needs at least two plans before any muscle can be trained on two different days.'
                : 'One plan is one day. A second plan is what lets a muscle be trained twice a week, which is where the balance rules start.'}
            </Dim>
            <View style={s.issueActions}>
              <Button
                label="Add a plan"
                testID="add-plan-day"
                style={{ flex: 1 }}
                onPress={() => router.push(`/plan/${createPlan()}`)}
              />
            </View>
            <Dim style={{ marginTop: theme.space(2), fontStyle: 'italic' }}>
              Muscle-by-muscle advice appears once you have two days.
            </Dim>
          </View>
        ) : review.balanced ? (
          <View style={s.ok} testID="week-review-balanced">
            <Ionicons name="checkmark-circle" size={18} color={theme.color.accent} />
            <Body style={{ flex: 1, color: theme.color.accent }}>
              {review.dismissed.length > 0
                ? 'Nothing outstanding. Some advice is dismissed — tap refresh to bring it back.'
                : 'Every muscle group is trained at least twice a week, on different days.'}
            </Body>
          </View>
        ) : (
          review.issues.map((issue) => (
            <Issue
              key={issue.group}
              issue={issue}
              onFix={() => setFixing(issue.group)}
              onIgnore={() => ignoreGroup(issue.group)}
            />
          ))
        )}

        {review.tooFewDays === null && review.dismissed.length > 0 ? (
          <Dim style={{ marginTop: theme.space(3) }} testID="week-review-dismissed">
            Dismissed: {review.dismissed.map((d) => GROUP_LABEL[d.group]).join(', ')}
          </Dim>
        ) : null}

        <Dim style={{ marginTop: theme.space(3) }}>
          Balanced means each group is the <Text style={s.em}>primary</Text> muscle of an exercise
          in at least {DAYS_PER_WEEK_TARGET} different plans. Assistance work does not count — a
          week whose only triceps work is bench press is not a week that trains triceps.
        </Dim>
      </Card>

      {/* Step one: which exercise. Step two: which day. */}
      {fixing !== null ? (
        <Modal visible transparent animationType="slide" onRequestClose={close}>
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                {chosen !== null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to the exercise list"
                    testID="fix-back"
                    hitSlop={12}
                    onPress={() => setChosen(null)}
                    style={s.close}
                  >
                    <Ionicons name="chevron-back" size={22} color={theme.color.text} />
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetTitle} numberOfLines={2}>
                    {chosen === null
                      ? `Pick a ${GROUP_LABEL[fixing].toLowerCase()} exercise`
                      : `Add ${exerciseName(chosen)}`}
                  </Text>
                  <Dim>
                    {chosen === null
                      ? 'Starred ones are the recommended picks. Search for anything else.'
                      : 'Pick the day it goes on.'}
                  </Dim>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID="fix-close"
                  hitSlop={12}
                  onPress={close}
                  style={s.close}
                >
                  <Ionicons name="close" size={22} color={theme.color.text} />
                </Pressable>
              </View>

              {chosen === null ? (
                <ExerciseList
                  // Opens on the muscle in question, so the recommended picks lead - but it is
                  // the whole catalog underneath, editable, so nothing is off limits.
                  initialQuery={GROUP_LABEL[fixing].toLowerCase()}
                  onSelect={(exercise) => setChosen(exercise.id)}
                  accessory={() => (
                    <Ionicons name="add-circle-outline" size={22} color={theme.color.textDim} />
                  )}
                />
              ) : (
                <ScrollView contentContainerStyle={s.sheetBody}>
                  {!trainsGroup(chosen, fixing) ? (
                    <View style={s.warn} testID="fix-warning">
                      <Ionicons name="information-circle" size={16} color={theme.color.warn} />
                      <Dim style={{ flex: 1 }}>
                        {exerciseName(chosen)} does not target {GROUP_LABEL[fixing].toLowerCase()}
                        {' '}as its primary muscle, so this will not close the gap. Add it anyway if
                        you want it.
                      </Dim>
                    </View>
                  ) : null}
                  {candidates.length === 0 ? (
                    <Dim>
                      Every plan already trains {GROUP_LABEL[fixing].toLowerCase()}. Add another
                      plan to give it a second day.
                    </Dim>
                  ) : (
                    candidates.map((plan) => (
                      <Pressable
                        key={plan.id}
                        accessibilityRole="button"
                        testID={`fix-into-${plan.id}`}
                        onPress={() => {
                          addPlanItem(plan.id, chosen);
                          close();
                        }}
                        style={({ pressed }) => [s.dayRow, pressed && { opacity: 0.7 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.dayName}>{WEEKDAY_LABEL[plan.day]}</Text>
                          <Dim>
                            {plan.items.length} exercise{plan.items.length === 1 ? '' : 's'}
                          </Dim>
                        </View>
                        <Ionicons name="add-circle" size={22} color={theme.color.accent} />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

/** Whether this exercise would actually close a gap for the group. */
function trainsGroup(exerciseId: string, group: TrainingGroup): boolean {
  const exercise = getExercise(exerciseId);
  if (!exercise) return false;
  return exercise.primaryMuscles.some((m) => GROUP_MUSCLES[group].includes(m));
}

function Issue({
  issue,
  onFix,
  onIgnore,
}: {
  issue: GroupCoverage;
  onFix: () => void;
  onIgnore: () => void;
}) {
  const days = issue.planIds.length;
  return (
    <View style={s.issue} testID={`week-issue-${issue.group}`}>
      <View style={s.issueHead}>
        <Ionicons name="alert-circle" size={16} color={theme.color.warn} />
        <Text style={s.issueTitle}>{GROUP_LABEL[issue.group]}</Text>
        <Text style={s.issueCount}>
          {days}/{DAYS_PER_WEEK_TARGET} days
        </Text>
      </View>
      <Dim style={{ marginTop: theme.space(1) }}>
        {days === 0
          ? 'No plan trains it as a primary muscle.'
          : `Only ${issue.planNames.join(', ')} trains it. It needs ${issue.shortBy} more day.`}
      </Dim>
      <View style={s.issueActions}>
        <Button label="Fix" onPress={onFix} testID={`fix-${issue.group}`} style={{ flex: 1 }} />
        <Button
          label="Ignore"
          variant="secondary"
          onPress={onIgnore}
          testID={`ignore-${issue.group}`}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space(2) },
  refresh: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  ok: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    marginTop: theme.space(3),
  },
  em: { fontWeight: '800', color: theme.color.textDim },
  issue: {
    marginTop: theme.space(3),
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  /** The one issue with no Ignore button: it is a precondition, not an opinion. */
  blocking: { borderColor: theme.color.warn },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  issueTitle: { flex: 1, color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  issueCount: {
    color: theme.color.warn,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  issueActions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(3) },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    backgroundColor: theme.color.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  sheetTitle: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  sheetBody: { padding: theme.space(4), gap: theme.space(2) },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space(2),
    padding: theme.space(3),
    marginBottom: theme.space(1),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.warn,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dayName: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
});
