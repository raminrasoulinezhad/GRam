import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  birthYearRange,
  clampDay,
  daysInMonth,
  formatBirthDate,
  MONTH_SHORT,
  parseISODate,
  toISODate,
} from '@/lib/birthDate';
import { Button } from './components';
import { theme } from './theme';

/**
 * Picking a date of birth in three taps: year, then month, then day.
 *
 * Replaces a text box that asked for `YYYY-MM-DD` and silently kept whatever was typed. That
 * field had every problem an unvalidated date entry has - the wrong separator, the American
 * order, a typo'd year - and the app could not tell any of them from a real answer, so a
 * mistyped birthday just quietly produced a wrong age.
 *
 * Not a month grid, for the reason set out in lib/birthDate.ts: a birthday is decades back and
 * paging a calendar there is absurd. Year first, newest plausible year at the top, and the
 * stages narrow from there.
 */
export function DateField({
  value,
  onChange,
  testID,
}: {
  /** Stored `yyyy-mm-dd`, or null. */
  value: string | null;
  onChange: (next: string | null) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const parts = parseISODate(value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Date of birth, ${formatBirthDate(value, 'not set')}`}
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [s.field, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="calendar-outline" size={17} color={theme.color.textDim} />
        <Text style={[s.fieldText, parts === null && { color: theme.color.textFaint }]}>
          {formatBirthDate(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.color.textFaint} />
      </Pressable>

      {open ? (
        <DateSheet
          value={value}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

type Stage = 'year' | 'month' | 'day';

function DateSheet({
  value,
  onPick,
  onClose,
}: {
  value: string | null;
  onPick: (next: string | null) => void;
  onClose: () => void;
}) {
  const existing = parseISODate(value);
  const [year, setYear] = useState<number | null>(existing?.year ?? null);
  const [month, setMonth] = useState<number | null>(existing?.month ?? null);
  /*
   * Reopening an already-set date starts on the day step with the year and month filled in, so
   * correcting the day is one tap rather than three. A blank field starts at the year.
   */
  const [stage, setStage] = useState<Stage>(existing ? 'day' : 'year');

  const years = useMemo(() => birthYearRange(), []);
  const days = useMemo(
    () => (year !== null && month !== null ? daysInMonth(year, month) : 31),
    [year, month],
  );

  const heading =
    stage === 'year' ? 'Which year?' : stage === 'month' ? 'Which month?' : 'Which day?';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet} testID="date-sheet">
          <View style={s.header}>
            {/* Going back a stage rather than out, so a wrong year is one tap to fix. */}
            {stage !== 'year' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back a step"
                testID="date-back"
                hitSlop={10}
                onPress={() => setStage(stage === 'day' ? 'month' : 'year')}
              >
                <Ionicons name="chevron-back" size={22} color={theme.color.textDim} />
              </Pressable>
            ) : null}

            <View style={{ flex: 1 }}>
              <Text style={s.heading}>{heading}</Text>
              {/* What has been chosen so far, so the stages do not feel like separate questions. */}
              <Text style={s.crumb} testID="date-crumb">
                {[
                  year === null ? null : String(year),
                  month === null ? null : MONTH_SHORT[month - 1],
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Nothing chosen yet'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="date-close"
              hitSlop={10}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color={theme.color.textDim} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.body}>
            {stage === 'year' ? (
              <View style={s.grid}>
                {years.map((y) => (
                  <Cell
                    key={y}
                    label={String(y)}
                    active={y === year}
                    wide
                    testID={`year-${y}`}
                    onPress={() => {
                      setYear(y);
                      setStage('month');
                    }}
                  />
                ))}
              </View>
            ) : null}

            {stage === 'month' ? (
              <View style={s.grid}>
                {MONTH_SHORT.map((name, i) => (
                  <Cell
                    key={name}
                    label={name}
                    active={i + 1 === month}
                    wide
                    testID={`month-${i + 1}`}
                    onPress={() => {
                      setMonth(i + 1);
                      setStage('day');
                    }}
                  />
                ))}
              </View>
            ) : null}

            {stage === 'day' ? (
              <View style={s.grid}>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                  <Cell
                    key={d}
                    label={String(d)}
                    active={existing?.day === d}
                    testID={`day-${d}`}
                    onPress={() => {
                      if (year === null || month === null) return;
                      onPick(toISODate({ year, month, day: clampDay(year, month, d) }));
                    }}
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>

          {value !== null ? (
            <View style={s.footer}>
              <Button
                label="Clear date of birth"
                variant="ghost"
                onPress={() => onPick(null)}
                testID="date-clear"
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Cell({
  label,
  active,
  wide,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  wide?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        s.cell,
        wide ? s.cellWide : null,
        active && s.cellActive,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.cellText, active && s.cellTextActive]}>{label}</Text>
    </Pressable>
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
  fieldText: { flex: 1, color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    padding: theme.space(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  heading: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  crumb: { color: theme.color.accent, fontSize: theme.font.tiny, fontWeight: '700' },
  body: { padding: theme.space(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2) },
  cell: {
    minWidth: 44,
    paddingVertical: theme.space(2.5),
    paddingHorizontal: theme.space(2),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceAlt,
    alignItems: 'center',
  },
  cellWide: { minWidth: 72 },
  cellActive: { backgroundColor: theme.color.accentDim, borderColor: theme.color.accent },
  cellText: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '600' },
  cellTextActive: { color: theme.color.accent, fontWeight: '800' },
  footer: {
    padding: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
});
