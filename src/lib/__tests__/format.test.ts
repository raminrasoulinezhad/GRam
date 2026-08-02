import {
  formatDuration,
  formatSet,
  formatSets,
  fromDisplayWeight,
  relativeTime,
  titleCase,
  toDateInput,
  toDisplayWeight,
  toTimeInput,
  withDateInput,
  withTimeInput,
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

describe('formatSets', () => {
  it('leaves a whole count alone rather than adding a decimal', () => {
    expect(formatSets(0)).toBe('0');
    expect(formatSets(3)).toBe('3');
  });

  it('keeps the halves an assisting muscle earns', () => {
    expect(formatSets(0.5)).toBe('0.5');
    expect(formatSets(4.5)).toBe('4.5');
  });

  it('snaps floating-point drift to the nearest half', () => {
    // 0.5 x 3 summed one at a time is exact, but a decayed or averaged figure need not be.
    expect(formatSets(1.4999999999)).toBe('1.5');
    expect(formatSets(2.0000000001)).toBe('2');
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

describe('date and time fields', () => {
  /** 14 March 2026, 18:45 local - built from local parts so the test is timezone-agnostic. */
  const at = new Date(2026, 2, 14, 18, 45, 30, 250).getTime();

  it('renders a timestamp as the text of each field', () => {
    expect(toDateInput(at)).toBe('2026-03-14');
    expect(toTimeInput(at)).toBe('18:45');
  });

  it('pads single-digit months, days, hours and minutes', () => {
    const early = new Date(2026, 0, 5, 7, 9).getTime();
    expect(toDateInput(early)).toBe('2026-01-05');
    expect(toTimeInput(early)).toBe('07:09');
  });

  it('round-trips through its own output', () => {
    expect(toDateInput(withDateInput(at, toDateInput(at))!)).toBe('2026-03-14');
    expect(toTimeInput(withTimeInput(at, toTimeInput(at))!)).toBe('18:45');
  });

  it('changes the date and keeps the time of day', () => {
    const moved = withDateInput(at, '2026-12-01')!;
    expect(toDateInput(moved)).toBe('2026-12-01');
    expect(toTimeInput(moved)).toBe('18:45');
    // Seconds ride along, so the ordering of two sets a few seconds apart survives.
    expect(new Date(moved).getSeconds()).toBe(30);
  });

  it('changes the time and keeps the date', () => {
    const moved = withTimeInput(at, '06:05')!;
    expect(toDateInput(moved)).toBe('2026-03-14');
    expect(toTimeInput(moved)).toBe('06:05');
  });

  it.each(['', '2026', '2026-03', '2026-3-1x', 'yesterday', '14/03/2026'])(
    'refuses the incomplete date %p',
    (text) => {
      expect(withDateInput(at, text)).toBeNull();
    },
  );

  it.each(['2026-07-3', '2026-7-30', '2026-7-3'])(
    'refuses %p, which is a real date only because it is half typed',
    (text) => {
      // Typing "2026-07-30" passes through "2026-07-3". Under a one-or-two-digit rule that is
      // a complete date, and the workout hops to the 3rd of the month and back on the next key.
      expect(withDateInput(at, text)).toBeNull();
    },
  );

  it('commits exactly once while a full date is typed out character by character', () => {
    const typed = '2026-07-30';
    const accepted = Array.from(typed, (_, i) => typed.slice(0, i + 1)).filter(
      (prefix) => withDateInput(at, prefix) !== null,
    );
    expect(accepted).toEqual([typed]);
  });

  it('commits exactly once while a full time is typed out character by character', () => {
    const typed = '06:15';
    const accepted = Array.from(typed, (_, i) => typed.slice(0, i + 1)).filter(
      (prefix) => withTimeInput(at, prefix) !== null,
    );
    expect(accepted).toEqual([typed]);
  });

  it('refuses a day that does not exist rather than rolling into the next month', () => {
    // new Date().setFullYear(2026, 1, 31) silently lands on 3 March.
    expect(withDateInput(at, '2026-02-31')).toBeNull();
    expect(withDateInput(at, '2026-13-01')).toBeNull();
    expect(withDateInput(at, '2026-00-10')).toBeNull();
  });

  it('accepts 29 February in a leap year and refuses it otherwise', () => {
    expect(toDateInput(withDateInput(at, '2028-02-29')!)).toBe('2028-02-29');
    expect(withDateInput(at, '2027-02-29')).toBeNull();
  });

  it.each(['', '6', '6:5', '25:00', '12:60', '18h30', 'noon'])(
    'refuses the malformed time %p',
    (text) => {
      expect(withTimeInput(at, text)).toBeNull();
    },
  );

  it('accepts midnight and the last minute of the day', () => {
    expect(toTimeInput(withTimeInput(at, '00:00')!)).toBe('00:00');
    expect(toTimeInput(withTimeInput(at, '23:59')!)).toBe('23:59');
  });
});
