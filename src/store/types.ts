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

/**
 * Days of the week, Monday first.
 *
 * Monday rather than Sunday because a training week is planned as one - "Monday push, Wednesday
 * pull" - and the balance rules count days, not calendar weeks.
 */
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** Three letters, for chips and tight rows. */
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/**
 * One training day.
 *
 * A plan IS a day of the week rather than something with a name of its own. That was already
 * the truth - the week review reads plans as days and checks that muscles are trained on two
 * different ones - but it was left implicit, and a free-text name let the two drift apart. Now
 * the day is the identity: at most seven plans, one per weekday, and "different days" means
 * exactly what it says.
 *
 * `name` is retained but no longer shown or edited. Plans written before this carried names
 * like "Push day" and discarding them in a migration would be throwing away something the user
 * typed; it costs nothing to keep, and it is the only record of what they called it.
 */
export type Plan = {
  id: string;
  day: Weekday;
  /** Legacy free-text name from before plans became weekdays. Not displayed. */
  name?: string;
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
