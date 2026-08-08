import {
  ARCHIVE_DIR,
  MANIFEST_PATH,
  PLANS_PATH,
  PROFILE_PATH,
  buildArchive,
  changedFiles,
  checksum,
  readArchive,
  sessionsPath,
  staleFiles,
  type ArchiveFile,
  type ArchiveManifest,
} from '@/store/archive';
import { DEFAULT_BACKUP, DEFAULT_PROFILE, DEFAULT_SETTINGS, SCHEMA_VERSION } from '@/store/migrations';
import type { PersistedState } from '@/store/migrations';
import type { Session } from '@/store/types';
import { volumeInWindow } from '@/analytics/volume';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const NOW = Date.parse('2028-03-15T10:00:00Z');

/** A session on a given date, with `sets` recorded sets. */
function session(id: string, iso: string, sets = 3): Session {
  const at = Date.parse(iso);
  return {
    id,
    planId: 'p1',
    planName: 'Push day',
    startedAt: at,
    endedAt: at + 3_600_000,
    entries: [
      {
        id: `e_${id}`,
        exerciseId: BENCH,
        kind: 'weight_reps',
        restSec: 90,
        sets: Array.from({ length: sets }, (_, i) => ({
          id: `s_${id}_${i}`,
          weightKg: 60,
          reps: 8,
          loggedAt: at + i * 60_000,
        })),
      },
    ],
  };
}

function state(sessions: Session[]): PersistedState {
  return {
    plans: [
      {
        id: 'p1',
        day: 'monday',
        createdAt: NOW,
        updatedAt: NOW,
        items: [
          {
            id: 'pi1',
            exerciseId: BENCH,
            kind: 'weight_reps',
            restSec: 90,
            templates: [{ id: 't1', weightKg: 60, reps: 8 }],
          },
        ],
      },
    ],
    sessions,
    settings: { ...DEFAULT_SETTINGS, unit: 'lb' },
    profile: { ...DEFAULT_PROFILE, displayName: 'Ramin', weightKg: 82 },
    activeSessionId: null,
    celebratedMilestones: ['workouts:10'],
    ignoredBalanceGroups: ['biceps'],
    backup: { ...DEFAULT_BACKUP, lastExportedAt: NOW, lastExportedSets: 9 },
    versionHistory: [{ version: '1.0.0', firstSeenAt: NOW - 1000 }],
  };
}

const asMap = (files: ArchiveFile[]) => new Map(files.map((f) => [f.path, f.text]));
const manifestOf = (files: ArchiveFile[]): ArchiveManifest =>
  JSON.parse(files.find((f) => f.path === MANIFEST_PATH)!.text);

const THREE_YEARS = [
  session('a', '2026-02-01T09:00:00'),
  session('b', '2026-11-20T09:00:00'),
  session('c', '2027-05-05T09:00:00'),
  session('d', '2028-01-10T09:00:00'),
];

describe('the shape of the folder', () => {
  const files = buildArchive(state(THREE_YEARS), '1.2.5', NOW);

  it('splits sessions into one file per calendar year', () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      MANIFEST_PATH,
      PLANS_PATH,
      PROFILE_PATH,
      'sessions/2026.json',
      'sessions/2027.json',
      'sessions/2028.json',
    ]);
  });

  it('puts each session in the year it was trained', () => {
    const y2026 = JSON.parse(asMap(files).get('sessions/2026.json')!) as Session[];
    expect(y2026.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('writes the manifest last, so it describes what precedes it', () => {
    expect(files[files.length - 1].path).toBe(MANIFEST_PATH);
  });

  it('indexes every file, with a checksum each', () => {
    const manifest = manifestOf(files);
    const listed = manifest.files.map((f) => f.path).sort();
    expect(listed).toEqual([PROFILE_PATH, PLANS_PATH, 'sessions/2026.json', 'sessions/2027.json', 'sessions/2028.json'].sort());
    for (const entry of manifest.files) {
      expect(entry.checksum).toMatch(/^[0-9a-f]{8}$/);
      expect(checksum(asMap(files).get(entry.path)!)).toBe(entry.checksum);
    }
  });

  it('records the totals a person would recognise', () => {
    expect(manifestOf(files).totals).toMatchObject({ plans: 1, sessions: 4, loggedSets: 12 });
  });

  it('states the app and schema that wrote it', () => {
    expect(manifestOf(files)).toMatchObject({
      app: 'GRam',
      appVersion: '1.2.5',
      schemaVersion: SCHEMA_VERSION,
    });
  });

  it('names one folder for all of it', () => {
    expect(ARCHIVE_DIR).toBe('GRam');
    expect(sessionsPath(2031)).toBe('sessions/2031.json');
  });
});

describe('a folder round trip', () => {
  it('comes back as the same state', () => {
    const original = state(THREE_YEARS);
    const result = readArchive(asMap(buildArchive(original, '1.2.5', NOW)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.plans).toEqual(original.plans);
    expect(result.state.profile).toEqual(original.profile);
    expect(result.state.settings).toEqual(original.settings);
    expect(result.state.versionHistory).toEqual(original.versionHistory);
    expect(result.state.sessions).toHaveLength(4);
    expect(result.warnings).toEqual([]);
  });

  it('keeps the training history meaning the same thing', () => {
    const original = state(THREE_YEARS);
    const result = readArchive(asMap(buildArchive(original, '1.2.5', NOW)));
    if (!result.ok) throw new Error('expected a read');
    expect(volumeInWindow(result.state.sessions, NOW)).toEqual(
      volumeInWindow(original.sessions, NOW),
    );
  });

  it('survives a user with no training yet', () => {
    const result = readArchive(asMap(buildArchive(state([]), '1.2.5', NOW)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.sessions).toEqual([]);
  });
});

describe('what has to be rewritten when a set is logged', () => {
  /*
   * The whole reason for sharding. A hundred years of history must not make saving slower, so
   * a new session may touch its own year and the manifest, and nothing else.
   */
  const before = buildArchive(state(THREE_YEARS), '1.2.5', NOW);
  const after = buildArchive(
    state([...THREE_YEARS, session('e', '2028-03-15T09:00:00')]),
    '1.2.5',
    NOW + 1000,
  );

  it('touches only the current year and the manifest', () => {
    const changed = changedFiles(after, manifestOf(before)).map((f) => f.path).sort();
    expect(changed).toEqual([MANIFEST_PATH, 'sessions/2028.json']);
  });

  it('leaves finished years alone forever', () => {
    const changed = changedFiles(after, manifestOf(before)).map((f) => f.path);
    expect(changed).not.toContain('sessions/2026.json');
    expect(changed).not.toContain('sessions/2027.json');
  });

  it('does not rewrite anything at all when nothing changed', () => {
    const same = buildArchive(state(THREE_YEARS), '1.2.5', NOW + 5000);
    expect(changedFiles(same, manifestOf(before)).map((f) => f.path)).toEqual([MANIFEST_PATH]);
  });

  it('writes everything when there is no previous manifest', () => {
    expect(changedFiles(after, null)).toHaveLength(after.length);
  });

  it('notices a plan edit without touching any session shard', () => {
    const edited = state(THREE_YEARS);
    edited.plans[0].name = 'Chest day';
    const changed = changedFiles(buildArchive(edited, '1.2.5', NOW), manifestOf(before))
      .map((f) => f.path)
      .sort();
    expect(changed).toEqual([MANIFEST_PATH, PLANS_PATH]);
  });

  it('reports a file the new archive no longer needs', () => {
    const shrunk = buildArchive(state([session('c', '2027-05-05T09:00:00')]), '1.2.5', NOW);
    expect(staleFiles(shrunk, manifestOf(before)).sort()).toEqual([
      'sessions/2026.json',
      'sessions/2028.json',
    ]);
  });

  /*
   * A workout whose date is corrected in the history editor can land in a different year than
   * the one it was filed under. Sharding by year makes that the one edit that touches two
   * shards - and, when it empties the old one, deletes a file. A backup that kept the old shard
   * would hold the workout twice, on two different days.
   */
  describe('a workout retimed into another year', () => {
    const moved = [
      session('a', '2026-02-01T09:00:00'),
      session('b', '2026-11-20T09:00:00'),
      session('c', '2027-05-05T09:00:00'),
      session('d', '2027-12-30T09:00:00'), // was 2028-01-10
    ];
    const after = buildArchive(state(moved), '1.2.5', NOW + 1000);

    it('rewrites the year it went to and drops the year it left', () => {
      expect(changedFiles(after, manifestOf(before)).map((f) => f.path).sort()).toEqual([
        MANIFEST_PATH,
        'sessions/2027.json',
      ]);
      expect(staleFiles(after, manifestOf(before))).toEqual(['sessions/2028.json']);
    });

    it('reads back with the workout counted once, on its new date', () => {
      const read = readArchive(asMap(after));
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.state.sessions).toHaveLength(4);
      expect(read.state.sessions.filter((x) => x.id === 'd')).toHaveLength(1);
      expect(new Date(read.state.sessions.find((x) => x.id === 'd')!.startedAt).getFullYear())
        .toBe(2027);
    });
  });
});

describe('reading a folder that is not in perfect shape', () => {
  const good = buildArchive(state(THREE_YEARS), '1.2.5', NOW);

  it('reads a folder with no manifest at all', () => {
    // The moment someone reads a backup is the moment something already went wrong; refusing
    // to try is the least useful response available.
    const files = asMap(good);
    files.delete(MANIFEST_PATH);
    const result = readArchive(files);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.sessions).toHaveLength(4);
  });

  it('warns but still recovers when a year is missing', () => {
    const files = asMap(good);
    files.delete('sessions/2027.json');
    const result = readArchive(files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.sessions).toHaveLength(3);
    expect(result.warnings.join(' ')).toContain('2027');
  });

  it('warns but keeps the data when a file fails its checksum', () => {
    const files = asMap(good);
    // Matched with a regex rather than a literal so the tamper does not depend on whether the
    // file is indented - it is not any more, and a no-op edit would silently pass this test.
    const original = files.get('sessions/2026.json')!;
    const tampered = original.replace(/"reps":\s*8/, '"reps":9');
    expect(tampered).not.toBe(original);
    files.set('sessions/2026.json', tampered);
    const result = readArchive(files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(' ')).toContain('checksum');
    expect(result.state.sessions).toHaveLength(4);
  });

  it('skips a shard that is not readable rather than losing the rest', () => {
    const files = asMap(good);
    files.set('sessions/2027.json', '{ truncated');
    const result = readArchive(files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.sessions).toHaveLength(3);
    expect(result.warnings.join(' ')).toContain('2027');
  });

  it('refuses a folder that holds no backup, rather than wiping data with nothing', () => {
    const result = readArchive(new Map([['notes.txt', 'shopping list']]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does not hold a GRam backup');
  });

  it('refuses an empty folder', () => {
    const result = readArchive(new Map());
    expect(result.ok).toBe(false);
  });

  it('migrates a folder written at an older schema', () => {
    const files = asMap(good);
    const manifest = manifestOf(good);
    files.set(MANIFEST_PATH, JSON.stringify({ ...manifest, schemaVersion: 1 }));
    const result = readArchive(files);
    expect(result.ok).toBe(true);
    // Fields the old schema never had are filled in rather than left undefined.
    if (result.ok) expect(result.state.backup).toBeDefined();
  });

  it('never throws, whatever the folder contains', () => {
    for (const junk of [
      new Map([[MANIFEST_PATH, 'not json']]),
      new Map([[PROFILE_PATH, 'null']]),
      new Map([[PLANS_PATH, '"a string"']]),
      new Map([['sessions/2026.json', '{}']]),
    ]) {
      expect(() => readArchive(junk)).not.toThrow();
    }
  });
});

describe('checksums', () => {
  it('changes when the content does', () => {
    expect(checksum('a')).not.toBe(checksum('b'));
    expect(checksum('{"reps": 8}')).not.toBe(checksum('{"reps": 9}'));
  });

  it('is stable for the same content', () => {
    expect(checksum('the same text')).toBe(checksum('the same text'));
  });

  it('is eight hex characters, whatever the input', () => {
    for (const text of ['', 'x', JSON.stringify(state(THREE_YEARS))]) {
      expect(checksum(text)).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});

describe('scale', () => {
  it('keeps a century of training in one small file per year', () => {
    // 100 years at 150 sessions a year. The number that matters is not the total - it is how
    // much has to be rewritten to log one more set, which must not grow with the history.
    const many: Session[] = [];
    for (let year = 1990; year < 2090; year++) {
      for (let i = 0; i < 150; i++) {
        many.push(session(`${year}_${i}`, `${year}-06-01T09:00:00`, 3));
      }
    }
    const built = buildArchive(state(many), '1.2.5', NOW);
    const manifest = manifestOf(built);

    expect(manifest.totals.sessions).toBe(15_000);
    expect(manifest.files.filter((f) => f.kind === 'sessions')).toHaveLength(100);

    const withOneMore = buildArchive(
      state([...many, session('extra', '2089-07-01T09:00:00')]),
      '1.2.5',
      NOW + 1,
    );
    const rewritten = changedFiles(withOneMore, manifest);
    expect(rewritten.map((f) => f.path).sort()).toEqual([MANIFEST_PATH, 'sessions/2089.json']);

    // And the bytes rewritten stay in the tens of KB, not the tens of MB.
    const bytes = rewritten.reduce((n, f) => n + f.text.length, 0);
    expect(bytes).toBeLessThan(500_000);
  });
});
