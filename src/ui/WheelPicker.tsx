import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Picker from '@quidone/react-native-wheel-picker';
import { ITEM_HEIGHT, nearestIndex, VISIBLE_ITEMS } from '@/lib/wheel';
import { theme } from './theme';

/**
 * A scroll wheel: spin a column of numbers, the one under the line is the answer.
 *
 * Replaces a typed field with a stepper. Both were wrong for these values - typing raises a
 * keyboard over half the screen, and stepping takes forty taps to get from 80 kg to 100.
 *
 * WHY THIS IS A DEPENDENCY AND NOT OURS
 * It was hand-rolled twice and neither version worked in the installed app.
 *
 * Built on a ScrollView, the opening position could not be set: `contentOffset` is ignored by
 * react-native-web, `onContentSizeChange` never fires there at all, `onLayout` runs before the
 * rows exist, and `scrollTo` moved nothing even from a mount effect retried across ten frames -
 * while setting the element's own `scrollTop` from the console worked instantly. So the wheel
 * opened at 120 cm for someone 180 cm tall.
 *
 * Driving the offset from a PanResponder fixed that and broke the drag instead: the wheel sits
 * inside a scrolling page, and a browser claims a vertical touch drag for page scrolling before
 * React Native's responder system is consulted. The page moved and the wheel did not.
 *
 * The gesture handling a wheel needs across web and native turned out to be the whole problem,
 * and six attempts at it was more than one control is worth. This wraps a maintained library
 * instead, which scrolls a real overflow container - so the browser does the dragging and the
 * hard part stops being ours. The wrapper stays so the rest of the app keeps talking in plain
 * numbers - the library speaks in `{value, label}` items - and so replacing it touches one file.
 *
 * The one thing the library does not get right here is the *opening* position, which lands on
 * the first row on react-native-web for the same reason ours did. That is patched below, and
 * only there.
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
  const data = useMemo(
    () => values.map((v) => ({ value: v, label: format ? format(v) : String(v) })),
    [values, format],
  );

  /*
   * The stored number is often not on the wheel. Weight is kept in kilograms and shown in
   * pounds, so 80 kg is 176.37 lb and no row says that. Snapping to the nearest row is right;
   * falling back to the first one, as an exact lookup would, is not.
   */
  const index = values.length > 0 ? nearestIndex(values, value) : 0;

  /*
   * Open on the current value.
   *
   * On react-native-web the wheel renders at its first row whatever `value` says, so a body
   * weight opens at 30 kg and a set of 80 kg opens at zero. The library HAS a fix for exactly
   * this - Picker.tsx re-applies the offset after mount - but it is gated to `Platform.OS ===
   * 'ios'`, and its other correction path (useSyncScrollEffect) cannot help, because it skips
   * when the list's recorded index already equals the wanted one. Which it does: the library
   * passed `contentOffset` and believes it worked. Only the DOM disagrees.
   *
   * So the offset is written to the scroll container directly, which is proven to hold. It is
   * contained to this one effect, it is web-only, and if the library changes its internals this
   * degrades to "opens at the top" rather than breaking.
   *
   * WHY setTimeout AND NOT requestAnimationFrame
   * The previous attempt used rAF and never fired at all when the page was not compositing -
   * a backgrounded tab, or an installed app the moment before it is brought forward. Worse, it
   * made the bug look unfixable when it was only unobserved. Timers run either way. The
   * schedule re-asserts across the sheet's slide-in animation, because the library lays the
   * list out again as the height settles and whichever write lands last wins.
   */
  const boxRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || index === 0) return;
    const box = boxRef.current as unknown as HTMLElement | null;
    if (!box?.querySelectorAll) return;

    const target = index * ITEM_HEIGHT;
    let cancelled = false;
    // Once a finger is on the wheel, the position is the user's business. Re-asserting under a
    // drag would drag it back out from under them.
    const stop = () => {
      cancelled = true;
    };
    box.addEventListener('pointerdown', stop);
    box.addEventListener('touchstart', stop);

    const place = () => {
      if (cancelled) return;
      const scroller = [...box.querySelectorAll('*')].find(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 10,
      );
      if (scroller) scroller.scrollTop = target;
    };
    const timers = [0, 16, 50, 120, 250, 400].map((ms) => setTimeout(place, ms));

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      box.removeEventListener('pointerdown', stop);
      box.removeEventListener('touchstart', stop);
    };
    // Once, for the value the wheel opened with. Later changes come through the library.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An empty wheel has nothing to show and nothing to pick; render the frame and stop.
  if (values.length === 0) return <View style={s.wrap} testID={testID} />;
  const shown = values[index];

  return (
    <View ref={boxRef} style={s.wrap} testID={testID}>
      <Picker
        data={data}
        value={shown}
        onValueChanged={({ item }) => onChange(item.value)}
        itemHeight={ITEM_HEIGHT}
        visibleItemCount={VISIBLE_ITEMS}
        // Tapping a neighbouring row selects it, which beats a precise drag when the value you
        // want is already on screen.
        enableScrollByTapOnItem
        itemTextStyle={s.item}
        overlayItemStyle={s.overlay}
      />
      {suffix ? (
        <Text pointerEvents="none" style={s.suffix}>
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceAlt,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  item: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  overlay: { backgroundColor: theme.color.accentDim, borderRadius: theme.radius.sm },
  suffix: {
    position: 'absolute',
    right: theme.space(3),
    alignSelf: 'center',
    color: theme.color.textDim,
    fontSize: theme.font.small,
    fontWeight: '700',
  },
});
