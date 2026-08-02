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

/** `gram-backup-2026-08-01.json` - sorts chronologically and says what it is. */
export function backupFilename(now: number): string {
  return `gram-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
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
