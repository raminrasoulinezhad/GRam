import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDuration } from '@/lib/format';
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
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
      return;
    }
    setNow(Date.now());
    interval.current = setInterval(() => setNow(Date.now()), 250);
    return () => {
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
    };
  }, [startedAt]);

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
