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
import { range } from '@/lib/wheel';
import { Button, Card, Chip, Dim, H2, NumberField, Screen } from '@/ui/components';
import { useConfirm } from '@/ui/confirm';
import { BackupCard } from '@/ui/BackupCard';
import { DateField } from '@/ui/DateField';
import { ThemeCard } from '@/ui/ThemeCard';
import { WheelField } from '@/ui/WheelField';
import { theme } from '@/ui/theme';
const SEXES = ['male', 'female', 'unspecified'] as const;

/**
 * The three rest lengths worth a dedicated button. Anything else is a job for the stepper
 * beside them - a row of five presets was a menu to read rather than a shortcut to tap, and
 * the two long ones were rarely the answer.
 */
const REST_PRESETS = [45, 60, 90] as const;

/*
 * What the body wheels offer.
 *
 * Wide enough to cover any adult without being a scroll marathon: heights from a very short
 * adult to a very tall one, and weights well past either end of what a gym sees. The weight
 * step is half a kilo, which is the smallest change worth recording, and a whole pound, which
 * is the same resolution in the other unit rather than a spuriously finer one.
 */
const HEIGHTS_CM = range(120, 230, 1);
const WEIGHTS_KG = range(30, 250, 0.5);
const WEIGHTS_LB = range(66, 550, 1);

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
        {/*
          * Who you are, in one card.
          *
          * Name and body used to be two, which put a heading, a paragraph and a card border
          * between your name and your height - three separations for facts that are the same
          * kind of thing and get entered on the same afternoon. Merged, everything the app
          * knows about its single user is one glance instead of a scroll.
          */}
        <Card testID="profile-you">
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

          <View style={s.divider} />

          {/*
            * The old line explained what these fields were *for*. The question someone actually
            * has when a fitness app asks for their body is where it ends up, so that is what
            * the sentence answers now.
            */}
          <Dim style={s.hint}>They stay on this machine. Nowhere else.</Dim>
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
          <DateField
            testID="profile-birthdate"
            value={profile.birthDate}
            onChange={(birthDate) => updateProfile({ birthDate })}
          />
          {/*
            * A field that opens a wheel, rather than a wheel on the page. These are two numbers
            * a person changes maybe twice a year: a keyboard covering half the screen was the
            * wrong trade, a stepper needed forty taps to go from 80 kg to 100, and two wheels
            * sitting open made the card mostly wheel.
            */}
          <View style={s.measureRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>HEIGHT</Text>
              <WheelField
                testID="profile-height"
                title="Height"
                values={HEIGHTS_CM}
                value={profile.heightCm}
                suffix="cm"
                onChange={(heightCm) => updateProfile({ heightCm })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>WEIGHT</Text>
              {/*
                * The wheel is built in whichever unit is on screen and converted back to the
                * kilograms everything is stored in. Switching units rebuilds it, and the marker
                * lands on the equivalent row rather than on the same row number.
                */}
              <WheelField
                testID="profile-weight"
                title="Weight"
                values={settings.unit === 'lb' ? WEIGHTS_LB : WEIGHTS_KG}
                value={
                  profile.weightKg === null
                    ? null
                    : Math.round(toDisplayWeight(profile.weightKg, settings.unit))
                }
                suffix={settings.unit}
                onChange={(shown) =>
                  updateProfile({ weightKg: fromDisplayWeight(shown, settings.unit) })
                }
              />
            </View>
          </View>
        </Card>
        {/*
          * Goal, experience and available equipment used to be collected here. All three were
          * write-only: nothing in the app read them back, and the equipment card went further
          * and claimed the catalog was filtered by it, which was never true. Inputs that do
          * nothing are worse than absent ones - they cost attention and imply a behaviour that
          * does not exist. The fields remain in the stored profile, so the questions can come
          * back the day something actually uses them; see docs/ROADMAP.md.
          */}
        {/*
          * The settings run cheapest-to-decide first: units is one tap you make once, rest is a
          * number, the look is eight things to compare. Backup and About sit at the bottom
          * because neither is a setting - one is a chore and the other is a reference.
          */}
        <Card>
          <H2>Units</H2>
          <View style={[s.row, s.spaced]}>
            {(['kg', 'lb'] as const).map((u) => (
              <Chip
                key={u}
                label={u}
                testID={`unit-${u}`}
                active={settings.unit === u}
                onPress={() => updateSettings({ unit: u })}
              />
            ))}
          </View>
          {/*
            * No note here. It used to explain that weights are stored in kilograms underneath
            * and that switching never rewrites your history - true, and reassuring exactly once,
            * after which it was a paragraph sitting under two buttons forever. The behaviour it
            * described is pinned by a test instead; see profile.screen.test.tsx.
            */}
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
          * Rest applies to every exercise, so it belongs here rather than in each plan. The
          * store retimes existing plans to match - see setDefaultRest.
          *
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
        <ThemeCard />
        <BackupCard />
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
  // Separates the two halves of the merged card. A rule rather than a second card: it keeps
  // name and body together as one thing while still marking where the numbers start.
  divider: {
    height: 1,
    backgroundColor: theme.color.border,
    marginTop: theme.space(4),
    marginBottom: theme.space(3),
  },
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
