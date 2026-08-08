import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { useStore } from '@/store/useStore';
import { BackupReminder } from '@/ui/BackupReminder';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));
/*
 * Read back out of the mock registry rather than captured in a const above the jest.mock call.
 * jest.mock is hoisted to the top of the file, so a const declared here is still undefined when
 * the factory runs, and the component under test ends up with `router` undefined.
 */
const mockRouter = jest.requireMock('expo-router').router as {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
};

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const store = () => useStore.getState();
const DAY = 86_400_000;

/** Records `count` sets across as many workouts as it takes, so there is something to lose. */
function record(count: number) {
  const planId = store().createPlan('monday');
  store().addPlanItem(planId, BENCH);
  let done = 0;
  while (done < count) {
    const sessionId = store().startSession(planId)!;
    const session = store().sessions.find((s) => s.id === sessionId)!;
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (done >= count) break;
        store().toggleSetLogged(sessionId, entry.id, set.id);
        done += 1;
      }
    }
    store().endSession(sessionId);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

describe('the backup warning', () => {
  it('says nothing to someone with nothing recorded', async () => {
    // The state every new install is in. Opening the app for the first time to a red warning
    // bar about data you have not created yet would be absurd.
    await renderScreen(<BackupReminder />);
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });

  it('stays quiet about one session never backed up', async () => {
    // Under the bar on purpose. This is the loud warning; Profile's card handles the quiet case.
    record(4);
    await renderScreen(<BackupReminder />);
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });

  it('warns once a real amount has never been backed up', async () => {
    record(20);
    await renderScreen(<BackupReminder />);
    expect(screen.getByTestId('backup-banner')).toBeTruthy();
    expect(screen.getByText(/never backed this up/)).toBeTruthy();
  });

  it('warns when the last backup is over a week old and has been outgrown', async () => {
    record(20);
    store().recordExport(Date.now() - 9 * DAY, 2);
    await renderScreen(<BackupReminder />);
    expect(screen.getByText(/9 days ago/)).toBeTruthy();
  });

  it('goes quiet the moment everything is exported', async () => {
    record(20);
    store().recordExport(Date.now(), 20);
    await renderScreen(<BackupReminder />);
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });

  it('sends you to Profile, where the export button is', async () => {
    record(20);
    await renderScreen(<BackupReminder />);
    await fireEvent.press(screen.getByTestId('backup-banner-go'));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile');
  });

  it('can be dismissed, and stays dismissed for the rest of the session', async () => {
    record(20);
    await renderScreen(<BackupReminder />);
    await fireEvent.press(screen.getByTestId('backup-banner-dismiss'));
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });

  it('comes back on the next launch, because the danger has not gone away', async () => {
    record(20);
    const first = await renderScreen(<BackupReminder />);
    await fireEvent.press(screen.getByTestId('backup-banner-dismiss'));
    first.unmount();

    const second = await renderScreen(<BackupReminder />);
    expect(screen.getByTestId('backup-banner')).toBeTruthy();
    // Both roots are unmounted by hand. Leaving one mounted leaves `screen` pointing at a dead
    // tree, and every later test in the file queries that instead of its own render.
    second.unmount();
  });
});
