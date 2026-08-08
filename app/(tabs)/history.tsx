import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { exerciseName } from '@/catalog';
import { countLoggedSets, rankMuscles, sessionTonnage, volumeInWindow } from '@/analytics/volume';
import { formatDate, formatDuration, formatTime, toDisplayWeight } from '@/lib/format';
import { completedSessions, selectSessions, useStore } from '@/store/useStore';
import { Card, Dim, Empty, H2, Screen } from '@/ui/components';
import { MilestonesCard } from '@/ui/Milestones';
import { theme } from '@/ui/theme';

export default function HistoryScreen() {
  const allSessions = useStore(selectSessions);
  const unit = useStore((s) => s.settings.unit);

  const sessions = useMemo(() => completedSessions(allSessions), [allSessions]);

  const week = useMemo(() => {
    const now = Date.now();
    const totals = volumeInWindow(sessions, now, 7);
    const ranked = rankMuscles(totals);
    const sets = ranked.reduce((n, r) => n + r.value, 0);
    const workouts = sessions.filter((x) => now - x.startedAt < 7 * 86_400_000).length;
    return { ranked, sets, workouts };
  }, [sessions]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>
        {sessions.length === 0 ? (
          <Empty
            title="No workouts yet"
            hint="Finish a workout and it lands here with everything you recorded."
          />
        ) : (
          <>
            {/* Where you are overall, before the workout-by-workout account below it. */}
            <MilestonesCard />

            <Card>
              <H2>Last 7 days</H2>
              <View style={s.statRow}>
                <Stat value={String(week.workouts)} label="workouts" />
                <Stat value={week.sets.toFixed(0)} label="effective sets" />
                <Stat value={String(week.ranked.length)} label="muscles hit" />
              </View>
            </Card>

            {sessions.map((session) => {
              const sets = countLoggedSets(session);
              const tonnage = sessionTonnage(session);
              const durationSec =
                session.endedAt !== null
                  ? Math.round((session.endedAt - session.startedAt) / 1000)
                  : 0;
              return (
                <Pressable key={session.id} onPress={() => router.push(`/history/${session.id}`)}>
                  <Card>
                    <View style={s.header}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{session.planName}</Text>
                        <Dim>
                          {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
                          {durationSec > 0 ? ` · ${formatDuration(durationSec)}` : ''}
                        </Dim>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.color.textFaint} />
                    </View>
                    <View style={s.statRow}>
                      <Stat value={String(sets)} label="sets" />
                      <Stat value={String(session.entries.length)} label="exercises" />
                      {tonnage > 0 ? (
                        <Stat
                          value={`${Math.round(toDisplayWeight(tonnage, unit)).toLocaleString()}`}
                          label={`${unit} moved`}
                        />
                      ) : null}
                    </View>
                    {/*
                      * No per-muscle breakdown here. It is on the session's own page, one tap
                      * away, and it was the tallest thing in a card whose job is to let you
                      * scan a list of workouts.
                      */}
                    <Dim style={{ marginTop: theme.space(1) }} numberOfLines={1}>
                      {session.entries.map((e) => exerciseName(e.exerciseId)).join(' · ')}
                    </Dim>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // Tighter than the other screens on purpose: this one is a list you scan, so fitting more
  // workouts on a screen is worth more than the breathing room.
  content: { padding: theme.space(4), gap: theme.space(2), paddingBottom: theme.space(12) },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  name: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: theme.space(6), marginTop: theme.space(2) },
  statValue: { color: theme.color.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: theme.color.textFaint, fontSize: theme.font.tiny, fontWeight: '600' },
});
