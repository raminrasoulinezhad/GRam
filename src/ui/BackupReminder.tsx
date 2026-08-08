import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { countLoggedSets } from '@/analytics/volume';
import { staleness, stalenessMessage } from '@/store/backup';
import { selectSessions, useStore } from '@/store/useStore';
import { theme } from './theme';

/**
 * A standing warning to export, shown above every screen until a backup is taken.
 *
 * Not a real push notification, and deliberately not. This is an offline web app with no server
 * and no account, so there is nothing that could wake the phone while it is closed - and asking
 * for notification permission just to say "back up your data" would spend the one prompt most
 * people refuse on the least interesting thing the app will ever tell them.
 *
 * So it interrupts where interrupting is free: at the top of the app, whenever it is open.
 *
 * The condition is `urgent` rather than `due`, and the difference matters. Profile's backup card
 * already mentions a dozen unsaved sets quietly, in the place you would go to act on it. This is
 * the louder one, and it is reserved for the cases worth breaking into what you were doing:
 * never backed up at all, a week of unsaved training, or forty sets. Anything more talkative
 * becomes wallpaper, and wallpaper is not read on the day it matters.
 *
 * Dismissing hides it until the app is next launched, not for good. The thing it warns about is
 * unrecoverable, so outlasting a moment's irritation is the entire job.
 */
export function BackupReminder() {
  /*
   * The sessions themselves, not a summary of them.
   *
   * A selector has to return the same reference for unchanged state, and anything that builds
   * an object - `exportState()`, `summarise(...)` - returns a fresh one every call. React reads
   * the store on each render to check for changes, so a selector like that never settles: it
   * re-renders forever, and warns "the result of getSnapshot should be cached". The derived
   * numbers belong in useMemo, below, where they are computed once per real change.
   */
  const sessions = useStore(selectSessions);
  const backup = useStore((s) => s.backup);
  const [dismissed, setDismissed] = useState(false);

  /*
   * Recomputed when the data changes, not on a timer. The banner only has to be right while
   * someone is looking at it, and a clock ticking to re-check a weekly threshold is work the
   * phone does not need to do.
   */
  const stale = useMemo(() => {
    const loggedSets = sessions.reduce((n, session) => n + countLoggedSets(session), 0);
    return staleness({ loggedSets }, backup, Date.now());
  }, [sessions, backup]);

  if (!stale.urgent || dismissed) return null;

  return (
    <View style={s.bar} testID="backup-banner">
      <Ionicons name="warning" size={20} color={theme.color.danger} />

      <View style={{ flex: 1 }}>
        <Text style={s.title}>Back up your training</Text>
        <Text style={s.body}>{stalenessMessage(stale)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        testID="backup-banner-go"
        onPress={() => router.push('/profile')}
        style={s.action}
      >
        <Text style={s.actionLabel}>Export</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss until the app is next opened"
        testID="backup-banner-dismiss"
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
    borderBottomColor: theme.color.danger,
  },
  title: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '700' },
  body: { color: theme.color.textDim, fontSize: theme.font.tiny, marginTop: 2 },
  action: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    backgroundColor: theme.color.accent,
  },
  actionLabel: { color: '#04120A', fontSize: theme.font.tiny, fontWeight: '800' },
});
