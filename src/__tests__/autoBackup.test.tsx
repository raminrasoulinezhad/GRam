import { act, render } from '@testing-library/react-native';
import { useStore } from '@/store/useStore';
import { useAutoBackup } from '@/ui/useAutoBackup';
import { buildArchive } from '@/store/archive';

// Prefixed with `mock` so jest allows the factory to close over them.
const mockWriteArchive = jest.fn();
const mockReadDirectory = jest.fn();
const mockIsSupported = jest.fn(() => true);

jest.mock('@/lib/directory', () => ({
  isDirectoryBackupSupported: () => mockIsSupported(),
  readArchiveDirectory: () => mockReadDirectory(),
  writeArchive: (files: unknown, remove: unknown) => mockWriteArchive(files, remove),
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
  mockWriteArchive.mockResolvedValue({ ok: true, written: 2 });
  mockReadDirectory.mockResolvedValue(new Map());
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
      store().createPlan('monday');
    });
    await settle();

    expect(mockWriteArchive).not.toHaveBeenCalled();
  });

  it('does nothing where the browser cannot support it', async () => {
    mockIsSupported.mockReturnValue(false);
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    expect(mockWriteArchive).not.toHaveBeenCalled();
  });

  it('does not write merely because the app opened', async () => {
    // Nothing has changed, so a write would only add noise and file churn.
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await settle();

    expect(mockWriteArchive).not.toHaveBeenCalled();
  });

  it('writes after the data changes', async () => {
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    expect(mockWriteArchive).toHaveBeenCalledTimes(1);
    const files = mockWriteArchive.mock.calls[0][0] as { path: string; text: string }[];
    const plans = JSON.parse(files.find((f) => f.path === 'plans.json')!.text);
    expect(plans[0].day).toBe('monday');
    expect(files.some((f) => f.path === 'manifest.json')).toBe(true);
  });

  it('writes only what changed, using the manifest already in the folder', async () => {
    // The point of sharding: a set logged today must not rewrite a decade of history.
    store().setAutoExport(true);
    // Snapshot the folder as it stands *after* arming, so the only later change is the plan.
    const first = buildArchive(store().exportState(), '1.0.0', Date.now());
    mockReadDirectory.mockResolvedValue(new Map(first.map((f) => [f.path, f.text])));

    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    const written = (mockWriteArchive.mock.calls[0][0] as { path: string }[]).map((f) => f.path);
    expect(written).toContain('plans.json');
    expect(written).toContain('manifest.json');
    expect(written).not.toContain('profile.json');
  });

  it('writes once for a burst of edits, not once per keystroke', async () => {
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      const id = store().createPlan('monday');
      store().addPlanItem(id, BENCH);
                });
    await settle();

    expect(mockWriteArchive).toHaveBeenCalledTimes(1);
  });

  it('records the export, so the reminder knows it happened', async () => {
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    expect(store().backup.lastExportedAt).not.toBeNull();
  });

  it('switches itself off when the folder is gone', async () => {
    // Silently doing nothing while the switch says "on" is the worst available outcome.
    mockReadDirectory.mockResolvedValue(null);
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    expect(store().backup.autoExport).toBe(false);
  });

  it('switches itself off when permission has lapsed', async () => {
    mockWriteArchive.mockResolvedValue({ ok: false, reason: 'denied' });
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    expect(store().backup.autoExport).toBe(false);
  });

  it('stays armed through a transient write failure', async () => {
    // A disk hiccup should not disarm the safety net; only a definite loss of the target does.
    mockWriteArchive.mockResolvedValue({ ok: false, reason: 'error' });
    store().setAutoExport(true);
    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      store().createPlan('monday');
    });
    await settle();

    expect(store().backup.autoExport).toBe(true);
  });
});
