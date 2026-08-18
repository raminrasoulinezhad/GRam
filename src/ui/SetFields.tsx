import { StyleSheet, Text, View } from 'react-native';
import type { SetKind } from '@/catalog';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/format';
import { range } from '@/lib/wheel';
import type { SetValues } from '@/store/types';
import { theme } from './theme';
import { WheelField } from './WheelField';

/**
 * The editable numbers for one set, laid out according to its kind.
 *
 * Weight is stored in kg always; only the display converts, so switching units never rewrites
 * history.
 *
 * WHY WHEELS AND NOT TYPED FIELDS
 * These were number boxes with a stepper. Both halves were wrong in a gym: tapping the box
 * raises a keyboard over the bottom half of the screen - exactly where the rest of the set
 * table is - and the stepper needs eight taps to get from 60 to 80 kg. A wheel is one gesture
 * for either, and it puts nothing over the screen except the sheet you asked for.
 *
 * Each field states its value on the row, so a session can be read without opening anything.
 *
 * WHOLE NUMBERS
 * The wheels count in whole units. Half-kilo jumps are what plate maths sometimes produces, but
 * a wheel that offers them is twice as long to scroll for a resolution nobody logs at - and
 * anything already recorded at 82.5 kg keeps that number until the wheel is actually used,
 * because the row shows the stored value and the wheel only snaps to the nearest row when you
 * open it.
 */

/*
 * What each wheel offers.
 *
 * Ranges are generous at the top rather than tight: a wheel you can scroll past the end of is
 * a bug, and the cost of an unused row is nothing. Weight starts at 0, which is how a
 * bodyweight movement gets logged, and reps at 1, because a set of zero reps is not a set.
 *
 * WHY WEIGHT GETS COARSER AS IT GETS HEAVIER
 * One row per kilogram all the way to 300 is 301 rows, and the wheel opens on the last value
 * used - which is 0 the first time an exercise is logged. Reaching 80 kg from there is eighty
 * rows of scrolling for a number that was never going to be 79 or 81.
 *
 * So the wheel counts in ones up to 40 and in fives above it. Under 40 is where the fine
 * resolution is real: dumbbells come in 2 kg steps, and 12 vs 14 kg is a decision. Above it
 * the load is a barbell or a stack, both of which move in fives anyway - and the same is true
 * in pounds, where every plate combination on a 45 lb bar lands on a multiple of five. Ninety
 * pounds is where the pound wheel switches, being roughly the forty kilos of the other one.
 *
 * Cost: 93 rows instead of 301, and 205 instead of 661. Anything already logged at 42 kg still
 * reads as 42 kg; only reopening the wheel and pressing Done rounds it.
 */
const WEIGHTS_KG = [...range(0, 40, 1), ...range(45, 300, 5)];
const WEIGHTS_LB = [...range(0, 90, 1), ...range(95, 660, 5)];
const REPS = range(1, 100, 1);
const SECONDS = range(0, 1800, 5);
const METRES = range(0, 20000, 50);

/** Exported for src/__tests__/setFields.test.tsx, which pins the shape of the ladder. */
export const WEIGHT_WHEELS = { kg: WEIGHTS_KG, lb: WEIGHTS_LB } as const;

/** Up to one decimal, so a stored 82.5 kg still reads as 82.5 and 80 does not read as 80.0. */
function trim(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function SetFields({
  kind,
  values,
  unit,
  onChange,
  idPrefix,
}: {
  kind: SetKind;
  values: SetValues;
  unit: 'kg' | 'lb';
  onChange: (patch: SetValues) => void;
  idPrefix?: string;
}) {
  const tid = (field: string) => (idPrefix ? `${idPrefix}-${field}` : undefined);

  switch (kind) {
    case 'weight_reps':
      return (
        <View style={s.row}>
          <WheelField
            testID={tid('weight')}
            title="Weight"
            values={unit === 'lb' ? WEIGHTS_LB : WEIGHTS_KG}
            value={values.weightKg === undefined ? null : toDisplayWeight(values.weightKg, unit)}
            format={trim}
            suffix={unit}
            width={104}
            compact
            placeholder="-"
            onChange={(shown) => onChange({ weightKg: fromDisplayWeight(shown, unit) })}
          />
          <Text style={s.times}>x</Text>
          <WheelField
            testID={tid('reps')}
            title="Reps"
            values={REPS}
            value={values.reps ?? null}
            suffix="reps"
            width={102}
            compact
            placeholder="-"
            onChange={(reps) => onChange({ reps })}
          />
        </View>
      );

    case 'reps':
      return (
        <View style={s.row}>
          <WheelField
            testID={tid('reps')}
            title="Reps"
            values={REPS}
            value={values.reps ?? null}
            suffix="reps"
            width={112}
            compact
            placeholder="-"
            onChange={(reps) => onChange({ reps })}
          />
        </View>
      );

    case 'time':
      return (
        <View style={s.row}>
          <WheelField
            testID={tid('time')}
            title="Time"
            values={SECONDS}
            value={values.timeSec ?? null}
            suffix="sec"
            width={112}
            compact
            placeholder="-"
            onChange={(timeSec) => onChange({ timeSec })}
          />
        </View>
      );

    case 'distance_time':
      return (
        <View style={s.row}>
          <WheelField
            testID={tid('distance')}
            title="Distance"
            values={METRES}
            value={values.distanceM ?? null}
            suffix="m"
            width={106}
            compact
            placeholder="-"
            onChange={(distanceM) => onChange({ distanceM })}
          />
          <WheelField
            testID={tid('time')}
            title="Time"
            values={SECONDS}
            value={values.timeSec ?? null}
            suffix="sec"
            width={106}
            compact
            placeholder="-"
            onChange={(timeSec) => onChange({ timeSec })}
          />
        </View>
      );
  }
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1.5) },
  times: { color: theme.color.textFaint, fontWeight: '700', fontSize: theme.font.small },
});
