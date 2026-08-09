import {
  birthYearRange,
  clampDay,
  daysInMonth,
  formatBirthDate,
  isLeapYear,
  parseISODate,
  toISODate,
} from '@/lib/birthDate';

describe('days in a month', () => {
  it('knows the short months', () => {
    for (const m of [4, 6, 9, 11]) expect(daysInMonth(2026, m)).toBe(30);
  });

  it('knows the long ones', () => {
    for (const m of [1, 3, 5, 7, 8, 10, 12]) expect(daysInMonth(2026, m)).toBe(31);
  });

  it('gives February its extra day only in a leap year', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('follows the century rule', () => {
    // Divisible by 100 is not a leap year unless it is also divisible by 400. 1900 was not,
    // 2000 was - and anyone born in 2000 is well within this app's range.
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });
});

describe('reading a stored date', () => {
  it('splits a well-formed one', () => {
    expect(parseISODate('1990-06-14')).toEqual({ year: 1990, month: 6, day: 14 });
  });

  it('refuses anything that is not yyyy-mm-dd', () => {
    // The old text box accepted all of these and kept them verbatim, which is how a birthday
    // silently produced the wrong age.
    for (const bad of ['14/06/1990', '1990-6-14', '90-06-14', 'yesterday', '', '   ']) {
      expect([bad, parseISODate(bad)]).toEqual([bad, null]);
    }
  });

  it('refuses a date that does not exist', () => {
    expect(parseISODate('1990-02-30')).toBeNull();
    expect(parseISODate('1990-13-01')).toBeNull();
    expect(parseISODate('1990-00-10')).toBeNull();
    expect(parseISODate('1990-06-00')).toBeNull();
  });

  it('accepts 29 February in a leap year and rejects it otherwise', () => {
    expect(parseISODate('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseISODate('1999-02-29')).toBeNull();
  });

  it('treats a missing value as unset rather than as an error', () => {
    expect(parseISODate(null)).toBeNull();
  });
});

describe('writing one back', () => {
  it('pads the parts so the string is always the same shape', () => {
    expect(toISODate({ year: 1990, month: 6, day: 4 })).toBe('1990-06-04');
  });

  it('round-trips', () => {
    for (const iso of ['1990-06-14', '2000-02-29', '1975-12-31', '2011-01-01']) {
      expect(toISODate(parseISODate(iso)!)).toBe(iso);
    }
  });
});

describe('showing it to a person', () => {
  it('writes the month out rather than as a number', () => {
    // "1990-06-14" is ambiguous to half the world; "14 June 1990" is not.
    expect(formatBirthDate('1990-06-14')).toBe('14 June 1990');
  });

  it('says so plainly when nothing is set', () => {
    expect(formatBirthDate(null)).toBe('Not set');
    expect(formatBirthDate(null, 'not set')).toBe('not set');
  });

  it('does not try to render a value it cannot parse', () => {
    expect(formatBirthDate('garbage')).toBe('Not set');
  });
});

describe('which years to offer', () => {
  const now = new Date(2026, 0, 1);

  it('starts at thirteen years old, not this year', () => {
    // A list beginning with the current year puts "born this year" under the user's thumb.
    expect(birthYearRange(now)[0]).toBe(2013);
  });

  it('runs back a century', () => {
    const years = birthYearRange(now);
    expect(years[years.length - 1]).toBe(1926);
    expect(years).toHaveLength(88);
  });

  it('lists the likeliest years first', () => {
    const years = birthYearRange(now);
    expect(years[0]).toBeGreaterThan(years[1]);
  });
});

describe('keeping the day valid when the month changes', () => {
  it('pulls 31 back to the end of a shorter month', () => {
    expect(clampDay(2026, 2, 31)).toBe(28);
    expect(clampDay(2026, 4, 31)).toBe(30);
  });

  it('allows 29 February in a leap year and trims it otherwise', () => {
    // The case that actually bites: silent, and only wrong one year in four.
    expect(clampDay(2028, 2, 29)).toBe(29);
    expect(clampDay(2026, 2, 29)).toBe(28);
  });

  it('leaves a day that already fits alone', () => {
    expect(clampDay(2026, 6, 14)).toBe(14);
  });

  it('never returns zero or negative', () => {
    expect(clampDay(2026, 6, 0)).toBe(1);
    expect(clampDay(2026, 6, -5)).toBe(1);
  });
});
