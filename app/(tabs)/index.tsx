import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { exerciseName } from '@/catalog';
import { isPlanStale, weeksSince } from '@/analytics/planReview';
import { relativeTime } from '@/lib/format';
import { WEEKDAYS, WEEKDAY_LABEL, WEEKDAY_SHORT, type Weekday } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Body, Button, Card, Chip, Dim, Empty, Screen } from '@/ui/components';
import { WeekReview } from '@/ui/WeekReview';
import { theme } from '@/ui/theme';

export default function PlansScreen() {
  const plans = useStore((s) => s.plans);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const createPlan = useStore((s) => s.createPlan);
  const startSession = useStore((s) => s.startSession);
  const startEmptySession = useStore((s) => s.startEmptySession);

  const activeSession = sessions.find((x) => x.id === activeSessionId);
  const used = new Set(plans.map((p) => p.day));
  const free = WEEKDAYS.filter((d) => !used.has(d));

  function handleCreate(day: Weekday) {
    router.push(`/plan/${createPlan(day)}`);
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
            title="No training days yet"
            hint="Each plan is one day of your week - Push, Pull, Legs, or whatever suits you. Add one below, then start it at the gym."
          />
        ) : null}

        {plans.map((plan) => (
          <Card key={plan.id}>
            <Pressable onPress={() => router.push(`/plan/${plan.id}`)}>
              <View style={s.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{WEEKDAY_LABEL[plan.day]}</Text>
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

            {/*
              * A plan left alone for a month gets a mark, and the mark opens a page about that
              * plan rather than doing anything to it.
              *
              * Not the warning triangle and not the danger colour - those belong to the backup
              * warning, where something really is at risk. Nothing is wrong with an old plan;
              * you are only leaving progress on the table. Spending the same alarm on both
              * teaches people to ignore the serious one.
              *
              * A sibling of the card's Pressable rather than a child, because a button inside a
              * button is invalid HTML under react-native-web - see nestedControls.test.tsx.
              */}
            {isPlanStale(plan, Date.now()) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/replan/${plan.id}`)}
                testID={`replan-${plan.id}`}
                style={s.staleRow}
              >
                <Ionicons name="sparkles-outline" size={16} color={theme.color.warn} />
                <Text style={s.staleLabel}>
                  Unchanged for {weeksSince(plan.updatedAt, Date.now())} weeks — see what to change
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.color.warn} />
              </Pressable>
            ) : null}

            {/*
              * One button, because there is only one thing you come to this screen to do.
              *
              * Edit went because tapping the card already opens the editor, and a card that is
              * a link does not need a button saying so. Copy went because it made an unnamed
              * duplicate on a day that already had a plan, which is a mess to undo and was
              * almost never what anyone meant. Delete went to the plan's own page, where you
              * have the thing in front of you and can see what you are throwing away - next to
              * a red button on a list is the wrong place to make that decision.
              */}
            <View style={s.planActions}>
              <Button
                label="Start"
                onPress={() => handleStart(plan.id)}
                style={{ flex: 1 }}
                testID={`start-${plan.id}`}
              />
            </View>
          </Card>
        ))}

        {/*
          * Adding a day, not naming one. Every weekday is offered and the ones already in the
          * week are shown as taken rather than hidden - a week with a gap on Thursday should
          * make that gap visible, and a disabled chip does that where an absent one would not.
          */}
        <View style={s.addRow} testID="add-day">
          <Text style={s.addLabel}>{free.length > 0 ? 'ADD A DAY' : 'YOUR WEEK'}</Text>
          <View style={s.dayChips}>
            {WEEKDAYS.map((day) => {
              const existing = plans.find((p) => p.day === day);
              return (
                <Chip
                  key={day}
                  label={WEEKDAY_SHORT[day]}
                  active={existing !== undefined}
                  // A day already in the week opens it rather than doing nothing. Every day is
                  // always shown, so a gap on Thursday is visible - which a missing chip would
                  // not be, and the gap is the thing worth seeing.
                  onPress={
                    existing ? () => router.push(`/plan/${existing.id}`) : () => handleCreate(day)
                  }
                  testID={`add-${day}`}
                />
              );
            })}
          </View>
          <Dim>
            {free.length > 0
              ? 'Tap a free day to plan it, or a planned one to open it.'
              : 'Every day of the week has a plan.'}
          </Dim>
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
    gap: theme.space(2),
    padding: theme.space(3),
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
  },
  addLabel: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1.5) },
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
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    marginTop: theme.space(3),
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.warn,
  },
  staleLabel: { flex: 1, color: theme.color.warn, fontSize: theme.font.tiny, fontWeight: '700' },
  preview: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: theme.space(2) },
  planActions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(3) },
});
