import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
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
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
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
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[s.dim, style]} numberOfLines={numberOfLines}>
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
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'primary' | 'secondary';
}) {
  const content = (
    <View
      style={[
        s.chip,
        active && s.chipActive,
        tone === 'primary' && s.chipPrimary,
        tone === 'secondary' && s.chipSecondary,
      ]}
    >
      <Text style={[s.chipLabel, active && s.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}

/** Horizontal scroller of filter chips with an "All" reset at the head. */
export function ChipRow({
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  options: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
  allLabel?: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
      <Chip label={allLabel} active={value === null} onPress={() => onChange(null)} />
      {options.map((o) => (
        <Chip key={o} label={o} active={value === o} onPress={() => onChange(value === o ? null : o)} />
      ))}
    </ScrollView>
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

export function Divider() {
  return <View style={s.divider} />;
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
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800', letterSpacing: -0.5 },
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
  chipRow: { gap: theme.space(2), paddingHorizontal: theme.space(4), paddingVertical: theme.space(2) },
  chip: {
    paddingVertical: theme.space(1.5),
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
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
  },
  numInput: {
    flex: 1,
    color: theme.color.text,
    fontSize: theme.font.body,
    fontWeight: '600',
    paddingVertical: theme.space(2),
    textAlign: 'center',
  },
  numSuffix: { color: theme.color.textFaint, fontSize: theme.font.tiny, paddingRight: 2 },
  stepper: { justifyContent: 'center', paddingLeft: 2 },
  stepText: {
    color: theme.color.textDim,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    paddingHorizontal: 2,
  },
  empty: { alignItems: 'center', padding: theme.space(10), gap: theme.space(2) },
  emptyTitle: { color: theme.color.textDim, fontSize: theme.font.h3, fontWeight: '600' },
  emptyHint: { color: theme.color.textFaint, fontSize: theme.font.small, textAlign: 'center' },
  divider: { height: 1, backgroundColor: theme.color.border },
});
