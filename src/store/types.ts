import type { SetKind } from '@/catalog';

/** The numbers a set carries. Which of them are meaningful is decided by the entry's SetKind. */
export type SetValues = {
  weightKg?: number;
  reps?: number;
  timeSec?: number;
  distanceM?: number;
};

export type SetTemplate = SetValues & { id: string };

export type PlanItem = {
  id: string;
  exerciseId: string;
  kind: SetKind;
  restSec: number;
  note?: string;
  /** The sets pre-filled when a session starts from this plan. */
  templates: SetTemplate[];
};

export type Plan = {
  id: string;
  name: string;
  note?: string;
  items: PlanItem[];
  createdAt: number;
  updatedAt: number;
};

/** `loggedAt === null` means planned; a timestamp means recorded. Toggling it is un-recording. */
export type SessionSet = SetValues & {
  id: string;
  loggedAt: number | null;
};

export type SessionEntry = {
  id: string;
  exerciseId: string;
  kind: SetKind;
  restSec: number;
  sets: SessionSet[];
};

export type Session = {
  id: string;
  planId: string | null;
  /** Snapshotted so history stays readable after the plan is renamed or deleted. */
  planName: string;
  startedAt: number;
  endedAt: number | null;
  entries: SessionEntry[];
};

export type Settings = {
  unit: 'kg' | 'lb';
  defaultRestSec: number;
  defaultSetCount: number;
  bodyGender: 'male' | 'female';
  /**
   * Whether to load exercise photographs from the upstream CDN. Off falls back to the drawn
   * muscle glyphs, which need no network and carry no third-party rights.
   */
  showExercisePhotos: boolean;
  /**
   * False until the unit has been defaulted from the phone's region once. Prevents a later
   * app launch from overwriting a unit the user has deliberately changed.
   */
  unitSeededFromDevice: boolean;
};

export type TrainingGoal = 'strength' | 'hypertrophy' | 'general';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

/**
 * The lifter's own details. Everything is optional: the app is fully usable without filling
 * any of it in, and none of it is transmitted anywhere - it lives in on-device storage and
 * feeds unit defaults, the body figure, and (later) load recommendations.
 */
export type Profile = {
  displayName: string;
  /** ISO yyyy-mm-dd. Stored rather than age so it does not silently go stale. */
  birthDate: string | null;
  /** Drives which body figure is drawn; deliberately separate from bodyGender's rendering use. */
  sex: 'male' | 'female' | 'unspecified';
  heightCm: number | null;
  weightKg: number | null;
  goal: TrainingGoal;
  experience: Experience;
  /** Catalog equipment values the user actually has access to. Empty means "no filter". */
  equipment: string[];
};
