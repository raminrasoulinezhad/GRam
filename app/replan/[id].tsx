import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { exerciseName, getExercise, searchExercises } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { reviewPlan, type ExerciseTrend } from '@/analytics/planReview';
import { toDisplayWeight } from '@/lib/format';
import { WEEKDAY_LABEL } from '@/store/types';
import { completedSessions, selectSessions, useStore } from '@/store/useStore';
import { Body, Button, Card, Dim, Empty, H2, Screen } from '@/ui/components';
import { theme } from '@/ui/theme';

/**
 * What to change about a plan that has been running a long time, and why.
 *
 * The calendar is only what makes the app look. Telling someone to change a programme because a
 * month has passed is advice with no evidence behind it, and plenty of good programmes run
 * longer than that. So this page does not argue from the date - it reads the sets logged since
 * the plan was last edited and reports, per exercise, whether the weight has actually moved.
 *
 * A lift still climbing is left alone and said so out loud, because the most useful thing this
 * page can do on some visits is tell you to change nothing. A lift that has not moved across
 * several sessions is where the suggestions go.
 */
export default function ReplanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useStore((s) => s.plans.find((p) => p.id === id));
  const allSessions = useStore(selectSessions);
  const unit = useStore((s) => s.settings.unit);

  const review = useMemo(
    () => (plan ? reviewPlan(plan, completedSessions(allSessions), Date.now()) : null),
    [plan, allSessions],
  );

  if (!plan || review === null) {
    return (
      <Screen>
        <Empty title="Plan not found" hint="It may have been deleted." />
      </Screen>
    );
  }

  const climbing = review.trends.filter((t) => t.verdict === 'climbing');
  const slipping = review.trends.filter((t) => t.verdict === 'slipping');
  const untested = review.trends.filter((t) => t.verdict === 'untested');
  /*
   * Every verdict has to land somewhere on this page. The first version handled climbing, flat
   * and untested, and a plan whose lifts had all gone backwards rendered a heading and nothing
   * else - the one case where the user most needs to be told something.
   */
  const nothingToShow =
    climbing.length === 0 &&
    slipping.length === 0 &&
    untested.length === 0 &&
    review.stalled.length === 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Review ${WEEKDAY_LABEL[plan.day]}` }} />
      <ScrollView contentContainerStyle={s.content}>
        <Card>
          <H2>
            {review.weeks} weeks, {review.workoutsSince} workout
            {review.workoutsSince === 1 ? '' : 's'}
          </H2>
          <Body style={s.lead}>
            {WEEKDAY_LABEL[plan.day]} has not changed in {review.weeks} weeks. That is not a
            problem by itself — what matters is whether it is still producing. Here is what your
            logged sets say.
          </Body>
        </Card>

        {/*
          * The good news first, and it is real news. Someone who opens this page expecting to be
          * told off, and is instead told their squat is up 15kg and to leave it alone, will read
          * the page again next time.
          */}
        {climbing.length > 0 ? (
          <Card>
            <View style={s.headRow}>
              <Ionicons name="trending-up" size={18} color={theme.color.accent} />
              <Text style={s.headText}>Still working — leave these alone</Text>
            </View>
            {climbing.map((t) => (
              <TrendRow key={t.exerciseId} trend={t} unit={unit} tone={theme.color.accent} />
            ))}
          </Card>
        ) : null}

        {review.stalled.length > 0 ? (
          <Card>
            <View style={s.headRow}>
              <Ionicons name="remove-outline" size={18} color={theme.color.warn} />
              <Text style={s.headText}>Not moving — worth changing</Text>
            </View>
            <Dim style={s.hint}>
              Same weight across every session since this plan was written. A different movement
              for the same muscle gives the stimulus a new angle to work against.
            </Dim>
            {review.stalled.map((t) => (
              <View key={t.exerciseId} style={s.stalledBlock}>
                <TrendRow trend={t} unit={unit} tone={theme.color.warn} />
                <Alternatives exerciseId={t.exerciseId} inPlan={plan.items.map((i) => i.exerciseId)} />
              </View>
            ))}
          </Card>
        ) : null}

        {/*
          * Going backwards is not the same problem as going nowhere, and the advice is not the
          * same either. A stalled lift wants a different movement; a lift that is dropping
          * usually wants rest, or less of everything else, and swapping the exercise would hide
          * the signal rather than answer it. So no alternatives are offered here.
          */}
        {slipping.length > 0 ? (
          <Card>
            <View style={s.headRow}>
              <Ionicons name="trending-down" size={18} color={theme.color.danger} />
              <Text style={s.headText}>Going backwards</Text>
            </View>
            <Dim style={s.hint}>
              Lighter now than when this plan was written. Before changing the exercise, look at
              sleep, food and how much else the week is asking of you — a lift that is falling is
              usually a recovery problem, and a new movement would only hide it.
            </Dim>
            {slipping.map((t) => (
              <TrendRow key={t.exerciseId} trend={t} unit={unit} tone={theme.color.danger} />
            ))}
          </Card>
        ) : null}

        {untested.length > 0 ? (
          <Card>
            <View style={s.headRow}>
              <Ionicons name="help-circle-outline" size={18} color={theme.color.textFaint} />
              <Text style={s.headText}>Not enough recorded to say</Text>
            </View>
            <Dim style={s.hint}>
              Fewer than three sessions each since the plan changed. Too little to draw a line
              through, which is not the same as no progress.
            </Dim>
            <Body style={s.untestedList}>
              {untested.map((t) => exerciseName(t.exerciseId)).join(' · ')}
            </Body>
          </Card>
        ) : null}

        {nothingToShow ? (
          <Card>
            <Body>
              This plan has no exercises in it yet, so there is nothing to measure. Open it and
              add some movements.
            </Body>
          </Card>
        ) : null}

        {!nothingToShow && review.stalled.length === 0 && slipping.length === 0 ? (
          <Card>
            <Body>
              Nothing here is stuck. The age of a plan is not on its own a reason to change it —
              come back when something stops moving.
            </Body>
          </Card>
        ) : null}

        <Button
          label={`Open ${WEEKDAY_LABEL[plan.day]}`}
          onPress={() => router.replace(`/plan/${plan.id}`)}
          testID="replan-open"
        />
        <Dim style={s.footNote}>
          Editing the plan resets the clock, so this page starts measuring again from the version
          you leave behind.
        </Dim>
      </ScrollView>
    </Screen>
  );
}

/** One exercise: where its top set started and where it is now. */
function TrendRow({
  trend,
  unit,
  tone,
}: {
  trend: ExerciseTrend;
  unit: 'kg' | 'lb';
  tone: string;
}) {
  const show = (kg: number | null) =>
    kg === null ? '—' : `${Math.round(toDisplayWeight(kg, unit))}${unit}`;

  return (
    <View style={s.trendRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.trendName}>{exerciseName(trend.exerciseId)}</Text>
        <Dim>
          {trend.sessions} session{trend.sessions === 1 ? '' : 's'}
          {trend.from !== null ? ` · ${show(trend.from)} → ${show(trend.to)}` : ''}
        </Dim>
      </View>
      {/*
        * The sign is the whole message at a glance, so it is never omitted. An unsigned "22lb"
        * beside a lift that has dropped 22lb reads as a gain, which is the opposite of true.
        */}
      {trend.from !== null && trend.to !== null && trend.to !== trend.from ? (
        <Text style={[s.delta, { color: tone }]}>
          {trend.to > trend.from ? '+' : '−'}
          {show(Math.abs(trend.to - trend.from))}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Other exercises for the same primary muscle, ranked as the catalog ranks them.
 *
 * Suggestions, not a replacement performed on the user's behalf. Each opens its how-to page so
 * the choice is made having seen the movement - swapping something into a plan sight unseen is
 * how people end up doing an exercise they cannot do.
 */
function Alternatives({ exerciseId, inPlan }: { exerciseId: string; inPlan: string[] }) {
  const exercise = getExercise(exerciseId);
  const muscle = exercise?.primaryMuscles[0];

  const options = useMemo(() => {
    if (!muscle) return [];
    return searchExercises({ muscle })
      .filter((e) => !inPlan.includes(e.id))
      .slice(0, 3);
  }, [muscle, inPlan]);

  if (!muscle || options.length === 0) return null;

  return (
    <View style={s.alts}>
      <Text style={s.altLabel}>OTHER {MUSCLE_LABEL[muscle].toUpperCase()} WORK</Text>
      {options.map((e) => (
        <Button
          key={e.id}
          label={e.name}
          variant="secondary"
          onPress={() => router.push(`/exercise/${e.id}`)}
          testID={`alt-${e.id}`}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  lead: { color: theme.color.textDim, marginTop: theme.space(2), lineHeight: 20 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  headText: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  hint: { marginTop: theme.space(2), lineHeight: 19 },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(2),
  },
  trendName: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '700' },
  delta: { fontSize: theme.font.body, fontWeight: '800' },
  stalledBlock: {
    marginTop: theme.space(2),
    paddingTop: theme.space(2),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  alts: { gap: theme.space(2), marginTop: theme.space(1), marginBottom: theme.space(2) },
  altLabel: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  untestedList: { color: theme.color.textDim, marginTop: theme.space(2) },
  footNote: { textAlign: 'center' },
});
