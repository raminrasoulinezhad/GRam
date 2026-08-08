/**
 * Small calculations about the person using the app.
 *
 * This file used to also read what the phone could tell us about itself - model, OS string,
 * locale, region, time zone - for a card on the Profile page. Nothing ever acted on any of it,
 * the card is gone, and reading a device's identity for no reason is not a thing to leave
 * lying around in an app whose selling point is that the data stays put.
 */

/**
 * Whole years since `birthDate` (an ISO yyyy-mm-dd string), or null if unset or unparseable.
 *
 * The string is split into calendar components rather than fed to `new Date()`. A bare
 * yyyy-mm-dd is parsed as UTC midnight, and comparing that against local-time getters shifts
 * the date by a day for anyone west of UTC - a birthday would tick over a day early. A date
 * of birth is a calendar date, not an instant, so it is compared as one.
 */
export function ageFrom(birthDate: string | null, now = new Date()): number | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let age = now.getFullYear() - year;
  const monthDelta = now.getMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < day)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Body mass index, or null unless both measurements are present and sane. */
export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm < 50 || heightCm > 260) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/**
 * True when `birthDate` falls on today's month and day.
 *
 * Compared as calendar components for the same reason `ageFrom` does it: a bare yyyy-mm-dd
 * parsed by `new Date()` is UTC midnight, so anyone west of UTC would be wished a happy
 * birthday on the wrong day - which is the one day of the year it is conspicuous to get wrong.
 *
 * The 29th of February is treated as the 1st of March in common years. Someone born on a leap
 * day gets a greeting every year rather than one in four; skipping it would be the more
 * literal reading and the worse one.
 */
export function isBirthday(birthDate: string | null, now = new Date()): boolean {
  if (!birthDate) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return false;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();
  if (month === nowMonth && day === nowDay) return true;

  const leapDay = month === 2 && day === 29;
  const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return leapDay && !isLeapYear(now.getFullYear()) && nowMonth === 3 && nowDay === 1;
}
