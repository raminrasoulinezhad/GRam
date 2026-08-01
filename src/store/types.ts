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
};
