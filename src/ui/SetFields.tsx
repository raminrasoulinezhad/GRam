import { StyleSheet, Text, View } from 'react-native';
import type { SetKind } from '@/catalog';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/format';
import type { SetValues } from '@/store/types';
import { NumberField } from './components';
import { theme } from './theme';

/**
 * The editable numbers for one set, laid out according to its kind.
 * Weight is stored in kg always; only the display converts, so switching units never
 * rewrites history.
 */
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
          <NumberField
            testID={tid('weight')}
            value={values.weightKg === undefined ? undefined : toDisplayWeight(values.weightKg, unit)}
            suffix={unit}
            width={104}
            step={2.5}
            onChange={(n) =>
              onChange({ weightKg: n === undefined ? undefined : fromDisplayWeight(n, unit) })
            }
          />
          <Text style={s.times}>x</Text>
          <NumberField
            testID={tid('reps')}
            value={values.reps}
            suffix="reps"
            width={92}
            step={1}
            onChange={(n) => onChange({ reps: n })}
          />
        </View>
      );

    case 'reps':
      return (
        <View style={s.row}>
          <NumberField
            testID={tid('reps')}
            value={values.reps}
            suffix="reps"
            width={104}
            step={1}
            onChange={(n) => onChange({ reps: n })}
          />
        </View>
      );

    case 'time':
      return (
        <View style={s.row}>
          <NumberField
            testID={tid('time')}
            value={values.timeSec}
            suffix="sec"
            width={104}
            step={5}
            onChange={(n) => onChange({ timeSec: n })}
          />
        </View>
      );

    case 'distance_time':
      return (
        <View style={s.row}>
          <NumberField
            testID={tid('distance')}
            value={values.distanceM}
            suffix="m"
            width={100}
            step={100}
            onChange={(n) => onChange({ distanceM: n })}
          />
          <NumberField
            testID={tid('time')}
            value={values.timeSec}
            suffix="sec"
            width={100}
            step={10}
            onChange={(n) => onChange({ timeSec: n })}
          />
        </View>
      );
  }
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1.5) },
  times: { color: theme.color.textFaint, fontWeight: '700', fontSize: theme.font.small },
});
