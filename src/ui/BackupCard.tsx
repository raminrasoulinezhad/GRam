import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import {
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
import {
  autoExportTarget,
  chooseBackupFile,
  forgetBackupFile,
  isAutoExportSupported,
  requestPersistentStorage,
  writeBackupFile,
} from '@/lib/autoExport';
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

  const [exported, setExported] = useState<{ text: string; filename: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const autoSupported = isAutoExportSupported();

  // The filename is only known asynchronously, and only matters where auto-export can run.
  useEffect(() => {
    if (!autoSupported) return;
    let live = true;
    void autoExportTarget().then((name) => {
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

  async function handleExport() {
    const now = Date.now();
    const filename = backupFilename(now);

    // Recorded before the snapshot is taken, so the file's own backup record describes this
    // export rather than the one before it.
    recordExport(now, current.loggedSets);

    const text = serialiseBackup(buildBackup(exportState(), appVersion, now));
    setExported({ text, filename });
    setNote(null);
    // Persistent storage does nothing about deliberate deletion, but it does stop a browser
    // reclaiming space from a site it thinks is idle. Asked for here because a user who just
    // exported has demonstrably decided this data matters.
    void requestPersistentStorage();

    const outcome = await exportText(text, filename);
    setNote(
      outcome === 'shared'
        ? 'Sent to the share sheet. "Save to Files" keeps it somewhere deleting the app cannot reach.'
        : outcome === 'downloaded'
          ? `Saved as ${filename}.`
          : outcome === 'copied'
            ? 'Copied to the clipboard — paste it somewhere safe.'
            : 'Copy the text below and keep it somewhere safe.',
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
    setPasting(false);
    setPasted('');
    setNote(
      `Imported ${backup.summary.plans} plan${backup.summary.plans === 1 ? '' : 's'} and ` +
        `${backup.summary.sessions} workout${backup.summary.sessions === 1 ? '' : 's'}.`,
    );
  }

  async function handleArmAutoExport() {
    setError(null);
    const chosen = await chooseBackupFile(backupFilename(Date.now()));
    if (!chosen.ok) {
      if (chosen.reason === 'error') setError('That file could not be opened for writing.');
      return;
    }
    setTarget(chosen.name);
    setAutoExport(true);
    void requestPersistentStorage();

    // Write immediately, so the file exists and is current from the moment it is chosen rather
    // than after the next change.
    const now = Date.now();
    recordExport(now, current.loggedSets);
    const written = await writeBackupFile(
      serialiseBackup(buildBackup(exportState(), appVersion, now)),
    );
    if (written === 'written') {
      setNote(`Auto-export on. ${chosen.name} now updates itself whenever you train.`);
    } else {
      setAutoExport(false);
      setError('GRam could not write to that file, so auto-export is off.');
    }
  }

  async function handleDisarmAutoExport() {
    setAutoExport(false);
    await forgetBackupFile();
    setTarget(null);
    setNote('Auto-export off. Your file is left as it was.');
  }

  async function handlePickFile() {
    setError(null);
    try {
      const text = await pickTextFile();
      if (text !== null) await applyImport(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  }

  return (
    <>
      <Card testID="backup-card">
        <H2>Backup and transfer</H2>
        <Dim style={{ marginTop: theme.space(1) }}>
          Your training lives on this device only. A backup is one file holding every plan,
          workout and setting.
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
            label="Export a backup"
            testID="export-backup"
            style={{ flex: 1 }}
            onPress={() => void handleExport()}
          />
          {canPickFile() ? (
            <Button
              label="Import"
              variant="secondary"
              testID="import-backup"
              onPress={() => void handlePickFile()}
            />
          ) : null}
          <Button
            label="Paste"
            variant="secondary"
            testID="paste-backup"
            onPress={() => {
              setError(null);
              setPasting(true);
            }}
          />
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
              <Text style={s.moveTitle}>Automatic backups</Text>
              <Dim testID="auto-export-unsupported">
                This browser cannot let an app write to a file on its own — Safari and Chrome on
                Android both refuse, for good reasons. GRam will remind you above when there is
                enough new training to be worth exporting. On a desktop Chrome or Edge, this
                becomes a real automatic backup to a file you choose.
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
              <Text style={s.moveTitle}>Automatic backups</Text>
              <Dim style={{ marginBottom: theme.space(2) }}>
                Choose a file once and GRam keeps it up to date by itself, every time you train.
                Put it in a synced folder and the backup leaves this device too.
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

      {/* The text is always reachable, whatever the share sheet did with it. */}
      {exported !== null ? (
        <Card testID="backup-text-card">
          <View style={s.textHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.filename}>{exported.filename}</Text>
              <Dim>{Math.max(1, Math.round(exported.text.length / 1024))} KB</Dim>
            </View>
            <Button
              label="Copy"
              variant="secondary"
              testID="copy-backup"
              onPress={() => {
                void copyText(exported.text).then((done) =>
                  setNote(done ? 'Copied to the clipboard.' : 'Select the text below to copy it.'),
                );
              }}
            />
            <Button
              label="Hide"
              variant="ghost"
              testID="hide-backup"
              onPress={() => setExported(null)}
            />
          </View>
          <TextInput
            testID="backup-text"
            value={exported.text}
            multiline
            editable={false}
            selectTextOnFocus
            style={s.textArea}
          />
        </Card>
      ) : null}

      {pasting ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPasting(false)}>
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetTitle}>Paste a backup</Text>
                  <Dim>For when the file is in a note or a message rather than in Files.</Dim>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID="paste-close"
                  hitSlop={12}
                  onPress={() => setPasting(false)}
                  style={s.close}
                >
                  <Ionicons name="close" size={22} color={theme.color.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={s.sheetBody}>
                <TextInput
                  testID="paste-input"
                  value={pasted}
                  onChangeText={setPasted}
                  multiline
                  placeholder="Paste the contents of your backup file here"
                  placeholderTextColor={theme.color.textFaint}
                  style={[s.textArea, s.pasteArea]}
                />
                {error !== null ? (
                  <Dim style={{ color: theme.color.danger }} testID="paste-error">
                    {error}
                  </Dim>
                ) : null}
                <Button
                  label="Import this"
                  testID="paste-import"
                  disabled={pasted.trim().length === 0}
                  onPress={() => void applyImport(pasted)}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
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
