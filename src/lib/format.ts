import type { SetKind } from '@/catalog';
import type { SetValues } from '@/store/types';

const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? kg : Math.round((kg / KG_PER_LB) * 10) / 10;
}

export function fromDisplayWeight(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? value : Math.round(value * KG_PER_LB * 100) / 100;
}

/** "1:30" for 90s, "45s" under a minute, "1:02:00" past an hour. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0
    ? `${h}:${mm}:${String(sec).padStart(2, '0')}`
    : `${mm}:${String(sec).padStart(2, '0')}`;
}

/** One-line summary of a set, e.g. "60 kg x 8" or "1000 m in 5:00". */
export function formatSet(values: SetValues, kind: SetKind, unit: 'kg' | 'lb'): string {
  switch (kind) {
    case 'weight_reps': {
      const w = values.weightKg === undefined ? '-' : String(toDisplayWeight(values.weightKg, unit));
      return `${w} ${unit} x ${values.reps ?? '-'}`;
    }
    case 'reps':
      return `${values.reps ?? '-'} reps`;
    case 'time':
      return values.timeSec === undefined ? '-' : formatDuration(values.timeSec);
    case 'distance_time': {
      const d = values.distanceM === undefined ? '-' : `${values.distanceM} m`;
      return values.timeSec === undefined ? d : `${d} in ${formatDuration(values.timeSec)}`;
    }
  }
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * The four functions below read and write a timestamp as the text of a plain field, in the
 * device's own timezone. Local rather than UTC because a workout belongs to the day you did
 * it: an 8pm Monday session in Sydney is Monday, not Tuesday, and a date shown as one and
 * stored as the other is the kind of bug that only appears for some users at some hours.
 *
 * The parsers return null for anything that is not a whole, real date or time, so a field
 * being typed into character by character leaves the stored value alone until it makes sense.
 */

/** "2026-08-02" in local time. */
export function toDateInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "18:30" in local time. 24-hour, so it round-trips with no am/pm to parse. */
export function toTimeInput(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Moves `ts` onto the calendar day written as "yyyy-mm-dd", keeping its time of day.
 *
 * Month and day must be two digits - the shape the field itself displays. Accepting one was
 * worse than it sounds: "2026-07-3", on the way to typing the 30th, is a complete date under a
 * loose rule, so the workout jumped to the 3rd and back again mid-keystroke.
 */
export function withDateInput(ts: number, text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(ts);
  d.setFullYear(year, month - 1, day);
  // setFullYear rolls 31 February forward into March rather than refusing it. Reject instead:
  // silently moving a workout to a day nobody typed is worse than ignoring the edit.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.getTime();
}

/** Moves `ts` to the time of day written as "HH:MM", keeping its date. */
export function withTimeInput(ts: number, text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  const d = new Date(ts);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "just now" / "3h ago" / "2d ago". */
export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
