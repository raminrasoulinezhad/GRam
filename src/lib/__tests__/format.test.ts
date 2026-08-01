import {
  formatDuration,
  formatSet,
  fromDisplayWeight,
  relativeTime,
  titleCase,
  toDisplayWeight,
} from '@/lib/format';

describe('weight conversion', () => {
  it('is a no-op in kg', () => {
    expect(toDisplayWeight(60, 'kg')).toBe(60);
    expect(fromDisplayWeight(60, 'kg')).toBe(60);
  });

  it('converts to pounds', () => {
    expect(toDisplayWeight(100, 'lb')).toBeCloseTo(220.5, 1);
  });

  it('round-trips within rounding tolerance', () => {
    for (const kg of [2.5, 20, 60, 102.5, 250]) {
      expect(fromDisplayWeight(toDisplayWeight(kg, 'lb'), 'lb')).toBeCloseTo(kg, 1);
    }
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [59, '59s'],
    [60, '1:00'],
    [90, '1:30'],
    [605, '10:05'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('formats %ss as %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it('clamps negatives rather than printing a minus sign', () => {
    expect(formatDuration(-10)).toBe('0s');
  });
});

describe('formatSet', () => {
  it('renders weight x reps in the active unit', () => {
    expect(formatSet({ weightKg: 60, reps: 8 }, 'weight_reps', 'kg')).toBe('60 kg x 8');
    expect(formatSet({ weightKg: 100, reps: 5 }, 'weight_reps', 'lb')).toBe('220.5 lb x 5');
  });

  it('renders reps-only and time-only sets', () => {
    expect(formatSet({ reps: 12 }, 'reps', 'kg')).toBe('12 reps');
    expect(formatSet({ timeSec: 90 }, 'time', 'kg')).toBe('1:30');
  });

  it('renders distance plus time', () => {
    expect(formatSet({ distanceM: 1000, timeSec: 300 }, 'distance_time', 'kg')).toBe(
      '1000 m in 5:00',
    );
  });

  it('shows a dash for missing numbers instead of undefined', () => {
    expect(formatSet({}, 'weight_reps', 'kg')).toBe('- kg x -');
    expect(formatSet({}, 'reps', 'kg')).toBe('- reps');
    expect(formatSet({}, 'time', 'kg')).toBe('-');
    expect(formatSet({}, 'distance_time', 'kg')).toBe('-');
  });
});

describe('relativeTime', () => {
  const now = 1_800_000_000_000;
  it.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [3 * 3600_000, '3h ago'],
    [2 * 86_400_000, '2d ago'],
    [20 * 86_400_000, '2w ago'],
  ])('formats a %sms gap', (gap, expected) => {
    expect(relativeTime(now - gap, now)).toBe(expected);
  });

  it('does not go negative for a future timestamp', () => {
    expect(relativeTime(now + 60_000, now)).toBe('just now');
  });
});

describe('titleCase', () => {
  it('capitalises the first letter only', () => {
    expect(titleCase('barbell')).toBe('Barbell');
    expect(titleCase('e-z curl bar')).toBe('E-z curl bar');
  });
});
