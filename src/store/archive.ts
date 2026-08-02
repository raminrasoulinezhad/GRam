import { SCHEMA_VERSION, coerce, migratePersisted, type PersistedState } from './migrations';
import { summarise, type BackupSummary } from './backup';
import type { Session } from './types';

/**
 * A backup spread across a folder instead of squeezed into one file.
 *
 * WHY NOT ONE FILE
 * One file is fine now and stops being fine later. A committed lifter logs a few hundred
 * sessions a year; over decades that is tens of megabytes rewritten in full every time a single
 * set is recorded. The cost of saving would grow with the length of your training history, which
 * is precisely backwards - the longer you have used the app, the more it would charge you to
 * keep it safe.
 *
 * THE SHAPE
 *
 *   GRam/
 *     manifest.json        what is here, how much of it, and a checksum each
 *     profile.json         profile, settings, version log, backup record
 *     plans.json           every plan - small, and rewritten whole
 *     sessions/
 *       2026.json          workouts, one file per calendar year
 *       2027.json
 *
 * Sessions are sharded by year because a year is the natural unit that stops changing. Training
 * logged in 2026 is never edited in 2028, so 2026.json is written once and then never touched
 * again. Only the current year's file is rewritten on a save, which makes the cost of saving
 * constant no matter how long the history is. A hundred years is a hundred small files.
 *
 * THE MANIFEST IS THE INDEX
 * It lists every file with a checksum, so a reader knows what to open without scanning the
 * folder, a writer knows which files are unchanged and can be skipped, and a half-finished
 * write is detectable rather than silently believed.
 */

export const ARCHIVE_FORMAT = 1;

/** The folder everything lives in, created inside whatever directory the user picks. */
export const ARCHIVE_DIR = 'GRam';

export const MANIFEST_PATH = 'manifest.json';
export const PROFILE_PATH = 'profile.json';
export const PLANS_PATH = 'plans.json';

/** Year a session belongs to. Uses local time: a workout belongs to the day you did it. */
export function sessionYear(session: Session): number {
  return new Date(session.startedAt).getFullYear();
}

export function sessionsPath(year: number): string {
  return `sessions/${year}.json`;
}

export type ArchiveEntry = {
  path: string;
  kind: 'profile' | 'plans' | 'sessions';
  /** Sessions or plans held in this file. */
  count: number;
  /** Calendar year, for a sessions shard. */
  year?: number;
  bytes: number;
  checksum: string;
};

export type ArchiveManifest = {
  format: number;
  app: 'GRam';
  appVersion: string;
  schemaVersion: number;
  updatedAt: string;
  totals: BackupSummary;
  files: ArchiveEntry[];
};

export type ArchiveFile = { path: string; text: string };

/**
 * A short non-cryptographic hash. FNV-1a, 32-bit, hex.
 *
 * The job is detecting a truncated or corrupted file, not resisting an attacker - nobody is
 * forging a backup of their own squat sets. It has to be fast enough to run over every file on
 * every save, and it has to be implementable in eight lines so it never becomes a dependency.
 */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function file(path: string, kind: ArchiveEntry['kind'], value: unknown, count: number, year?: number) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const entry: ArchiveEntry = {
    path,
    kind,
    count,
    bytes: text.length,
    checksum: checksum(text),
    ...(year === undefined ? {} : { year }),
  };
  return { text, entry };
}

/**
 * The whole state as a set of files, manifest last so it describes what precedes it.
 *
 * Returns every file rather than only the changed ones; deciding what to skip needs the
 * previous manifest and belongs to the writer, which is the only thing that knows what is
 * already on disk. See `changedFiles`.
 */
export function buildArchive(
  state: PersistedState,
  appVersion: string,
  now: number,
): ArchiveFile[] {
  const byYear = new Map<number, Session[]>();
  for (const session of state.sessions) {
    const year = sessionYear(session);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(session);
    else byYear.set(year, [session]);
  }

  const out: ArchiveFile[] = [];
  const entries: ArchiveEntry[] = [];

  const profile = file(
    PROFILE_PATH,
    'profile',
    {
      profile: state.profile,
      settings: state.settings,
      activeSessionId: state.activeSessionId,
      celebratedMilestones: state.celebratedMilestones,
      ignoredBalanceGroups: state.ignoredBalanceGroups,
      backup: state.backup,
      versionHistory: state.versionHistory,
    },
    1,
  );
  out.push({ path: PROFILE_PATH, text: profile.text });
  entries.push(profile.entry);

  const plans = file(PLANS_PATH, 'plans', state.plans, state.plans.length);
  out.push({ path: PLANS_PATH, text: plans.text });
  entries.push(plans.entry);

  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const sessions = byYear.get(year)!;
    const shard = file(sessionsPath(year), 'sessions', sessions, sessions.length, year);
    out.push({ path: shard.entry.path, text: shard.text });
    entries.push(shard.entry);
  }

  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    app: 'GRam',
    appVersion,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date(now).toISOString(),
    totals: summarise(state),
    files: entries,
  };
  out.push({ path: MANIFEST_PATH, text: `${JSON.stringify(manifest, null, 2)}\n` });

  return out;
}

/**
 * Which files actually need writing, given what the previous manifest said is on disk.
 *
 * This is where the sharding pays off: a set logged today changes this year's shard and the
 * manifest, and leaves every earlier year alone. The manifest is always rewritten - it carries
 * the timestamp and the totals - but it is a few hundred bytes.
 */
export function changedFiles(next: ArchiveFile[], previous: ArchiveManifest | null): ArchiveFile[] {
  if (!previous) return next;
  const known = new Map(previous.files.map((f) => [f.path, f.checksum]));
  return next.filter((f) => f.path === MANIFEST_PATH || known.get(f.path) !== checksum(f.text));
}

/** Files in `previous` that the new archive no longer has - deleted plans years, say. */
export function staleFiles(next: ArchiveFile[], previous: ArchiveManifest | null): string[] {
  if (!previous) return [];
  const keep = new Set(next.map((f) => f.path));
  return previous.files.map((f) => f.path).filter((p) => !keep.has(p));
}

export type ArchiveReadResult =
  | { ok: true; state: PersistedState; summary: BackupSummary; warnings: string[]; manifest: ArchiveManifest | null }
  | { ok: false; error: string };

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Reassembles a folder into state.
 *
 * Tolerant on purpose. A manifest is used when present, but a folder without one is still read
 * by looking for the files that should be there - because the situation in which someone reads
 * a backup is, by definition, one where something has already gone wrong, and refusing to try
 * is the least useful thing to do. Checksum mismatches are warnings, not refusals: a file that
 * fails its checksum is still far more of someone's training history than nothing is.
 */
export function readArchive(files: ReadonlyMap<string, string>): ArchiveReadResult {
  const warnings: string[] = [];

  const manifestText = files.get(MANIFEST_PATH);
  const manifest = manifestText ? (parse(manifestText) as ArchiveManifest | undefined) : undefined;
  if (manifestText && !manifest) warnings.push('The manifest could not be read; the folder was scanned instead.');

  const paths = manifest?.files?.map((f) => f.path) ?? [...files.keys()];

  for (const entry of manifest?.files ?? []) {
    const text = files.get(entry.path);
    if (text === undefined) {
      warnings.push(`${entry.path} is listed in the manifest but missing from the folder.`);
    } else if (checksum(text) !== entry.checksum) {
      warnings.push(`${entry.path} does not match its checksum; it may be incomplete.`);
    }
  }

  const profileRaw = files.get(PROFILE_PATH);
  const plansRaw = files.get(PLANS_PATH);
  const sessionPaths = paths.filter((p) => p.startsWith('sessions/'));

  if (profileRaw === undefined && plansRaw === undefined && sessionPaths.length === 0) {
    return {
      ok: false,
      error:
        'That folder does not hold a GRam backup. Pick the folder containing manifest.json, ' +
        'or the one you exported into.',
    };
  }

  const profile = (parse(profileRaw ?? '{}') as Record<string, unknown>) ?? {};
  const plans = parse(plansRaw ?? '[]');

  const sessions: unknown[] = [];
  for (const path of sessionPaths.sort()) {
    const text = files.get(path);
    if (text === undefined) continue;
    const shard = parse(text);
    if (Array.isArray(shard)) sessions.push(...shard);
    else warnings.push(`${path} could not be read and was skipped.`);
  }

  const assembled = { ...profile, plans, sessions };
  const declared = typeof manifest?.schemaVersion === 'number' ? manifest.schemaVersion : SCHEMA_VERSION;
  const state = coerce(
    migratePersisted(assembled, declared) as unknown as Record<string, unknown>,
  );

  return { ok: true, state, summary: summarise(state), warnings, manifest: manifest ?? null };
}
