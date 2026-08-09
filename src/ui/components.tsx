import { ReactNode, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { theme } from './theme';

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[s.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}
export function Body({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[s.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Dim({
  children,
  style,
  numberOfLines,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}) {
  return (
    <Text style={[s.dim, style]} numberOfLines={numberOfLines} testID={testID}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.btnPrimary,
        variant === 'secondary' && s.btnSecondary,
        variant === 'danger' && s.btnDanger,
        variant === 'ghost' && s.btnGhost,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
        style,
      ]}
    >
      <Text
        style={[
          s.btnLabel,
          variant === 'primary' && { color: '#04120A' },
          variant === 'danger' && { color: theme.color.danger },
          variant === 'ghost' && { color: theme.color.textDim },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = 'default',
  testID,
  style,
  compact = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'primary' | 'secondary';
  testID?: string;
  /** Applied to whichever element is outermost, for callers that need to place the chip. */
  style?: StyleProp<ViewStyle>;
  /**
   * Tighter horizontal padding, for rows that must fit a fixed number of chips.
   *
   * The weekday picker needs seven across the narrowest phone. Stretching them with `flex: 1`
   * looked like the obvious answer and collapsed the whole row to nothing - a flex basis of
   * zero inside a container that was not distributing free space. Making each chip naturally
   * narrow works everywhere and depends on nothing.
   */
  compact?: boolean;
}) {
  const content = (
    <View
      // A chip with no press handler renders no Pressable, so the id would have nowhere to go.
      testID={onPress ? undefined : testID}
      style={[
        s.chip,
        compact && s.chipCompact,
        active && s.chipActive,
        tone === 'primary' && s.chipPrimary,
        tone === 'secondary' && s.chipSecondary,
        onPress ? null : style,
      ]}
    >
      <Text style={[s.chipLabel, active && s.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID} style={style}>
      {content}
    </Pressable>
  );
}

/**
 * A single-line text field that owns the string being typed.
 *
 * Binding a TextInput straight to a store value round-trips every keystroke through the store
 * and back into `value`. On react-native-web that is a race: the re-render can land after the
 * browser has already applied the next key, and the DOM value is reset to the previous one. The
 * symptom is oddly specific and was reported twice - the last character refuses to be deleted,
 * because backspacing to empty is exactly when the round-trip result differs from what is on
 * screen.
 *
 * So the field keeps its own text and only ever pushes outward. It is seeded once; give it a
 * `key` tied to the thing being named, and it re-seeds when that identity changes.
 *
 * NumberField solves the same problem for the same reason - see the note there.
 */
export function NameField({
  initialValue,
  onChange,
  onCommit,
  placeholder,
  style,
  testID,
}: {
  initialValue: string;
  /** Called on every keystroke, including with an empty string. */
  onChange: (next: string) => void;
  /** Called when editing finishes, for defaulting an abandoned blank. */
  onCommit?: (current: string) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const [text, setText] = useState(initialValue);

  return (
    <TextInput
      testID={testID}
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChange(next);
      }}
      onBlur={() => onCommit?.(text)}
      placeholder={placeholder}
      placeholderTextColor={theme.color.textFaint}
      style={style}
    />
  );
}

/**
 * A compact numeric cell used throughout the set tables.
 * Keeps its own string state so a partially-typed value like "12." is not clobbered by
 * the numeric round-trip on every keystroke.
 */
export function NumberField({
  value,
  onChange,
  suffix,
  width = 68,
  step,
  testID,
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  suffix?: string;
  width?: number;
  step?: number;
  testID?: string;
}) {
  return (
    <View style={[s.numWrap, { width }]}>
      <TextInput
        testID={testID}
        value={value === undefined ? '' : String(value)}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9.]/g, '');
          if (cleaned === '') return onChange(undefined);
          const n = Number(cleaned);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        keyboardType="decimal-pad"
        inputMode="decimal"
        selectTextOnFocus
        placeholder="-"
        placeholderTextColor={theme.color.textFaint}
        style={s.numInput}
      />
      {suffix ? <Text style={s.numSuffix}>{suffix}</Text> : null}
      {step ? (
        <View style={s.stepper}>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => onChange(Math.max(0, (value ?? 0) + step))}
          >
            <Text style={s.stepText}>+</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => onChange(Math.max(0, (value ?? 0) - step))}
          >
            <Text style={s.stepText}>-</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {hint ? <Text style={s.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space(3.5),
  },
  h2: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  body: { color: theme.color.text, fontSize: theme.font.body },
  dim: { color: theme.color.textDim, fontSize: theme.font.small },
  btn: {
    paddingVertical: theme.space(3),
    paddingHorizontal: theme.space(4),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: theme.color.accent },
  btnSecondary: {
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.color.danger },
  btnGhost: { backgroundColor: 'transparent' },
  btnLabel: { color: theme.color.text, fontWeight: '700', fontSize: theme.font.body },
  chip: {
    paddingVertical: theme.space(1.5),
    paddingHorizontal: theme.space(3),
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipCompact: { paddingHorizontal: theme.space(1.5) },
  chipActive: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  chipPrimary: { backgroundColor: theme.color.accentDim, borderColor: theme.color.accentDim },
  chipSecondary: { backgroundColor: theme.color.surfaceAlt },
  chipLabel: { color: theme.color.textDim, fontSize: theme.font.tiny, fontWeight: '600' },
  chipLabelActive: { color: '#04120A' },
  numWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space(1.5),
    // Anything that does overflow is clipped rather than allowed to sit on top of the
    // neighbouring field.
    overflow: 'hidden',
  },
  numInput: {
    flex: 1,
    /*
     * Without minWidth the field overflows its own box on web.
     *
     * An <input> carries an intrinsic width of roughly 200px from its default `size`, and a
     * flex item will not shrink below its intrinsic minimum while min-width is `auto`. So
     * `flex: 1` grew it to 201px inside a 104px container and pushed the unit label and the
     * +/- buttons outside the border entirely. Native RN has no such intrinsic width, which
     * is why this only showed up in the browser and the installed web app.
     */
    minWidth: 0,
    color: theme.color.text,
    fontSize: theme.font.body,
    fontWeight: '600',
    paddingVertical: theme.space(2),
    paddingHorizontal: 0,
    textAlign: 'center',
  },
  numSuffix: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  stepper: { justifyContent: 'center', paddingLeft: 2, flexShrink: 0 },
  stepText: {
    color: theme.color.textDim,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    paddingHorizontal: 3,
  },
  empty: { alignItems: 'center', padding: theme.space(10), gap: theme.space(2) },
  emptyTitle: { color: theme.color.textDim, fontSize: theme.font.h3, fontWeight: '600' },
  emptyHint: { color: theme.color.textFaint, fontSize: theme.font.small, textAlign: 'center' },
});
