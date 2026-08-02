import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { exerciseName } from '@/catalog';
import {
  DAYS_PER_WEEK_TARGET,
  GROUP_LABEL,
  plansMissing,
  reviewWeek,
  suggestionFor,
  type GroupCoverage,
  type TrainingGroup,
} from '@/analytics/balance';
import { useStore } from '@/store/useStore';
import { Body, Button, Card, Dim, H2 } from './components';
import { theme } from './theme';

/**
 * Whether the week's plans add up to a balanced week, and what to do about it if not.
 *
 * Nothing else in the app looks across plans. A lifter can happily write three push days and
 * the app would show three tidy plans and say nothing. This is the one place that reads them
 * together. The rules it applies, and why they are narrow, are in analytics/balance.ts.
 *
 * Every issue is actionable: one tap adds the recommended exercise for that group to a day of
 * your choosing. Advice you disagree with can be dismissed, and dismissing is reversible - a
 * review that cannot be argued with is one people learn to scroll past.
 */
export function WeekReview() {
  const plans = useStore((s) => s.plans);
  const ignored = useStore((s) => s.ignoredBalanceGroups);
  const addPlanItem = useStore((s) => s.addPlanItem);
  const ignoreGroup = useStore((s) => s.ignoreBalanceGroup);
  const clearIgnored = useStore((s) => s.clearIgnoredBalanceGroups);

  const [fixing, setFixing] = useState<TrainingGroup | null>(null);

  const review = useMemo(() => reviewWeek(plans, ignored), [plans, ignored]);

  if (plans.length === 0) {
    return (
      <Card testID="week-review">
        <H2>Your week</H2>
        <Dim style={{ marginTop: theme.space(2) }}>
          Once you have a few plans, this checks that they add up to a balanced week and tells you
          what is missing.
        </Dim>
      </Card>
    );
  }

  const suggestion = fixing ? suggestionFor(fixing) : null;
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

        {review.balanced ? (
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

        {review.dismissed.length > 0 ? (
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

      {/* Which day to put it on. Only plans that do not already train the group are offered. */}
      {fixing !== null && suggestion !== null ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setFixing(null)}>
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetTitle}>Add {exerciseName(suggestion)}</Text>
                  <Dim>Pick the day it goes on.</Dim>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID="fix-close"
                  hitSlop={12}
                  onPress={() => setFixing(null)}
                  style={s.close}
                >
                  <Ionicons name="close" size={22} color={theme.color.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={s.sheetBody}>
                {candidates.length === 0 ? (
                  <Dim>
                    Every plan already trains {GROUP_LABEL[fixing].toLowerCase()}. Add another plan
                    to give it a second day.
                  </Dim>
                ) : (
                  candidates.map((plan) => (
                    <Pressable
                      key={plan.id}
                      accessibilityRole="button"
                      testID={`fix-into-${plan.id}`}
                      onPress={() => {
                        addPlanItem(plan.id, suggestion);
                        setFixing(null);
                      }}
                      style={({ pressed }) => [s.dayRow, pressed && { opacity: 0.7 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.dayName}>{plan.name}</Text>
                        <Dim>
                          {plan.items.length} exercise{plan.items.length === 1 ? '' : 's'}
                        </Dim>
                      </View>
                      <Ionicons name="add-circle" size={22} color={theme.color.accent} />
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
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
    maxHeight: '75%',
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
