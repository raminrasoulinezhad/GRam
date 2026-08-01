import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { exerciseName } from '@/catalog';
import { MUSCLE_LABEL } from '@/analytics/muscleMap';
import { countLoggedSets, rankMuscles, sessionTonnage, sessionVolume } from '@/analytics/volume';
import { formatDate, formatDuration, formatSet, formatTime, toDisplayWeight } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { Button, Card, Chip, Dim, Empty, H2, Screen } from '@/ui/components';
import { theme } from '@/ui/theme';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useStore((s) => s.sessions.find((x) => x.id === id));
  const unit = useStore((s) => s.settings.unit);
  const discardSession = useStore((s) => s.discardSession);

  if (!session) {
    return (
      <Screen>
        <Empty title="Workout not found" />
      </Screen>
    );
  }

  const sets = countLoggedSets(session);
  const tonnage = sessionTonnage(session);
  const muscles = rankMuscles(sessionVolume(session));
  const durationSec =
    session.endedAt !== null ? Math.round((session.endedAt - session.startedAt) / 1000) : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: session.planName }} />
      <ScrollView contentContainerStyle={s.content}>
        <Card>
          <Text style={s.title}>{session.planName}</Text>
          <Dim>
            {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
            {durationSec > 0 ? ` · ${formatDuration(durationSec)}` : ''}
          </Dim>
          <View style={s.statRow}>
            <View>
              <Text style={s.statValue}>{sets}</Text>
              <Text style={s.statLabel}>sets</Text>
            </View>
            <View>
              <Text style={s.statValue}>{session.entries.length}</Text>
              <Text style={s.statLabel}>exercises</Text>
            </View>
            {tonnage > 0 ? (
              <View>
                <Text style={s.statValue}>
                  {Math.round(toDisplayWeight(tonnage, unit)).toLocaleString()}
                </Text>
                <Text style={s.statLabel}>{unit} moved</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <Card>
          <H2>Muscles worked</H2>
          <View style={s.chips}>
            {muscles.map(({ muscle, value }) => (
              <Chip key={muscle} label={`${MUSCLE_LABEL[muscle]} ${value}`} tone="primary" />
            ))}
          </View>
        </Card>

        {session.entries.map((entry) => (
          <Card key={entry.id}>
            <Text style={s.exName}>{exerciseName(entry.exerciseId)}</Text>
            {entry.sets.map((set, i) => (
              <View key={set.id} style={s.setRow}>
                <Text style={s.setNum}>{i + 1}</Text>
                <Text style={s.setValue}>{formatSet(set, entry.kind, unit)}</Text>
                <View style={{ flex: 1 }} />
                <Dim>{set.loggedAt ? formatTime(set.loggedAt) : ''}</Dim>
              </View>
            ))}
          </Card>
        ))}

        <Button
          label="Delete this workout"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete workout?', 'This removes it from your log and the body map.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  discardSession(session.id);
                  router.back();
                },
              },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800', letterSpacing: -0.5 },
  statRow: { flexDirection: 'row', gap: theme.space(6), marginTop: theme.space(3) },
  statValue: { color: theme.color.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: theme.color.textFaint, fontSize: theme.font.tiny, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(1), marginTop: theme.space(2) },
  exName: {
    color: theme.color.text,
    fontSize: theme.font.h3,
    fontWeight: '700',
    marginBottom: theme.space(2),
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  setNum: { color: theme.color.textFaint, fontSize: theme.font.small, fontWeight: '800', width: 16 },
  setValue: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
});
