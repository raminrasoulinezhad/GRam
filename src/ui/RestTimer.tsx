import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDuration } from '@/lib/format';
import { useWakeLock } from '@/lib/wakeLock';
import { theme } from './theme';

/**
 * Counts down from `startedFor` seconds, anchored to `startedAt` rather than to a tick count,
 * so backgrounding the app or a dropped frame never drifts the clock.
 * Renders nothing when idle - it is a bar that appears, not a permanent fixture.
 */
export function RestTimer({
  startedAt,
  seconds,
  onDismiss,
}: {
  startedAt: number | null;
  seconds: number;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = startedAt === null ? null : startedAt + seconds * 1000;

  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      // Once the countdown has run out the bar is fixed text until it is dismissed, so going on
      // repainting it four times a second is pure battery for no pixels changed.
      if (t >= endsAt) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  /*
   * Rest is the other stretch where nobody touches the phone: it is face up on the bench and
   * the countdown is the only thing being watched. Released the moment the rest is over, so a
   * bar left undismissed cannot hold the display on for the remainder of the workout.
   */
  useWakeLock(endsAt !== null && seconds > 0 && now < endsAt);

  if (startedAt === null || seconds <= 0) return null;

  const remaining = seconds - Math.floor((now - startedAt) / 1000);
  const done = remaining <= 0;
  const progress = Math.max(0, Math.min(1, remaining / seconds));

  return (
    <View style={[s.bar, done && s.barDone]}>
      <View style={[s.fill, { width: `${progress * 100}%` }]} />
      <Ionicons
        name={done ? 'checkmark-circle' : 'timer-outline'}
        size={18}
        color={done ? theme.color.accent : theme.color.warn}
      />
      <Text style={s.label}>{done ? 'Rest complete' : `Rest ${formatDuration(remaining)}`}</Text>
      <Pressable accessibilityLabel="Dismiss rest timer" hitSlop={10} onPress={onDismiss}>
        <Ionicons name="close" size={18} color={theme.color.textDim} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(2.5),
    backgroundColor: theme.color.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    overflow: 'hidden',
  },
  barDone: { backgroundColor: theme.color.accentDim },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.color.border,
    opacity: 0.6,
  },
  label: { flex: 1, color: theme.color.text, fontWeight: '700', fontSize: theme.font.small },
});
