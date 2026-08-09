/**
 * The arithmetic behind picking a date of birth, kept apart from the widget that does it.
 *
 * WHY NOT A CALENDAR
 * A month grid is the right control for "when is my next appointment" and the wrong one for
 * "when were you born". A birthday is twenty to eighty years back, and reaching 1990 from a
 * calendar means paging through four hundred months. Every platform that has thought about it
 * lands on the same answer - iOS shows a wheel, Android's date picker opens on a year list -
 * which is to choose the year first and narrow from there.
 *
 * So: year, then month, then day. Three taps, each from a short list, no typing and no format
 * to get wrong.
 */

export type DateParts = { year: number; month: number; day: number };

/** Days in a month, 1-indexed, leap years handled. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_NAMES: readonly string[] = MONTHS;
export const MONTH_SHORT: readonly string[] = MONTHS.map((m) => m.slice(0, 3));

/**
 * Splits a stored `yyyy-mm-dd`, or null if it is not one.
 *
 * Deliberately strict, and deliberately not `new Date()`. A bare yyyy-mm-dd is parsed as UTC
 * midnight, so anyone west of UTC reading it back with local getters sees the previous day -
 * which for a birthday means being wished a happy one on the wrong date.
 */
export function parseISODate(value: string | null): DateParts | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function toISODate({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "14 June 1990", or a fallback when nothing is set. */
export function formatBirthDate(value: string | null, fallback = 'Not set'): string {
  const parts = parseISODate(value);
  if (!parts) return fallback;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

/**
 * The years worth offering, newest first.
 *
 * Capped at 13 years old rather than at today: this is a weightlifting app, the field feeds an
 * age used for calorie estimates, and a list starting at the current year would put "born this
 * year" under the user's thumb as the first option. The far end is 100 years, which is past any
 * plausible user and costs nothing but scroll.
 */
export function birthYearRange(now: Date = new Date()): number[] {
  const thisYear = now.getFullYear();
  const newest = thisYear - 13;
  const oldest = thisYear - 100;
  const out: number[] = [];
  for (let y = newest; y >= oldest; y--) out.push(y);
  return out;
}

/**
 * Keeps a day valid when the year or month around it changes.
 *
 * Picking 31 January and then switching to February would otherwise leave an impossible date.
 * The same applies to 29 February when the year moves off a leap year, which is the case that
 * actually bites - it is silent, and only wrong one year in four.
 */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(year, month));
}
