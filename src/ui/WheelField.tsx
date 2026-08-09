import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { nearestIndex } from '@/lib/wheel';
import { Button } from './components';
import { Sheet } from './Sheet';
import { theme } from './theme';
import { WheelPicker } from './WheelPicker';

/**
 * A compact field that opens a wheel when tapped.
 *
 * The wheel itself needs about two hundred pixels of height to be worth having, and a page with
 * two of them showing at once is mostly wheel. Worse, the same control has to go into set rows,
 * where a dozen are on screen together - inline they would turn one screen of work into six.
 *
 * So the wheel lives in a sheet and the page keeps a one-line field, which is also where the
 * current value is stated plainly - readable without opening anything, and the thing a screen
 * reader announces.
 *
 * The choice is committed on Done rather than as the wheel turns. Writing per scroll tick would
 * push a store update per frame of a drag, and for a recorded set it would rewrite history
 * several dozen times on the way past.
 */
export function WheelField({
  value,
  values,
  onChange,
  format,
  suffix,
  title,
  placeholder = 'Not set',
  width,
  compact = false,
  testID,
}: {
  value: number | null;
  values: readonly number[];
  onChange: (next: number) => void;
  format?: (v: number) => string;
  suffix?: string;
  /** Heading for the sheet. Defaults to the suffix, which is usually enough. */
  title?: string;
  placeholder?: string;
  /** Fixed width, for a set row where several sit side by side in a table. */
  width?: number;
  /**
   * Tighter padding and no top margin, for the set tables.
   *
   * A workout screen shows a dozen of these at once, so the padding that reads as generous on
   * the Profile page reads as a wall of boxes here.
   */
  compact?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = value === null ? placeholder : `${format ? format(value) : value}${suffix ? ` ${suffix}` : ''}`;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title ?? suffix ?? 'Value'}: ${label}`}
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [
          s.field,
          compact && s.fieldCompact,
          width !== undefined && { width },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text
          style={[
            s.value,
            compact && s.valueCompact,
            value === null && { color: theme.color.textFaint },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={compact ? 13 : 16} color={theme.color.textFaint} />
      </Pressable>

      {open ? (
        <WheelSheet
          value={value}
          values={values}
          format={format}
          suffix={suffix}
          title={title ?? suffix ?? 'Choose'}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
          testID={testID}
        />
      ) : null}
    </>
  );
}

function WheelSheet({
  value,
  values,
  onPick,
  onClose,
  format,
  suffix,
  title,
  testID,
}: {
  value: number | null;
  values: readonly number[];
  onPick: (next: number) => void;
  onClose: () => void;
  format?: (v: number) => string;
  suffix?: string;
  title: string;
  testID?: string;
}) {
  // Seeded from the current value so closing without touching anything changes nothing.
  const [draft, setDraft] = useState(() =>
    values.length > 0 ? values[nearestIndex(values, value)] : 0,
  );

  return (
    <Sheet
      title={title}
      onClose={onClose}
      testID={testID ? `${testID}-sheet` : undefined}
      footer={
        <Button
          label="Done"
          style={{ flex: 1 }}
          onPress={() => onPick(draft)}
          testID={testID ? `${testID}-done` : undefined}
        />
      }
    >
      <WheelPicker
        values={values}
        value={draft}
        onChange={setDraft}
        format={format}
        suffix={suffix}
        testID={testID ? `${testID}-wheel` : undefined}
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(3),
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceAlt,
    marginTop: theme.space(1),
  },
  fieldCompact: {
    gap: theme.space(1),
    paddingVertical: theme.space(2),
    paddingHorizontal: theme.space(2),
    borderRadius: theme.radius.sm,
    marginTop: 0,
  },
  value: { flex: 1, color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  valueCompact: { fontSize: theme.font.small },

});
