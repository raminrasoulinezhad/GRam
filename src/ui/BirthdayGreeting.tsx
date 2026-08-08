import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ageFrom, isBirthday } from '@/lib/device';
import { useStore } from '@/store/useStore';
import { theme } from './theme';

/**
 * A greeting on the user's birthday, by name.
 *
 * Both pieces are optional and neither is prompted for, so this only ever appears for someone
 * who volunteered a date of birth - which the app already asks for, to work out age. Nothing is
 * sent anywhere and nothing is stored beyond what was already there.
 *
 * Dismissing hides it for the rest of the launch. Unlike the backup warning there is nothing to
 * act on, so it does not come back the moment you reopen the app on the same day - a greeting
 * that will not go away stops reading as a greeting.
 */
export function BirthdayGreeting() {
  const profile = useStore((s) => s.profile);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !isBirthday(profile.birthDate)) return null;

  const name = profile.displayName.trim();
  const age = ageFrom(profile.birthDate);

  return (
    <View style={s.bar} testID="birthday-greeting">
      <Text style={s.cake}>🎂</Text>

      <View style={{ flex: 1 }}>
        <Text style={s.title} testID="birthday-title">
          {name === '' ? 'Happy birthday!' : `Happy birthday, ${name}!`}
        </Text>
        {/*
          * The age only appears when it is known and sane - ageFrom returns null for a date it
          * cannot parse or one that implies an implausible age, and "You are null today" is a
          * worse birthday message than none.
          */}
        {age !== null ? <Text style={s.body}>{age} today. Have a good one.</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        testID="birthday-dismiss"
        hitSlop={10}
        onPress={() => setDismissed(true)}
      >
        <Ionicons name="close" size={18} color={theme.color.textFaint} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    backgroundColor: theme.color.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.accent,
  },
  cake: { fontSize: 22 },
  title: { color: theme.color.accent, fontSize: theme.font.body, fontWeight: '800' },
  body: { color: theme.color.textDim, fontSize: theme.font.tiny, marginTop: 2 },
});
