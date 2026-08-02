import { act, render } from '@testing-library/react-native';
import { useStore } from '@/store/useStore';
import { useAutoBackup } from '@/ui/useAutoBackup';

// Prefixed with `mock` so jest allows the factory to close over them.
const mockWriteBackupFile = jest.fn();
const mockIsSupported = jest.fn(() => true);

jest.mock('@/lib/autoExport', () => ({
  isAutoExportSupported: () => mockIsSupported(),
  writeBackupFile: (text: string) => mockWriteBackupFile(text),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

function Harness() {
  useAutoBackup();
  return null;
}

const store = () => useStore.getState();
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';

/** Advances past the debounce and lets the queued promise settle. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(3_000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockWriteBackupFile.mockResolvedValue('written');
  mockIsSupported.mockReturnValue(true);
  store().resetAll();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('automatic export', () => {
  it('does nothing while it is switched off', async () => {
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(mockWriteBackupFile).not.toHaveBeenCalled();
  });

  it('does nothing where the browser cannot support it', async () => {
    mockIsSupported.mockReturnValue(false);
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(mockWriteBackupFile).not.toHaveBeenCalled();
  });

  it('does not write merely because the app opened', async () => {
    // Nothing has changed, so a write would only add noise and file churn.
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await settle();

    expect(mockWriteBackupFile).not.toHaveBeenCalled();
  });

  it('writes after the data changes', async () => {
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(mockWriteBackupFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockWriteBackupFile.mock.calls[0][0]);
    expect(written.app).toBe('GRam');
    expect(written.state.plans[0].name).toBe('Push day');
  });

  it('writes once for a burst of edits, not once per keystroke', async () => {
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      const id = store().createPlan('Push day');
      store().addPlanItem(id, BENCH);
      store().renamePlan(id, 'Push A');
      store().renamePlan(id, 'Push AB');
    });
    await settle();

    expect(mockWriteBackupFile).toHaveBeenCalledTimes(1);
  });

  it('records the export, so the reminder knows it happened', async () => {
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(store().backup.lastExportedAt).not.toBeNull();
  });

  it('switches itself off when the file is gone', async () => {
    // Silently doing nothing while the switch says "on" is the worst available outcome.
    mockWriteBackupFile.mockResolvedValue('no-file');
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(store().backup.autoExport).toBe(false);
  });

  it('switches itself off when permission has lapsed', async () => {
    mockWriteBackupFile.mockResolvedValue('denied');
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(store().backup.autoExport).toBe(false);
  });

  it('stays armed through a transient write failure', async () => {
    // A disk hiccup should not disarm the safety net; only a definite loss of the target does.
    mockWriteBackupFile.mockResolvedValue('error');
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('Push day');
    });
    await settle();

    expect(store().backup.autoExport).toBe(true);
  });
});
