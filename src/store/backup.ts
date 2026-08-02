import { SCHEMA_VERSION, coerce, migratePersisted, type PersistedState } from './migrations';

/**
 * Getting a user's training history out of the app and back in again.
 *
 * WHY THIS IS NOT OPTIONAL
 * All data lives in one device's storage and nowhere else. On iOS, removing a home-screen web
 * app deletes its storage container with it - and the only way to change the home-screen icon
 * is to remove and re-add. So without an export, a cosmetic change costs a user everything they
 * have logged. That is the situation this exists to end.
 *
 * WHAT A BACKUP IS
 * A JSON file holding the whole persisted blob inside a small envelope that records which app
 * and schema wrote it. The envelope is what lets a file written today import into a build from
 * next year: the payload runs through the same migration chain as on-device data, so an old
 * backup is upgraded on the way in rather than rejected.
 */

/** Version of the envelope itself, not of the data inside it. */
export const BACKUP_FORMAT = 1;

export type BackupFile = {
  format: number;
  app: 'GRam';
  appVersion: string;
  /** Schema version of `state`, so the importer knows which migrations to run. */
  schemaVersion: number;
  exportedAt: string;
  state: PersistedState;
};

export function buildBackup(state: PersistedState, appVersion: string, now: number): BackupFile {
  return {
    format: BACKUP_FORMAT,
    app: 'GRam',
    appVersion,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    state,
  };
}

/** Pretty-printed: a backup is something a person may open, read and even hand-edit. */
export function serialiseBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * The backup filename. Stable, deliberately.
 *
 * It used to carry the date - `gram-backup-2026-08-01.json` - which meant every export created
 * a *new* file and a folder slowly filled with near-identical copies, none of them obviously
 * the current one. A fixed name means the second export lands on the first: "Save to Files"
 * offers to replace it, and the folder holds one file that is always the latest.
 *
 * The date has not been lost - `exportedAt` is inside the file, and the app shows it. Anyone
 * wanting dated copies can duplicate one; that is a choice, where accumulating them was not.
 */
export const BACKUP_FILENAME = 'gram-backup.json';

export function backupFilename(): string {
  return BACKUP_FILENAME;
}

export type BackupSummary = {
  plans: number;
  exercises: number;
  sessions: number;
  loggedSets: number;
  /** Timestamp of the oldest and newest recorded set, or null when nothing is logged. */
  from: number | null;
  to: number | null;
};

/**
 * What is actually in a payload, in the terms a user thinks in.
 *
 * Shown for both sides of an import before anything is overwritten. "12 plans, 340 workouts"
 * against "0 plans, 0 workouts" is the difference between a restore and a catastrophe, and the
 * user is the only one who can tell which they meant.
 */
export function summarise(state: PersistedState): BackupSummary {
  let loggedSets = 0;
  let from: number | null = null;
  let to: number | null = null;

  for (const session of state.sessions) {
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (set.loggedAt === null) continue;
        loggedSets += 1;
        if (from === null || set.loggedAt < from) from = set.loggedAt;
        if (to === null || set.loggedAt > to) to = set.loggedAt;
      }
    }
  }

  return {
    plans: state.plans.length,
    exercises: state.plans.reduce((n, p) => n + p.items.length, 0),
    sessions: state.sessions.filter((s) => s.endedAt !== null).length,
    loggedSets,
    from,
    to,
  };
}

export type ParsedBackup = {
  state: PersistedState;
  summary: BackupSummary;
  /** Schema version the file was written at, before migration. */
  schemaVersion: number;
  appVersion: string | null;
  exportedAt: string | null;
  /** True when the file came from a build newer than this one. */
  fromTheFuture: boolean;
};

export type ParseResult =
  | { ok: true; backup: ParsedBackup }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads a backup file.
 *
 * Deliberately lenient about shape and strict about substance. It accepts three things:
 *
 *   - a GRam backup envelope, the normal case;
 *   - a bare zustand blob, `{ state, version }`, which is what someone gets if they copy the
 *     value straight out of browser storage - a real recovery route when the app will not open;
 *   - a bare persisted state object.
 *
 * What it refuses is anything with no plans array and no sessions array, because that is not a
 * backup, and importing it would replace real data with nothing. Every rejection says what was
 * wrong in a sentence a user can act on.
 */
export function parseBackup(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: 'That file is empty.' };

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      error: 'That is not a backup file - it is not valid JSON. Pick the .json file GRam exported.',
    };
  }

  const root = asRecord(raw);
  if (!root) {
    return { ok: false, error: 'That file does not contain a backup.' };
  }

  // Unwrap whichever of the three shapes this is.
  const envelope = asRecord(root.state) !== null ? root : null;
  const payload = envelope ? asRecord(envelope.state)! : root;

  if (!Array.isArray(payload.plans) && !Array.isArray(payload.sessions)) {
    return {
      ok: false,
      error:
        'That file has no plans or workouts in it. If you exported from GRam, pick the file it ' +
        'created; it is named gram-backup-<date>.json.',
    };
  }

  const declared = envelope
    ? (envelope.schemaVersion ?? envelope.version)
    : undefined;
  const schemaVersion = typeof declared === 'number' ? declared : SCHEMA_VERSION;

  // Same chain the app runs on its own stored data, so an old file lands in the current shape.
  const state = migratePersisted(payload, schemaVersion);

  return {
    ok: true,
    backup: {
      state,
      summary: summarise(state),
      schemaVersion,
      appVersion: typeof envelope?.appVersion === 'string' ? envelope.appVersion : null,
      exportedAt: typeof envelope?.exportedAt === 'string' ? envelope.exportedAt : null,
      fromTheFuture: schemaVersion > SCHEMA_VERSION,
    },
  };
}

/**
 * A payload ready to become live state.
 *
 * `coerce` runs again on the way in. The file may have been hand-edited, truncated by a failed
 * transfer, or written by a build that is not this one, and none of that should be able to put
 * the app into a state a screen crashes on.
 */
export function toLiveState(state: PersistedState): PersistedState {
  const safe = coerce(state as unknown as Record<string, unknown>);
  // A session id pointing at a session that is not in the file would leave the app showing a
  // workout in progress that cannot be opened.
  const exists = safe.sessions.some((s) => s.id === safe.activeSessionId);
  return { ...safe, activeSessionId: exists ? safe.activeSessionId : null };
}

// ------------------------------------------------------------------ staleness

/**
 * How exposed the user is right now.
 *
 * Measured in sets logged since the last backup rather than in days, because days do not
 * describe the loss. Someone who has not trained in a fortnight has nothing at risk; someone who
 * logged forty sets this week has a week to lose. `urgent` is the threshold at which the app
 * stops mentioning it and starts saying it.
 */
export type Staleness = {
  /** No backup has ever been taken and there is something to lose. */
  never: boolean;
  setsSince: number;
  daysSince: number | null;
  /** Worth mentioning at all. */
  due: boolean;
  urgent: boolean;
};

/** A session's worth of work. Below this, nagging costs more attention than it saves. */
const DUE_SETS = 12;
const URGENT_SETS = 40;
const URGENT_DAYS = 45;

export function staleness(
  current: BackupSummary,
  record: { lastExportedAt: number | null; lastExportedSets: number },
  now: number,
): Staleness {
  const setsSince = Math.max(0, current.loggedSets - record.lastExportedSets);
  const daysSince =
    record.lastExportedAt === null
      ? null
      : Math.floor((now - record.lastExportedAt) / 86_400_000);

  const never = record.lastExportedAt === null && current.loggedSets > 0;
  const urgent =
    (never && current.loggedSets >= DUE_SETS) ||
    setsSince >= URGENT_SETS ||
    (setsSince > 0 && daysSince !== null && daysSince >= URGENT_DAYS);

  // Urgent implies due. Otherwise a small amount of training left unsaved for two months would
  // set the alarm colour and then render no message at all, because the UI shows the banner
  // only when there is something to put in it.
  const due = urgent || never || setsSince >= DUE_SETS;

  return { never, setsSince, daysSince, due, urgent };
}

/** One line for the reminder, or null when there is nothing worth saying. */
export function stalenessMessage(s: Staleness): string | null {
  if (!s.due) return null;
  if (s.never) return 'You have never backed this up. One tap and it is safe.';
  const sets = `${s.setsSince} set${s.setsSince === 1 ? '' : 's'}`;
  if (s.daysSince !== null && s.daysSince >= URGENT_DAYS) {
    return `${sets} logged since your last backup, ${s.daysSince} days ago.`;
  }
  return `${sets} logged since your last backup.`;
}
