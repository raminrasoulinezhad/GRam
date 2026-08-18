import type { ComponentType } from 'react';
import { screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import { coerce } from '@/store/migrations';
import { useStore } from '@/store/useStore';
import type { Session } from '@/store/types';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));

// Required after the mock: an ES import is hoisted above `const mockRouter` and would capture
// undefined. Same convention as session.screen.test.tsx.
/* eslint-disable @typescript-eslint/no-var-requires */
const SessionScreen = require('../../app/session/[id]').default;
const HistoryDetail = require('../../app/history/[id]').default;
const PlanScreen = require('../../app/plan/[id]').default;
const ExerciseScreen = require('../../app/exercise/[id]').default;
const HistoryTab = require('../../app/(tabs)/history').default;
const BodyTab = require('../../app/(tabs)/body').default;
const PlansTab = require('../../app/(tabs)/index').default;
const ProfileTab = require('../../app/(tabs)/profile').default;
/* eslint-enable @typescript-eslint/no-var-requires */

const store = () => useStore.getState();
const GHOST = 'An_Exercise_That_Was_Removed_From_The_Catalog';

beforeEach(() => {
  store().resetAll();
  mockParams = {};
  jest.clearAllMocks();
});

/**
 * Screens rendered against data they were not written for.
 *
 * Every one of these states is reachable on a phone in someone's pocket: a second browser tab
 * that finished the workout this one is showing, a back button into a session that was
 * discarded, a restored backup whose exercises the catalog has since dropped, a set recorded in
 * a year the clock was wrong about. None of them may produce a blank screen, because a blank
 * screen in a PWA has no crash dialog and no way back except clearing the site data - which is
 * the exact loss the whole app is arranged to prevent.
 */

/** A finished workout of one exercise, with `count` recorded sets. */
function workout(exerciseId: string, at: number, count = 2, live = false): Session {
  return {
    id: 'sess',
    planId: null,
    planName: 'Test',
    startedAt: at,
    endedAt: live ? null : at + 3600_000,
    entries: [
      {
        id: 'ent',
        exerciseId,
        kind: 'weight_reps',
        restSec: 90,
        sets: Array.from({ length: count }, (_, i) => ({
          id: `set${i}`,
          weightKg: 60,
          reps: 8,
          loggedAt: at + i * 60_000,
        })),
      },
    ],
  };
}

describe('opening something that is no longer there', () => {
  it.each<[string, () => unknown]>([
    ['a workout finished in another tab', () => SessionScreen],
    ['a workout in the log', () => HistoryDetail],
    ['a plan', () => PlanScreen],
  ])('says so rather than going blank: %s', async (_name, get) => {
    mockParams = { id: 'this-id-never-existed' };
    const Screen = get() as ComponentType;
    await renderScreen(<Screen />);

    // Something readable is on the page. The specific words differ per screen; what matters is
    // that the render completed and produced text.
    expect(screen.toJSON()).not.toBeNull();
    expect(JSON.stringify(screen.toJSON())).toMatch(/not found/i);
  });

  it('shows an exercise page for an id the catalog has never heard of', async () => {
    mockParams = { id: GHOST };
    await renderScreen(<ExerciseScreen />);
    expect(screen.toJSON()).not.toBeNull();
  });

  /*
   * One render per test, deliberately. Unmounting a tree and rendering another inside a single
   * test detaches RTL's `screen` for every test that follows in the file, which shows up as a
   * run of unrelated failures pointing nowhere near the cause.
   */
  it.each<[string, () => unknown]>([
    ['the session screen', () => SessionScreen],
    ['the history editor', () => HistoryDetail],
    ['the plan editor', () => PlanScreen],
    ['the exercise page', () => ExerciseScreen],
  ])('does not crash when the route carries no id at all: %s', async (_name, get) => {
    mockParams = {};
    const Screen = get() as ComponentType;
    await renderScreen(<Screen />);
    expect(screen.toJSON()).not.toBeNull();
  });
});

describe('a history full of exercises the catalog dropped', () => {
  /*
   * The catalog is generated from an upstream dataset by a build script. An id that goes away
   * upstream leaves every set of it stranded, and those sets are still the user's training.
   * They must be visible and countable even though nothing can be looked up about them.
   */
  beforeEach(() => {
    useStore.setState(
      coerce({ sessions: [workout(GHOST, Date.UTC(2026, 7, 17, 18), 3)] }),
    );
  });

  it('lists the workout in History', async () => {
    await renderScreen(<HistoryTab />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('opens the workout', async () => {
    mockParams = { id: 'sess' };
    await renderScreen(<HistoryDetail />);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/not found/i);
  });

  it('draws the body map', async () => {
    await renderScreen(<BodyTab />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('draws the profile, milestones and all', async () => {
    await renderScreen(<ProfileTab />);
    expect(screen.toJSON()).not.toBeNull();
  });
});

describe('a workout the clock got wrong', () => {
  it.each<[string, number]>([
    ['before this app existed', Date.UTC(1970, 0, 1, 12)],
    ['during a year the phone had no clock', 0],
    ['far in the future', Date.UTC(2099, 11, 31, 23)],
  ])('renders History with a workout dated %s', async (_name, at) => {
    useStore.setState(coerce({ sessions: [workout('Barbell_Full_Squat', at, 2)] }));
    await renderScreen(<HistoryTab />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('renders the plans tab with a live workout dated in the future', async () => {
    // "Started in 3 months" is odd, but a blank plans tab is worse, and a clock that jumped is
    // not the user's fault.
    useStore.setState(
      coerce({
        sessions: [workout('Barbell_Full_Squat', Date.UTC(2099, 0, 1), 1, true)],
        activeSessionId: 'sess',
      }),
    );
    await renderScreen(<PlansTab />);
    expect(screen.toJSON()).not.toBeNull();
  });
});

describe('a workout with nothing in it', () => {
  it('opens in the history editor without a crash', async () => {
    // Reachable: delete every set in the editor and answer "Keep it" to the prompt.
    useStore.setState(
      coerce({
        sessions: [
          {
            id: 'sess',
            planId: null,
            planName: 'Emptied',
            startedAt: Date.UTC(2026, 7, 17, 18),
            endedAt: Date.UTC(2026, 7, 17, 19),
            entries: [],
          },
        ],
      }),
    );
    mockParams = { id: 'sess' };
    await renderScreen(<HistoryDetail />);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/not found/i);
  });

  it('renders the session screen for a live workout with no exercises', async () => {
    const id = store().startEmptySession();
    mockParams = { id };
    await renderScreen(<SessionScreen />);
    expect(screen.toJSON()).not.toBeNull();
  });
});

describe('names long enough to break a layout', () => {
  it('renders a workout titled with five thousand characters', async () => {
    useStore.setState(
      coerce({
        sessions: [
          { ...workout('Barbell_Full_Squat', Date.UTC(2026, 7, 17, 18), 2), planName: 'x'.repeat(5000) },
        ],
      }),
    );
    await renderScreen(<HistoryTab />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('renders a profile whose owner typed a novel into the name field', async () => {
    store().updateProfile({ displayName: 'y'.repeat(5000) });
    await renderScreen(<ProfileTab />);
    expect(screen.toJSON()).not.toBeNull();
  });
});

describe('a plan with more exercises than a day can hold', () => {
  it('renders fifty of them', async () => {
    const planId = store().createPlan('monday');
    for (let i = 0; i < 50; i++) store().addPlanItem(planId, 'Barbell_Full_Squat');
    mockParams = { id: planId };

    await renderScreen(<PlanScreen />);
    expect(screen.toJSON()).not.toBeNull();
  });
});
