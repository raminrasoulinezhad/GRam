import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { MUSCLES } from '@/catalog';
import { MUSCLE_LABEL, toSlugValues } from '@/analytics/muscleMap';
import { recovery, volumeInWindow, WEEKLY_TARGET_SETS } from '@/analytics/volume';
import { completedSessions, selectSessions, useStore } from '@/store/useStore';
import { Card, Chip, Dim, Empty, H2, Screen } from '@/ui/components';
import { rampColor, rampIntensity, theme } from '@/ui/theme';

type Mode = 'volume' | 'recovery';

export default function BodyScreen() {
  const allSessions = useStore(selectSessions);
  const gender = useStore((s) => s.settings.bodyGender);
  const [mode, setMode] = useState<Mode>('volume');

  const sessions = useMemo(() => completedSessions(allSessions), [allSessions]);

  // Recomputed only when the finished-session list or the mode changes - never per frame.
  const totals = useMemo(() => {
    const now = Date.now();
    return mode === 'volume' ? volumeInWindow(sessions, now, 7) : recovery(sessions, now);
  }, [sessions, mode]);

  const max = mode === 'volume' ? WEEKLY_TARGET_SETS : 100;

  const data = useMemo<ExtendedBodyPart[]>(() => {
    // Recovery is inverted for colouring: a *fresh* muscle should read cold, a fried one hot.
    const forDisplay = { ...totals };
    if (mode === 'recovery') {
      for (const m of MUSCLES) forDisplay[m] = 100 - totals[m];
    }
    const bySlug = toSlugValues(forDisplay);
    return [...bySlug.entries()].map(([slug, value]) => ({
      slug,
      intensity: rampIntensity(value, max),
    }));
  }, [totals, mode, max]);

  const rows = useMemo(
    () =>
      MUSCLES.map((muscle) => ({ muscle, value: totals[muscle] })).sort((a, b) =>
        mode === 'volume' ? b.value - a.value : a.value - b.value,
      ),
    [totals, mode],
  );

  const trained = rows.filter((r) => (mode === 'volume' ? r.value > 0 : r.value < 99.5)).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.modeRow}>
          <Chip
            label="This week's volume"
            active={mode === 'volume'}
            onPress={() => setMode('volume')}
          />
          <Chip label="Recovery" active={mode === 'recovery'} onPress={() => setMode('recovery')} />
        </View>

        <Dim style={s.explainer}>
          {mode === 'volume'
            ? `Effective sets per muscle over the last 7 days. A set counts 1.0 for the muscles it targets and 0.5 for the ones assisting. Full colour at ${WEEKLY_TARGET_SETS} sets.`
            : 'How recovered each muscle is right now. Fatigue from every recorded set decays over about six days, so hot regions are the ones still under load.'}
        </Dim>

        <Card style={s.bodyCard}>
          <View style={s.bodies}>
            <View style={s.bodyCol}>
              <Body
                data={data}
                gender={gender}
                side="front"
                scale={0.85}
                colors={[...theme.color.ramp]}
                defaultFill={theme.color.ramp[0]}
                border={theme.color.border}
              />
              <Text style={s.sideLabel}>FRONT</Text>
            </View>
            <View style={s.bodyCol}>
              <Body
                data={data}
                gender={gender}
                side="back"
                scale={0.85}
                colors={[...theme.color.ramp]}
                defaultFill={theme.color.ramp[0]}
                border={theme.color.border}
              />
              <Text style={s.sideLabel}>BACK</Text>
            </View>
          </View>

          <View style={s.legend}>
            <Text style={s.legendEnd}>{mode === 'volume' ? '0 sets' : 'fresh'}</Text>
            {theme.color.ramp.map((c) => (
              <View key={c} style={[s.legendSwatch, { backgroundColor: c }]} />
            ))}
            <Text style={s.legendEnd}>{mode === 'volume' ? `${WEEKLY_TARGET_SETS}+` : 'fatigued'}</Text>
          </View>
        </Card>

        {sessions.length === 0 ? (
          <Empty
            title="No finished workouts yet"
            hint="Record some sets and finish a workout - the map fills in from your log."
          />
        ) : (
          <Card>
            <H2>Breakdown</H2>
            <Dim style={{ marginTop: theme.space(1), marginBottom: theme.space(2) }}>
              {mode === 'volume'
                ? `${trained} of ${MUSCLES.length} muscles trained this week`
                : `${trained} of ${MUSCLES.length} muscles carrying fatigue`}
            </Dim>
            {rows.map(({ muscle, value }) => (
              <View key={muscle} style={s.row}>
                <Text style={s.rowLabel}>{MUSCLE_LABEL[muscle]}</Text>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.barFill,
                      {
                        width: `${Math.min(100, (value / max) * 100)}%`,
                        backgroundColor: rampColor(
                          mode === 'recovery' ? 100 - value : value,
                          max,
                        ),
                      },
                    ]}
                  />
                </View>
                <Text style={s.rowValue}>
                  {mode === 'volume' ? value.toFixed(1) : `${Math.round(value)}%`}
                </Text>
              </View>
            ))}
            <Dim style={{ marginTop: theme.space(3) }}>
              Lats and mid back share one region on the figure, as do glutes and abductors - the
              numbers above are always the true per-muscle values.
            </Dim>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  modeRow: { flexDirection: 'row', gap: theme.space(2) },
  explainer: { lineHeight: 19 },
  bodyCard: { alignItems: 'center', paddingVertical: theme.space(4) },
  bodies: { flexDirection: 'row', gap: theme.space(4), justifyContent: 'center' },
  bodyCol: { alignItems: 'center', gap: theme.space(2) },
  sideLabel: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: theme.space(4),
  },
  legendSwatch: { width: 24, height: 8, borderRadius: 2 },
  legendEnd: { color: theme.color.textFaint, fontSize: theme.font.tiny, marginHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), paddingVertical: 3 },
  rowLabel: { color: theme.color.textDim, fontSize: theme.font.small, width: 78 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  rowValue: {
    color: theme.color.text,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
});
