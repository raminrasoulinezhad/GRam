import { ageFrom, bmi, isBirthday } from '@/lib/device';

/*
 * There was a preferredUnit() here, mapping the phone's reported measurement system onto kg or
 * lb. The unit is now a fixed lb default the user changes if they want to, so the device no
 * longer has a say - see DEFAULT_SETTINGS in src/store/migrations.ts.
 */

describe('ageFrom', () => {
  const now = new Date('2026-08-01T12:00:00Z');

  it('returns null when no birth date is set', () => {
    expect(ageFrom(null, now)).toBeNull();
  });

  it('returns null for an unparseable date rather than NaN', () => {
    expect(ageFrom('not-a-date', now)).toBeNull();
    expect(ageFrom('', now)).toBeNull();
  });

  it('counts whole years', () => {
    expect(ageFrom('1990-01-01', now)).toBe(36);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageFrom('1990-12-25', now)).toBe(35);
  });

  it('counts the birthday on the day itself', () => {
    expect(ageFrom('1990-08-01', now)).toBe(36);
  });

  it('does not count the day before the birthday', () => {
    expect(ageFrom('1990-08-02', now)).toBe(35);
  });

  it('rejects a future birth date instead of reporting a negative age', () => {
    expect(ageFrom('2030-01-01', now)).toBeNull();
  });

  it('rejects an implausibly distant date', () => {
    expect(ageFrom('1800-01-01', now)).toBeNull();
  });
});

describe('bmi', () => {
  it('computes to one decimal place', () => {
    // 80kg at 1.80m -> 24.69 -> 24.7
    expect(bmi(180, 80)).toBe(24.7);
  });

  it('returns null unless both measurements are present', () => {
    expect(bmi(null, 80)).toBeNull();
    expect(bmi(180, null)).toBeNull();
    expect(bmi(null, null)).toBeNull();
  });

  it('rejects a height outside human range rather than returning nonsense', () => {
    expect(bmi(3, 80)).toBeNull();
    expect(bmi(300, 80)).toBeNull();
  });

  it('treats zero as missing', () => {
    expect(bmi(0, 80)).toBeNull();
    expect(bmi(180, 0)).toBeNull();
  });
});

describe('ageFrom is timezone-safe', () => {
  // A bare yyyy-mm-dd fed to new Date() is UTC midnight; compared against local getters it
  // reads a day earlier anywhere west of UTC, ticking birthdays over early. These cases pin
  // that down regardless of the machine's zone.
  it('treats the birth date as a calendar date, not an instant', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(ageFrom('1990-08-01', now)).toBe(36); // birthday today
    expect(ageFrom('1990-08-02', now)).toBe(35); // birthday tomorrow
    expect(ageFrom('1990-07-31', now)).toBe(36); // birthday yesterday
  });

  it('rejects a malformed or partial date', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(ageFrom('1990-8-1', now)).toBeNull();
    expect(ageFrom('1990-08', now)).toBeNull();
    expect(ageFrom('90-08-01', now)).toBeNull();
    expect(ageFrom('1990-13-01', now)).toBeNull();
    expect(ageFrom('1990-08-45', now)).toBeNull();
  });

  it('tolerates surrounding whitespace', () => {
    expect(ageFrom('  1990-01-01  ', new Date('2026-08-01T12:00:00Z'))).toBe(36);
  });
});

describe('isBirthday', () => {
  const on = (iso: string) => new Date(`${iso}T09:30:00`);

  it('is true on the month and day, whatever the year', () => {
    expect(isBirthday('1990-06-14', on('2026-06-14'))).toBe(true);
    expect(isBirthday('1990-06-14', on('2031-06-14'))).toBe(true);
  });

  it('is false on any other day', () => {
    expect(isBirthday('1990-06-14', on('2026-06-13'))).toBe(false);
    expect(isBirthday('1990-06-14', on('2026-06-15'))).toBe(false);
    expect(isBirthday('1990-06-14', on('2026-07-14'))).toBe(false);
  });

  it('says nothing when no date has been given', () => {
    expect(isBirthday(null, on('2026-06-14'))).toBe(false);
    expect(isBirthday('', on('2026-06-14'))).toBe(false);
  });

  it('refuses anything that is not a plain calendar date', () => {
    expect(isBirthday('14/06/1990', on('2026-06-14'))).toBe(false);
    expect(isBirthday('1990-13-01', on('2026-01-01'))).toBe(false);
    expect(isBirthday('not a date', on('2026-06-14'))).toBe(false);
  });

  it('greets a leap-day birthday on 1 March in a common year', () => {
    // Once every four years would be the literal reading and the unkind one.
    expect(isBirthday('2000-02-29', on('2027-03-01'))).toBe(true);
    expect(isBirthday('2000-02-29', on('2027-02-28'))).toBe(false);
  });

  it('greets a leap-day birthday on the day itself in a leap year', () => {
    expect(isBirthday('2000-02-29', on('2028-02-29'))).toBe(true);
    // And not again the next day, which would be two greetings in one year.
    expect(isBirthday('2000-02-29', on('2028-03-01'))).toBe(false);
  });

  it('knows 1900 was not a leap year and 2000 was', () => {
    expect(isBirthday('1888-02-29', on('1900-03-01'))).toBe(true);
    expect(isBirthday('1888-02-29', on('2000-03-01'))).toBe(false);
  });

  it('reads the date in local time, not UTC', () => {
    // A bare yyyy-mm-dd through new Date() is UTC midnight, which lands on the previous day for
    // anyone west of UTC - the one day of the year it is conspicuous to get wrong.
    const lateEvening = new Date('2026-06-14T23:45:00');
    expect(isBirthday('1990-06-14', lateEvening)).toBe(true);
  });
});
