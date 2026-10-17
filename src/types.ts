export const ASSUMPTION_ENTRY_TYPE = "assumption-tracker";
export const EVENT_VERSION = 1;

export const IMPACTS = ["low", "medium", "high"] as const;
export const STATUSES = ["pending", "accepted", "corrected", "deferred", "rejected"] as const;
export const ORIGINS = ["agent", "user"] as const;

export type Impact = (typeof IMPACTS)[number];
export type Status = (typeof STATUSES)[number];
export type ReviewStatus = Exclude<Status, "pending">;
export type Origin = (typeof ORIGINS)[number];

/** [min, max] character lengths after whitespace normalization. */
export const LIMITS = {
  title: [3, 80],
  description: [10, 500],
  reason: [0, 300],
  correction: [1, 500],
  reviewNote: [0, 300],
} as const;

export interface Assumption {
  id: string; // "A-001", assigned locally
  title: string;
  description: string;
  reason: string;
  impact: Impact; // agent-proposed, not verified severity
  status: Status; // only the user can move it out of "pending"
  origin: Origin;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
  correction?: string; // required when status is "corrected"
  reviewNote?: string;
}

/** Input for a new candidate, from the agent tool or the user. */
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
  nextNumber: number; // next free numeric part of an ID
}
