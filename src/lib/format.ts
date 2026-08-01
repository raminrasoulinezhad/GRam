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
