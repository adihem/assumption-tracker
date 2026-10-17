export const ASSUMPTION_ENTRY_TYPE = "assumption-tracker";
export const EVENT_VERSION = 1;

export const IMPACTS = ["low", "medium", "high"] as const;
export const STATUSES = ["pending", "accepted", "corrected", "deferred", "rejected"] as const;
export const ORIGINS = ["agent", "user"] as const;

export type Impact = (typeof IMPACTS)[number];
export type Status = (typeof STATUSES)[number];
export type ReviewStatus = Exclude<Status, "pending">;
export type Origin = (typeof ORIGINS)[number];

export const LIMITS = {
  title: [3, 80],
  description: [10, 500],
  reason: [0, 300],
  correction: [1, 500],
  reviewNote: [0, 300],
} as const;

export interface Assumption {
  id: string;
  title: string;
  description: string;
  reason: string;
  impact: Impact;
  status: Status;
  origin: Origin;
  createdAt: string;
  updatedAt: string;
  correction?: string;
  reviewNote?: string;
}

export interface NewAssumption {
  title: string;
  description: string;
  reason: string;
  impact: Impact;
}

export type CreatedEvent = { version: 1; event: "created"; assumption: Assumption };
export type ReviewedEvent = {
  version: 1;
  event: "reviewed";
  id: string;
  status: ReviewStatus;
  timestamp: string;
  correction?: string;
  reviewNote?: string;
};
export type TrackerEvent = CreatedEvent | ReviewedEvent;

export interface TrackerState {
  assumptions: ReadonlyMap<string, Assumption>;
  nextNumber: number;
}
