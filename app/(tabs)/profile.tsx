import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { EXERCISES } from '@/catalog';
import { ageFrom, bmi } from '@/lib/device';
import {
  formatDuration,
  fromDisplayWeight,
  titleCase,
  toDisplayWeight,
} from '@/lib/format';
import { SCHEMA_VERSION } from '@/store/migrations';
import { completedSessions, selectSessions, useStore } from '@/store/useStore';
import { countLoggedSets } from '@/analytics/volume';
import { Button, Card, Chip, Dim, H2, NumberField, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { BackupCard } from '@/ui/BackupCard';
import { theme } from '@/ui/theme';
const SEXES = ['male', 'female', 'unspecified'] as const;

/**
 * The three rest lengths worth a dedicated button. Anything else is a job for the stepper
 * beside them - a row of five presets was a menu to read rather than a shortcut to tap, and
 * the two long ones were rarely the answer.
 */
const REST_PRESETS = [45, 60, 90] as const;

export default function ProfileScreen() {
  const profile = useStore((s) => s.profile);
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const settings = useStore((s) => s.settings);
  const allSessions = useStore(selectSessions);
  const updateProfile = useStore((s) => s.updateProfile);
  const updateSettings = useStore((s) => s.updateSettings);
  const setDefaultRest = useStore((s) => s.setDefaultRest);
  const resetAll = useStore((s) => s.resetAll);
  const confirm = useConfirm();
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
        <BackupCard />
        {/*
          * Goal, experience and available equipment used to be collected here. All three were
          * write-only: nothing in the app read them back, and the equipment card went further
          * and claimed the catalog was filtered by it, which was never true. Inputs that do
          * nothing are worse than absent ones - they cost attention and imply a behaviour that
          * does not exist. The fields remain in the stored profile, so the questions can come
          * back the day something actually uses them; see docs/ROADMAP.md.
          */}
        {/*
          * Rest applies to every exercise, so it belongs here rather than in each plan. The
          * store retimes existing plans to match - see setDefaultRest.
          */}
        {/*
          * One row: the three presets and the stepper sit together, because they are one
          * choice made two ways. Stacked, with a paragraph above them, this was the tallest
          * card on the page for a setting most people touch once.
          */}
        <Card>
          <H2>Rest timer</H2>
          <View style={[s.row, s.wrap, s.restRow]}>
            {REST_PRESETS.map((sec) => (
              <Chip
                key={sec}
                label={formatDuration(sec)}
                active={settings.defaultRestSec === sec}
                onPress={() => setDefaultRest(sec)}
                testID={`rest-${sec}`}
              />
            ))}
            <NumberField
              testID="rest-seconds"
              value={settings.defaultRestSec}
              suffix="sec"
              width={116}
              step={15}
              onChange={(n) => setDefaultRest(n ?? 0)}
            />
          </View>
          <Dim style={s.hint}>Starts when you record a set. Zero turns it off.</Dim>
        </Card>
        <Card>
          <H2>Units</H2>
          <View style={[s.row, s.spaced]}>
            {(['kg', 'lb'] as const).map((u) => (
              <Chip
                key={u}
                label={u}
                active={settings.unit === u}
                onPress={() => updateSettings({ unit: u })}
              />
            ))}
          </View>
          <Dim style={s.hint}>
            Pounds to begin with; switch whenever you like and it stays switched, including
            across updates. Weights are always stored in kilograms underneath, so changing this
            never rewrites your history.
          </Dim>
          <Text style={[s.label, s.spaced]}>EXERCISE PHOTOS</Text>
          <View style={s.row}>
            <Chip
              label="Show photos"
              active={settings.showExercisePhotos}
              onPress={() => updateSettings({ showExercisePhotos: true })}
            />
            <Chip
              label="Drawings only"
              active={!settings.showExercisePhotos}
              onPress={() => updateSettings({ showExercisePhotos: false })}
            />
          </View>
          <Dim style={s.hint}>
            Photos come from a public exercise dataset whose image licence was never confirmed by
            its maintainer. Turning them off uses the drawn muscle figures instead, which need no
            network and carry no third-party rights. See THIRD-PARTY-NOTICES.md.
          </Dim>
        </Card>
        {/*
          * About: which build this is, and what it holds.
          *
          * It used to also list every version this device had run, and the phone's OS string.
          * Both were written for one bad week during the app-icon problem, when nobody could
          * establish which build anyone was on. That question is answered by the single Version
          * line above; the log was a growing list nobody read afterwards, and the OS string was
          * a fact the user already knew about their own phone.
          */}
        <Card testID="about">
          <H2>About</H2>
          <Row label="Version" value={appVersion} />
          <Row label="Data format" value={`v${SCHEMA_VERSION}`} />
          <Row label="Exercises" value={String(EXERCISES.length)} />
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
  // Presets and stepper share a line; a little more gap so the field is not crowded by chips.
  restRow: { gap: theme.space(2) },
  wrap: { flexWrap: 'wrap', marginTop: theme.space(2) },
  measureRow: { flexDirection: 'row', gap: theme.space(4), marginTop: theme.space(3) },
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
