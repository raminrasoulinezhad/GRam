import { fireEvent, screen } from '@testing-library/react-native';
import { cancelDialog, confirmDialog, renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { buildBackup, serialiseBackup, summarise } from '@/store/backup';
import { BackupCard, describeImport } from '@/ui/BackupCard';

// The only import route now is the system file picker, so that is what the tests drive.
const mockPickTextFile = jest.fn();
jest.mock('@/lib/transfer', () => {
  const actual = jest.requireActual('@/lib/transfer');
  return { ...actual, pickTextFile: () => mockPickTextFile(), canPickFile: () => true };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Squat';
const store = () => useStore.getState();

/** Builds a plan, runs it, and records every set - a user with something to lose. */
function trainedUser() {
  const planId = store().createPlan('Push day');
  store().addPlanItem(planId, BENCH);
  const sessionId = store().startSession(planId)!;
  const session = store().sessions.find((s) => s.id === sessionId)!;
  for (const entry of session.entries) {
    for (const set of entry.sets) store().toggleSetLogged(sessionId, entry.id, set.id);
  }
  store().endSession(sessionId);
  return planId;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPickTextFile.mockResolvedValue(null);
  store().resetAll();
});

describe('what the card reports', () => {
  it('counts the data actually on the device', async () => {
    trainedUser();
    await renderScreen(<BackupCard />);

    const summary = summarise(store().exportState());
    expect(summary.plans).toBe(1);
    expect(summary.loggedSets).toBeGreaterThan(0);
    expect(screen.getByTestId('backup-stats')).toBeTruthy();
  });

  it('explains the move it exists for', async () => {
    await renderScreen(<BackupCard />);
    expect(screen.getByTestId('backup-move-guide')).toBeTruthy();
  });
});

describe('exporting', () => {
  it('shows the backup text so there is never a dead end', async () => {
    trainedUser();
    await renderScreen(<BackupCard />);

    await fireEvent.press(screen.getByTestId('export-backup'));

    const field = screen.getByTestId('backup-text');
    expect(field).toBeTruthy();
    expect(String(field.props.value)).toContain('"app": "GRam"');
  });

  it('exports something that parses back into the same data', async () => {
    trainedUser();
    await renderScreen(<BackupCard />);
    await fireEvent.press(screen.getByTestId('export-backup'));

    const text = String(screen.getByTestId('backup-text').props.value);
    const { parseBackup } = require('@/store/backup');
    const result = parseBackup(text);

    expect(result.ok).toBe(true);
    expect(result.backup.state).toEqual(store().exportState());
  });

  it('can be hidden again', async () => {
    await renderScreen(<BackupCard />);
    await fireEvent.press(screen.getByTestId('export-backup'));
    await fireEvent.press(screen.getByTestId('hide-backup'));
    expect(screen.queryByTestId('backup-text')).toBeNull();
  });
});

describe('importing', () => {
  /** The file a user would carry across a reinstall. */
  function backupText() {
    trainedUser();
    const text = serialiseBackup(buildBackup(store().exportState(), '1.1.0', Date.now()));
    store().resetAll();
    return text;
  }

  /** Picks `text` as though the user chose that file from the system picker. */
  async function importFile(text: string) {
    mockPickTextFile.mockResolvedValue(text);
    await fireEvent.press(screen.getByTestId('import-backup'));
  }

  it('restores a backup onto an empty device', async () => {
    const text = backupText();
    await renderScreen(<BackupCard />);
    expect(store().plans).toHaveLength(0);

    await importFile(text);
    await confirmDialog();

    expect(store().plans).toHaveLength(1);
    expect(store().plans[0].name).toBe('Push day');
    expect(summarise(store().exportState()).loggedSets).toBeGreaterThan(0);
  });

  it('asks before replacing data that is already there', async () => {
    const text = backupText();
    // Something different on the device now.
    const other = store().createPlan('Leg day');
    store().addPlanItem(other, SQUAT);

    await renderScreen(<BackupCard />);
    await importFile(text);

    expect(screen.getByText('Replace everything on this device?')).toBeTruthy();
  });

  it('changes nothing when that is declined', async () => {
    const text = backupText();
    const other = store().createPlan('Leg day');
    store().addPlanItem(other, SQUAT);

    await renderScreen(<BackupCard />);
    await importFile(text);
    await cancelDialog();

    expect(store().plans.map((p) => p.name)).toEqual(['Leg day']);
  });

  it('replaces rather than merging, and says so beforehand', async () => {
    const text = backupText();
    const other = store().createPlan('Leg day');
    store().addPlanItem(other, SQUAT);

    await renderScreen(<BackupCard />);
    await importFile(text);
    await confirmDialog();

    expect(store().plans.map((p) => p.name)).toEqual(['Push day']);
  });

  it('reports a file that is not a backup instead of wiping anything', async () => {
    trainedUser();
    await renderScreen(<BackupCard />);

    await importFile('this is my shopping list');

    expect(screen.getByTestId('backup-error')).toBeTruthy();
    expect(store().plans).toHaveLength(1);
  });

  it('restores settings and profile too, not just the training log', async () => {
    store().updateSettings({ unit: 'lb' });
    store().updateProfile({ displayName: 'Ramin', weightKg: 82 });
    const text = backupText();

    await renderScreen(<BackupCard />);
    await importFile(text);
    await confirmDialog();

    expect(store().settings.unit).toBe('lb');
    expect(store().profile.displayName).toBe('Ramin');
    expect(store().profile.weightKg).toBe(82);
  });
});

describe('the confirmation wording', () => {
  const incoming = {
    state: {} as never,
    summary: { plans: 3, exercises: 9, sessions: 40, loggedSets: 500, from: null, to: null },
    schemaVersion: 4,
    appVersion: '1.1.0',
    exportedAt: null,
    fromTheFuture: false,
  };

  it('reassures when there is nothing to lose', () => {
    const empty = { plans: 0, exercises: 0, sessions: 0, loggedSets: 0, from: null, to: null };
    expect(describeImport(empty, incoming)).toContain('nothing on this device to lose');
  });

  it('spells out the loss when there is one', () => {
    const existing = { plans: 2, exercises: 6, sessions: 12, loggedSets: 300, from: null, to: null };
    const text = describeImport(existing, incoming);
    expect(text).toContain('replaces');
    expect(text).toContain('rather than merging');
    expect(text).toContain('300 logged sets');
  });

  it('warns about a backup from a newer version', () => {
    const empty = { plans: 0, exercises: 0, sessions: 0, loggedSets: 0, from: null, to: null };
    const text = describeImport(empty, { ...incoming, fromTheFuture: true });
    expect(text).toContain('newer version');
  });

  it('counts in the singular when there is one of something', () => {
    const empty = { plans: 0, exercises: 0, sessions: 0, loggedSets: 0, from: null, to: null };
    const one = {
      ...incoming,
      summary: { plans: 1, exercises: 1, sessions: 1, loggedSets: 1, from: null, to: null },
    };
    const text = describeImport(empty, one);
    expect(text).toContain('1 plan,');
    expect(text).toContain('1 workout ');
    expect(text).toContain('1 logged set.');
  });
});
