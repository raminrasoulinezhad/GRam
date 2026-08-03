import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import {
  BACKUP_FILENAME,
  backupFilename,
  buildBackup,
  parseBackup,
  serialiseBackup,
  staleness,
  stalenessMessage,
  summarise,
  toLiveState,
  type BackupSummary,
  type ParsedBackup,
} from '@/store/backup';
import { requestPersistentStorage } from '@/lib/persistence';
import {
  ARCHIVE_DIR,
  buildArchive,
  changedFiles,
  readArchive,
  staleFiles,
  type ArchiveManifest,
} from '@/store/archive';
import {
  archiveDirectoryName,
  chooseArchiveDirectory,
  forgetArchiveDirectory,
  isDirectoryBackupSupported,
  pickAndReadArchive,
  readArchiveDirectory,
  writeArchive,
} from '@/lib/directory';
import { useStore } from '@/store/useStore';
import { formatDate } from '@/lib/format';
import { canPickFile, copyText, exportText, pickTextFile } from '@/lib/transfer';
import { Body, Button, Card, Dim, H2 } from './components';
import { useConfirm } from './confirm';
import { theme } from './theme';

/**
 * Export and import of everything the app holds.
 *
 * This exists because of one specific trap. All data lives on this device and nowhere else, and
 * on iOS deleting a home-screen web app deletes its storage with it. Changing the app's icon
 * requires deleting and re-adding it. So until now, a new icon cost the user their entire
 * training history, and there was nothing they could do about it. Now there is.
 *
 * Ordinary updates need none of this - the app updates itself and the data is untouched. This is
 * for moving an install, or keeping a copy somewhere that is not one phone.
 */
export function BackupCard() {
  const exportState = useStore((s) => s.exportState);
  const replaceAll = useStore((s) => s.replaceAll);
  const recordExport = useStore((s) => s.recordExport);
  const setAutoExport = useStore((s) => s.setAutoExport);
  const backupRecord = useStore((s) => s.backup);
  const confirm = useConfirm();

  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const autoSupported = isDirectoryBackupSupported();

  // The filename is only known asynchronously, and only matters where auto-export can run.
  useEffect(() => {
    if (!autoSupported) return;
    let live = true;
    void archiveDirectoryName().then((name) => {
      if (live) setTarget(name);
    });
    return () => {
      live = false;
    };
  }, [autoSupported, backupRecord.autoExport]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // Subscribed to the data itself, not read once at render: after an import the counts on this
  // card are the user's confirmation that it worked.
  const plans = useStore((s) => s.plans);
  const sessions = useStore((s) => s.sessions);
  const current = useMemo(
    () => summarise({ ...exportState(), plans, sessions }),
    [exportState, plans, sessions],
  );

  /*
   * Plans count as something to lose even with nothing logged against them yet. An import
   * replaces them too, and a week of planning is real work.
   */
  const hasData = current.plans > 0 || current.loggedSets > 0;

  const stale = useMemo(
    () => staleness(current, backupRecord, Date.now()),
    [current, backupRecord],
  );
  const reminder = stalenessMessage(stale);

  /**
   * Export, which after the first time goes back to the same place on its own.
   *
   * Three behaviours, in descending order of how good they are, picked by what the platform
   * offers rather than by a setting:
   *
   *   1. A destination is already remembered - write straight to it, no dialog at all. This is
   *      what "the same address as the first export" means in practice.
   *   2. The browser can remember one (Chrome, Edge) but none is chosen yet - ask once, then
   *      case 1 applies forever after.
   *   3. It cannot (Safari, and so every iPhone) - hand the file to the share sheet. The
   *      filename is fixed, so saving it to the same folder replaces the previous copy rather
   *      than piling up beside it. One tap, same address, just not automatic.
   */
  /**
   * Writes the backup folder, creating it the first time.
   *
   * Only the files that actually differ are written - see changedFiles - so logging a set
   * rewrites this year's shard and the manifest and touches nothing else, however many years
   * are in there.
   */
  async function exportToFolder(now: number): Promise<string | null> {
    const existing = await readArchiveDirectory();
    const previous = existing
      ? ((JSON.parse(existing.get('manifest.json') ?? 'null') as ArchiveManifest | null) ?? null)
      : null;

    const files = buildArchive(exportState(), appVersion, now);
    const result = await writeArchive(changedFiles(files, previous), staleFiles(files, previous));
    if (!result.ok) return null;
    return `${result.written} file${result.written === 1 ? '' : 's'}`;
  }

  /**
   * Export, which after the first time goes back to the same place on its own.
   *
   * Where the browser can hold a folder permission, the first export asks where to put the
   * GRam folder and every one after writes into it with no dialog. Where it cannot - Safari,
   * and so every iPhone - it hands one file to the share sheet, under a fixed name, so saving
   * into the same folder replaces the previous copy instead of piling up beside it.
   */
  async function handleExport() {
    setError(null);
    const now = Date.now();
    const filename = backupFilename();

    recordExport(now, current.loggedSets);
    void requestPersistentStorage();

    if (autoSupported) {
      const folder = await archiveDirectoryName();
      if (folder !== null) {
        const written = await exportToFolder(now);
        if (written !== null) {
          setNote(`Saved to ${folder} — ${written} updated.`);
          return;
        }
        await forgetArchiveDirectory();
        setTarget(null);
      }

      const chosen = await chooseArchiveDirectory();
      if (chosen.ok) {
        setTarget(chosen.name);
        const written = await exportToFolder(now);
        setNote(
          written !== null
            ? `Created ${chosen.name}. Every export from now on goes into this same folder.`
            : 'That folder could not be written to.',
        );
        return;
      }
      if (chosen.reason === 'cancelled') {
        setNote('Nothing saved.');
        return;
      }
      if (chosen.reason === 'denied') {
        setError('GRam was not given permission to write to that folder.');
        return;
      }
    }

    const text = serialiseBackup(buildBackup(exportState(), appVersion, now));
    const outcome = await exportText(text, filename);
    setNote(
      outcome === 'shared'
        ? `Sent to the share sheet. "Save to Files" into the same folder each time and ${filename} is replaced rather than duplicated.`
        : outcome === 'downloaded'
          ? `Saved as ${filename}.`
          : outcome === 'copied'
            ? 'Copied to the clipboard — paste it somewhere safe.'
            : 'Could not save automatically. Try again, or use a different folder.',
    );
  }

  /** Shared tail of both import routes: confirm against what is already here, then replace. */
  async function applyImport(text: string) {
    setError(null);
    const result = parseBackup(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const { backup } = result;

    const ok = await confirm({
      title: hasData ? 'Replace everything on this device?' : 'Restore this backup?',
      message: describeImport(current, backup),
      confirmLabel: 'Import',
      destructive: hasData,
    });
    if (!ok) return;

    replaceAll(toLiveState(backup.state));
    setNote(
      `Imported ${backup.summary.plans} plan${backup.summary.plans === 1 ? '' : 's'} and ` +
        `${backup.summary.sessions} workout${backup.summary.sessions === 1 ? '' : 's'}.`,
    );
  }

  async function handleArmAutoExport() {
    setError(null);
    const folder = (await archiveDirectoryName()) ?? null;
    if (folder === null) {
      const chosen = await chooseArchiveDirectory();
      if (!chosen.ok) {
        if (chosen.reason === 'error') setError('That folder could not be opened for writing.');
        return;
      }
      setTarget(chosen.name);
    }

    setAutoExport(true);
    void requestPersistentStorage();

    const now = Date.now();
    recordExport(now, current.loggedSets);
    const written = await exportToFolder(now);
    if (written !== null) {
      setNote(`Hands-free backups on. ${ARCHIVE_DIR} now updates itself whenever you train.`);
    } else {
      setAutoExport(false);
      setError('GRam could not write to that folder, so hands-free backups are off.');
    }
  }

  async function handleDisarmAutoExport() {
    setAutoExport(false);
    await forgetArchiveDirectory();
    setTarget(null);
    setNote('Hands-free backups off. Your folder is left as it was.');
  }

  async function handleImport() {
    setError(null);
    try {
      if (autoSupported) {
        const folder = await pickAndReadArchive();
        if (folder !== null) return await applyFolderImport(folder);
        // Cancelled, or not a folder we could read - fall through to the file picker so a
        // single exported .json is still importable on the same machine.
      }
      const text = await pickTextFile();
      if (text !== null) await applyImport(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That backup could not be read.');
    }
  }

  /** Same confirmation as a file import; the difference is only where the state came from. */
  async function applyFolderImport(files: ReadonlyMap<string, string>) {
    const result = readArchive(files);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const ok = await confirm({
      title: hasData ? 'Replace everything on this device?' : 'Restore this backup?',
      message: describeImport(current, {
        state: result.state,
        summary: result.summary,
        schemaVersion: result.manifest?.schemaVersion ?? 0,
        appVersion: result.manifest?.appVersion ?? null,
        exportedAt: result.manifest?.updatedAt ?? null,
        fromTheFuture: false,
      }),
      confirmLabel: 'Import',
      destructive: hasData,
    });
    if (!ok) return;

    replaceAll(toLiveState(result.state));
    setNote(
      result.warnings.length > 0
        ? `Imported, with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}: ${result.warnings[0]}`
        : `Imported ${result.summary.plans} plan${result.summary.plans === 1 ? '' : 's'} and ${result.summary.sessions} workout${result.summary.sessions === 1 ? '' : 's'}.`,
    );
  }

  return (
    <>
      <Card testID="backup-card">
        <H2>Backup and transfer</H2>
        <Dim style={{ marginTop: theme.space(1) }}>
          Your training lives on this device only. A backup is one file — {BACKUP_FILENAME} —
          holding every plan, workout and setting. Export goes back to wherever you put it last.
        </Dim>

        {reminder !== null ? (
          <View
            style={[s.reminder, stale.urgent && s.reminderUrgent]}
            testID={stale.urgent ? 'backup-reminder-urgent' : 'backup-reminder'}
          >
            <Ionicons
              name={stale.urgent ? 'warning' : 'time-outline'}
              size={16}
              color={stale.urgent ? theme.color.danger : theme.color.warn}
            />
            <Dim style={{ flex: 1, color: stale.urgent ? theme.color.danger : theme.color.warn }}>
              {reminder}
            </Dim>
          </View>
        ) : null}

        <View style={s.stats} testID="backup-stats">
          <Stat label="Plans" value={String(current.plans)} />
          <Stat label="Workouts" value={String(current.sessions)} />
          <Stat label="Sets logged" value={String(current.loggedSets)} />
        </View>
        {current.from !== null && current.to !== null ? (
          <Dim>
            {formatDate(current.from)} — {formatDate(current.to)}
          </Dim>
        ) : null}

        <View style={s.actions}>
          <Button
            label="Export"
            testID="export-backup"
            style={{ flex: 1 }}
            onPress={() => void handleExport()}
          />
          {canPickFile() ? (
            <Button
              label="Import"
              variant="secondary"
              testID="import-backup"
              onPress={() => void handleImport()}
            />
          ) : null}
        </View>

        {note !== null ? (
          <View style={s.note} testID="backup-note">
            <Ionicons name="checkmark-circle" size={16} color={theme.color.accent} />
            <Dim style={{ flex: 1, color: theme.color.accent }}>{note}</Dim>
          </View>
        ) : null}

        {error !== null ? (
          <View style={[s.note, s.errorNote]} testID="backup-error">
            <Ionicons name="alert-circle" size={16} color={theme.color.danger} />
            <Dim style={{ flex: 1, color: theme.color.danger }}>{error}</Dim>
          </View>
        ) : null}

        {/*
         * Automatic export, where the browser allows it.
         *
         * The File System Access API is the only sanctioned way for a web page to keep writing
         * to a file the user picked - and it exists in Chrome and Edge on desktop, and nowhere
         * else. Not Safari, on any platform, and not Chrome on Android. So on the iPhone this
         * app is mostly used from, this section is absent and the reminder above is what stands
         * in for it. Saying that plainly beats offering a switch that quietly does nothing.
         */}
        <View style={s.auto} testID="auto-export">
          {!autoSupported ? (
            <>
              <Text style={s.moveTitle}>Where exports go</Text>
              <Dim testID="auto-export-unsupported">
                Every export is the same file, {BACKUP_FILENAME}. Save it to the same folder each
                time and it replaces the previous one instead of piling up beside it.
                {'\n\n'}
                It cannot write itself: Safari gives no web app standing permission to a file on
                your device, so each save needs your tap. GRam will tell you above when there is
                enough new training to be worth one.
              </Dim>
            </>
          ) : backupRecord.autoExport ? (
            <>
              <View style={s.autoOn}>
                <Ionicons name="sync-circle" size={18} color={theme.color.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.autoTitle}>Auto-export is on</Text>
                  <Dim>
                    {target ?? 'your chosen file'} is rewritten a couple of seconds after anything
                    changes.
                  </Dim>
                </View>
              </View>
              <View style={s.actions}>
                <Button
                  label="Change file"
                  variant="secondary"
                  testID="auto-export-change"
                  onPress={() => void handleArmAutoExport()}
                />
                <Button
                  label="Turn off"
                  variant="secondary"
                  testID="auto-export-off"
                  onPress={() => void handleDisarmAutoExport()}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={s.moveTitle}>Hands-free backups</Text>
              <Dim style={{ marginBottom: theme.space(2) }}>
                Export already remembers where it saved and goes back there. Turn this on and it
                stops needing the tap: the file is rewritten a couple of seconds after anything
                changes. Put it in a synced folder and the backup leaves this device too.
              </Dim>
              <Button
                label="Choose a file and turn on"
                testID="auto-export-on"
                onPress={() => void handleArmAutoExport()}
              />
            </>
          )}
        </View>

        {/*
         * The reason this feature exists, spelled out where someone about to delete their app
         * will read it. Steps 1 and 3 are buttons here; step 2 is the one thing no web app can
         * do for itself - iOS has no API to remove or add its own home-screen icon.
         */}
        <View style={s.move} testID="backup-move-guide">
          <Text style={s.moveTitle}>Moving to a new install, or changing the icon?</Text>
          <Body style={s.step}>1. Export a backup and save it to Files.</Body>
          <Body style={s.step}>
            2. Remove the app from your home screen, then add it again from Safari.
          </Body>
          <Body style={s.step}>3. Open it and tap Import.</Body>
          <Dim style={{ marginTop: theme.space(2) }}>
            Only needed when the install itself is being replaced. Normal updates arrive on their
            own and never touch your data.
          </Dim>
        </View>
      </Card>


    </>
  );
}

/**
 * The sentence shown before anything is overwritten.
 *
 * It has to make one thing unmissable: importing replaces, it does not merge. Someone restoring
 * onto an empty phone and someone about to wipe a year of training see different text, because
 * they are about to do very different things with the same button.
 */
export function describeImport(current: BackupSummary, backup: ParsedBackup): string {
  const when = backup.exportedAt ? ` from ${formatDate(Date.parse(backup.exportedAt))}` : '';
  const incoming =
    `The backup${when} holds ${backup.summary.plans} plan${backup.summary.plans === 1 ? '' : 's'}, ` +
    `${backup.summary.sessions} workout${backup.summary.sessions === 1 ? '' : 's'} and ` +
    `${backup.summary.loggedSets} logged set${backup.summary.loggedSets === 1 ? '' : 's'}.`;

  const future = backup.fromTheFuture
    ? ' It was written by a newer version of GRam, so anything this version does not understand will be dropped.'
    : '';

  if (current.plans === 0 && current.loggedSets === 0) {
    return `${incoming} There is nothing on this device to lose.${future}`;
  }

  return (
    `${incoming}\n\nThis replaces what is here now — ${current.plans} plan` +
    `${current.plans === 1 ? '' : 's'} and ${current.loggedSets} logged set` +
    `${current.loggedSets === 1 ? '' : 's'} — rather than merging with it. Export first if you ` +
    `have not.${future}`
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: theme.space(2), marginVertical: theme.space(3) },
  stat: {
    flex: 1,
    padding: theme.space(2.5),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  statValue: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '800' },
  statLabel: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(1) },
  reminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space(2),
    marginTop: theme.space(3),
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.warn,
  },
  reminderUrgent: { borderColor: theme.color.danger },
  auto: {
    marginTop: theme.space(4),
    paddingTop: theme.space(3),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  autoOn: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  autoTitle: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '800' },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space(2),
    marginTop: theme.space(3),
  },
  errorNote: {},
  move: {
    marginTop: theme.space(4),
    paddingTop: theme.space(3),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  moveTitle: {
    color: theme.color.text,
    fontSize: theme.font.small,
    fontWeight: '800',
    marginBottom: theme.space(2),
  },
  step: { color: theme.color.textDim, marginTop: theme.space(1), lineHeight: 20 },
  textHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  filename: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '700' },
  textArea: {
    marginTop: theme.space(3),
    minHeight: 140,
    maxHeight: 240,
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    color: theme.color.textDim,
    fontSize: theme.font.tiny,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  pasteArea: { minHeight: 200, color: theme.color.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: theme.color.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  sheetTitle: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  sheetBody: { padding: theme.space(4), gap: theme.space(3) },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
});
