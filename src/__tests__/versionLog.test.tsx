import { act, render } from '@testing-library/react-native';
import { useStore } from '@/store/useStore';
import { useVersionLog } from '@/ui/useVersionLog';

jest.mock('expo-constants', () => ({ expoConfig: { version: '9.9.9' } }));

/*
 * The one thing in the app that writes to the store just because the app opened.
 *
 * That makes it the one place a write can land BEFORE the persisted blob has loaded - and a
 * write before hydration flushes the store's empty initial state over the user's real file.
 * Hydration usually repairs it a moment later, which is exactly what makes it dangerous: it
 * is invisible until an app is killed inside the window and comes back with nothing.
 */

function Harness() {
  useVersionLog();
  return null;
}

const store = () => useStore.getState();
const versions = () => store().versionHistory.map((v) => v.version);

async function mount() {
  await act(async () => {
    render(<Harness />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('recording which build has run', () => {
  it('records the running version once the store has loaded', async () => {
    await mount();
    expect(versions()).toEqual(['9.9.9']);
  });

  it('does not record the same version twice', async () => {
    await mount();
    await mount();
    expect(versions()).toEqual(['9.9.9']);
  });

  it('writes nothing at all before hydration finishes', async () => {
    // The whole point. Anything written here is written over the user's data.
    jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useStore.persist, 'onFinishHydration').mockImplementation(() => () => {});

    await mount();

    expect(versions()).toEqual([]);
  });

  it('records as soon as hydration does finish', async () => {
    let finish: (() => void) | undefined;
    jest.spyOn(useStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useStore.persist, 'onFinishHydration').mockImplementation((cb) => {
      finish = cb as () => void;
      return () => {};
    });

    await mount();
    expect(versions()).toEqual([]);

    await act(async () => {
      finish?.();
    });
    expect(versions()).toEqual(['9.9.9']);
  });

  it('keeps the versions a loaded blob already carried', async () => {
    // The failure this guards against, stated as an assertion: an earlier run's history must
    // still be there after this hook has had its say.
    store().recordVersion('1.0.0', 1);
    await mount();
    expect(versions()).toEqual(['1.0.0', '9.9.9']);
  });
});
