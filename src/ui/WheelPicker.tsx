import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  clampOffset,
  flingIndex,
  indexAt,
  ITEM_HEIGHT,
  nearestIndex,
  offsetFor,
  visibleRange,
  WHEEL_HEIGHT,
  WHEEL_PADDING,
} from '@/lib/wheel';
import { theme } from './theme';

/**
 * A scroll wheel: drag a column of numbers, the one under the line is the answer.
 *
 * Replaces a typed field with a stepper. Both were wrong for these values - typing means a
 * keyboard covering half the screen, and a stepper means forty taps to get from 80 kg to 100.
 * A wheel reaches anything in one flick and cannot produce a value that is not on the list.
 *
 * WHY THIS IS NOT A SCROLLVIEW
 * It was, first, and the opening position could not be set. `contentOffset` is ignored by
 * react-native-web; `onContentSizeChange` never fires there at all; `onLayout` fires before the
 * rows exist; and `scrollTo` moved nothing even from a mount effect retried across ten frames -
 * while setting the element's own `scrollTop` from the console worked instantly. A wheel that
 * opens on your actual height was simply not reachable through that API.
 *
 * Driving the offset directly removes the question. The list is a translated View, the gesture
 * is a PanResponder, and nothing depends on what a platform decides to do with a scroll
 * container. It also makes virtualisation trivial, which the 441-row weight wheel wants.
 *
 * The arithmetic - offsets, clamping, fling distance, which rows to draw - is in lib/wheel.ts
 * where it is tested. What is left here is the gesture, which is not.
 */
export function WheelPicker({
  values,
  value,
  onChange,
  format,
  suffix,
  testID,
}: {
  values: readonly number[];
  /** Nearest entry wins; the stored value does not have to be on the wheel. */
  value: number | null;
  onChange: (next: number) => void;
  format?: (v: number) => string;
  suffix?: string;
  testID?: string;
}) {
  const selected = nearestIndex(values, value);
  const [offset, setOffset] = useState(() => offsetFor(selected));

  /*
   * Live copies for the gesture handlers.
   *
   * PanResponder is built once and closes over whatever was in scope then. A drag reading
   * `offset` out of that closure would work from a value frozen at mount, and the wheel would
   * jump back to where it started the moment a finger moved.
   */
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const startRef = useRef(0);
  const countRef = useRef(values.length);
  countRef.current = values.length;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /** Eases to a row and reports it. */
  const settleOn = useCallback((index: number) => {
    const target = offsetFor(index);
    const from = offsetRef.current;
    const started = Date.now();
    const DURATION = 180;

    const step = () => {
      const t = Math.min(1, (Date.now() - started) / DURATION);
      // Ease out, so it arrives rather than stopping dead.
      setOffset(from + (target - from) * (1 - (1 - t) ** 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    const picked = valuesRef.current[index];
    if (picked !== undefined) onChangeRef.current(picked);
  }, []);

  /*
   * Follows the value when it changes from outside. Switching kg to lb rebuilds the whole wheel
   * underneath, and the marker has to land on the equivalent row rather than staying on row 43
   * of a different scale.
   */
  useEffect(() => {
    setOffset(offsetFor(selected));
  }, [selected]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Two pixels of slack, so a tap on the nudge arrows is not stolen as a drag.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          startRef.current = offsetRef.current;
        },
        onPanResponderMove: (_e, g) => {
          // Dragging down reveals earlier values, so the offset falls as dy rises.
          setOffset(clampOffset(startRef.current - g.dy, countRef.current));
        },
        onPanResponderRelease: (_e, g) => {
          settleOn(flingIndex(offsetRef.current, g.vy, countRef.current));
        },
        onPanResponderTerminate: () => {
          settleOn(indexAt(offsetRef.current, countRef.current));
        },
      }),
    [settleOn],
  );

  const shown = indexAt(offset, values.length);
  const { from, to } = visibleRange(offset, values.length);
  const rows: number[] = [];
  for (let i = from; i <= to; i++) rows.push(i);

  const nudge = (delta: number) => {
    const next = Math.min(values.length - 1, Math.max(0, shown + delta));
    if (next !== shown) settleOn(next);
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <View pointerEvents="none" style={styles.marker} />

      <View style={StyleSheet.absoluteFill} {...responder.panHandlers} testID={`${testID}-surface`}>
        {rows.map((i) => (
          <View
            key={values[i]}
            pointerEvents="none"
            style={[styles.item, { top: WHEEL_PADDING + i * ITEM_HEIGHT - offset }]}
          >
            <Text
              style={[styles.label, i === shown ? styles.labelOn : styles.labelOff]}
              numberOfLines={1}
            >
              {format ? format(values[i]) : String(values[i])}
            </Text>
          </View>
        ))}
      </View>

      {suffix ? (
        <Text pointerEvents="none" style={styles.suffix}>
          {suffix}
        </Text>
      ) : null}

      {/*
        * Arrows as well as the drag. A wheel is a poor target for a mouse, plans get written at
        * a desk, and nudging by exactly one row is fiddly by hand even on a phone.
        */}
      <View style={styles.nudgeCol} pointerEvents="box-none">
        <Nudge dir="up" disabled={shown === 0} onPress={() => nudge(-1)} testID={`${testID}-up`} />
        <Nudge
          dir="down"
          disabled={shown === values.length - 1}
          onPress={() => nudge(1)}
          testID={`${testID}-down`}
        />
      </View>
    </View>
  );
}

function Nudge({
  dir,
  disabled,
  onPress,
  testID,
}: {
  dir: 'up' | 'down';
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 'up' ? 'Previous value' : 'Next value'}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [styles.nudgeBtn, (pressed || disabled) && { opacity: 0.35 }]}
    >
      <Ionicons
        name={dir === 'up' ? 'chevron-up' : 'chevron-down'}
        size={15}
        color={theme.color.textDim}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: WHEEL_HEIGHT,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceAlt,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accentDim,
  },
  item: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: theme.font.h3, fontWeight: '700' },
  labelOn: { color: theme.color.text },
  // Neighbours are dimmed rather than hidden: they are how you judge which way to drag.
  labelOff: { color: theme.color.textFaint, fontWeight: '600' },
  suffix: {
    position: 'absolute',
    right: theme.space(7),
    top: WHEEL_PADDING + ITEM_HEIGHT / 2 - 9,
    color: theme.color.textDim,
    fontSize: theme.font.small,
    fontWeight: '700',
  },
  nudgeCol: {
    position: 'absolute',
    right: theme.space(1),
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: theme.space(1),
  },
  nudgeBtn: { padding: theme.space(1.5) },
});
