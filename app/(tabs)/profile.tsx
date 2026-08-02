import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EQUIPMENT } from '@/catalog';
import { ageFrom, bmi, preferredUnit, readDeviceProfile } from '@/lib/device';
import { fromDisplayWeight, titleCase, toDisplayWeight } from '@/lib/format';
import type { Experience, TrainingGoal } from '@/store/types';
import { completedSessions, selectSessions, useStore } from '@/store/useStore';
import { countLoggedSets } from '@/analytics/volume';
import { Button, Card, Chip, Dim, H2, NumberField, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { theme } from '@/ui/theme';

const GOALS: { value: TrainingGoal; label: string; blurb: string }[] = [
  { value: 'strength', label: 'Strength', blurb: '1-6 reps, long rests' },
  { value: 'hypertrophy', label: 'Muscle', blurb: '6-12 reps, 10-20 sets per muscle weekly' },
  { value: 'general', label: 'General fitness', blurb: 'Higher reps, short rests' },
];

const LEVELS: Experience[] = ['beginner', 'intermediate', 'advanced'];
const SEXES = ['male', 'female', 'unspecified'] as const;

export default function ProfileScreen() {
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const allSessions = useStore(selectSessions);
  const updateProfile = useStore((s) => s.updateProfile);
  const toggleEquipment = useStore((s) => s.toggleEquipment);
  const updateSettings = useStore((s) => s.updateSettings);
  const seedUnitFromDevice = useStore((s) => s.seedUnitFromDevice);
  const resetAll = useStore((s) => s.resetAll);
  const confirm = useConfirm();

  // Read once per mount - none of it changes while the app is open.
  const [device] = useState(readDeviceProfile);

  // The phone's region picks kg or lb the first time, then never again.
  useEffect(() => {
    seedUnitFromDevice(preferredUnit(device));
  }, [device, seedUnitFromDevice]);

  const stats = useMemo(() => {
    const done = completedSessions(allSessions);
    return {
      workouts: done.length,
      sets: done.reduce((n, s) => n + countLoggedSets(s), 0),
      since: done.length > 0 ? done[done.length - 1].startedAt : null,
    };
  }, [allSessions]);

  const age = ageFrom(profile.birthDate);
  const index = bmi(profile.heightCm, profile.weightKg);

  async function handleReset() {
    const ok = await confirm({
      title: 'Erase everything?',
      message: 'Your profile, plans and every logged workout will be deleted from this device.',
      confirmLabel: 'Erase',
      destructive: true,
    });
    if (ok) resetAll();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={s.label}>YOUR NAME</Text>
          <TextInput
            testID="profile-name"
            value={profile.displayName}
            onChangeText={(t) => updateProfile({ displayName: t })}
            placeholder="Optional"
            placeholderTextColor={theme.color.textFaint}
            style={s.input}
          />
          <View style={s.statRow}>
            <Stat value={String(stats.workouts)} label="workouts" />
            <Stat value={String(stats.sets)} label="sets logged" />
            {age !== null ? <Stat value={String(age)} label="years old" /> : null}
            {index !== null ? <Stat value={String(index)} label="BMI" /> : null}
          </View>
        </Card>

        <Card>
          <H2>Body</H2>
          <Dim style={s.hint}>
            Used for the body figure and, later, to size your starting weights. It stays on this
            device.
          </Dim>

          <Text style={[s.label, s.spaced]}>SEX</Text>
          <View style={s.row}>
            {SEXES.map((value) => (
              <Chip
                key={value}
                label={titleCase(value)}
                active={profile.sex === value}
                onPress={() => {
                  updateProfile({ sex: value });
                  // The figure only ships two body models, so anything unspecified draws male.
                  updateSettings({ bodyGender: value === 'female' ? 'female' : 'male' });
                }}
              />
            ))}
          </View>

          <Text style={[s.label, s.spaced]}>DATE OF BIRTH</Text>
          <TextInput
            testID="profile-birthdate"
            value={profile.birthDate ?? ''}
            onChangeText={(t) => updateProfile({ birthDate: t.trim() === '' ? null : t.trim() })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />

          <View style={s.measureRow}>
            <View>
              <Text style={s.label}>HEIGHT</Text>
              <NumberField
                testID="profile-height"
                value={profile.heightCm ?? undefined}
                suffix="cm"
                width={132}
                step={1}
                onChange={(n) => updateProfile({ heightCm: n ?? null })}
              />
            </View>
            <View>
              <Text style={s.label}>WEIGHT</Text>
              <NumberField
                testID="profile-weight"
                value={
                  profile.weightKg === null
                    ? undefined
                    : toDisplayWeight(profile.weightKg, settings.unit)
                }
                suffix={settings.unit}
                width={132}
                step={0.5}
                onChange={(n) =>
                  updateProfile({
                    weightKg: n === undefined ? null : fromDisplayWeight(n, settings.unit),
                  })
                }
              />
            </View>
          </View>
        </Card>

        <Card>
          <H2>Training</H2>
          <Text style={[s.label, s.spaced]}>GOAL</Text>
          {GOALS.map((g) => (
            <View key={g.value} style={s.goalRow}>
              <Chip
                label={g.label}
                active={profile.goal === g.value}
                onPress={() => updateProfile({ goal: g.value })}
              />
              <Dim style={{ flex: 1 }}>{g.blurb}</Dim>
            </View>
          ))}

          <Text style={[s.label, s.spaced]}>EXPERIENCE</Text>
          <View style={s.row}>
            {LEVELS.map((level) => (
              <Chip
                key={level}
                label={titleCase(level)}
                active={profile.experience === level}
                onPress={() => updateProfile({ experience: level })}
              />
            ))}
          </View>
        </Card>

        <Card>
          <H2>Equipment</H2>
          <Dim style={s.hint}>
            {profile.equipment.length === 0
              ? 'Nothing selected, so the catalog shows every exercise.'
              : `${profile.equipment.length} selected.`}
          </Dim>
          <View style={[s.row, s.wrap]}>
            {EQUIPMENT.map((e) => (
              <Chip
                key={e}
                label={titleCase(e)}
                active={profile.equipment.includes(e)}
                onPress={() => toggleEquipment(e)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <H2>Units</H2>
          <View style={[s.row, s.spaced]}>
            {(['kg', 'lb'] as const).map((u) => (
              <Chip
                key={u}
                label={u}
                active={settings.unit === u}
                onPress={() => updateSettings({ unit: u, unitSeededFromDevice: true })}
              />
            ))}
          </View>
          <Dim style={s.hint}>
            Defaulted from your phone's region settings. Weights are always stored in kilograms,
            so switching never rewrites your history.
          </Dim>
        </Card>

        <Card>
          <H2>This device</H2>
          <Dim style={s.hint}>
            Read from the phone itself. Nothing here needs a permission and nothing leaves the
            device.
          </Dim>
          <Row label="Device" value={device.model ?? 'Unknown'} />
          {device.manufacturer ? <Row label="Made by" value={device.manufacturer} /> : null}
          <Row label="System" value={device.osLabel} />
          <Row label="Language" value={device.locale} />
          {device.region ? <Row label="Region" value={device.region} /> : null}
          {device.timeZone ? <Row label="Time zone" value={device.timeZone} /> : null}
          <Row label="Measurements" value={device.measurementSystem ?? 'unknown'} />
          {!device.isPhysicalDevice ? (
            <Dim style={{ marginTop: theme.space(2) }}>
              Running in a simulator or browser, so these values describe the host, not a phone.
            </Dim>
          ) : null}
        </Card>

        <Card>
          <H2>Health app sync</H2>
          <Dim style={s.hint}>
            Importing height, weight and workouts from Apple Health or Health Connect needs
            native modules, which do not run inside Expo Go. It will arrive with the first
            development build - see docs/ROADMAP.md. Until then the fields above are yours to
            fill in.
          </Dim>
          <Chip label={device.platform === 'ios' ? 'Apple Health - not connected' : 'Health Connect - not connected'} />
        </Card>

        <Button label="Erase all data" variant="danger" testID="erase" onPress={() => void handleReset()} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  label: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: theme.space(1.5),
  },
  spaced: { marginTop: theme.space(3) },
  hint: { marginTop: theme.space(1), lineHeight: 19 },
  input: {
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2.5),
    color: theme.color.text,
    fontSize: theme.font.body,
  },
  row: { flexDirection: 'row', gap: theme.space(1.5), alignItems: 'center' },
  wrap: { flexWrap: 'wrap', marginTop: theme.space(2) },
  measureRow: { flexDirection: 'row', gap: theme.space(4), marginTop: theme.space(3) },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), marginTop: theme.space(1.5) },
  statRow: { flexDirection: 'row', gap: theme.space(5), marginTop: theme.space(3) },
  statValue: { color: theme.color.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: theme.color.textFaint, fontSize: theme.font.tiny, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space(3),
    paddingVertical: theme.space(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  infoLabel: { color: theme.color.textDim, fontSize: theme.font.small },
  infoValue: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '600', flexShrink: 1 },
});
