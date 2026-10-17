// Pure tracker state: no Pi imports, no I/O. Every function returns new values and never mutates its inputs.
import {
  type Assumption,
  type CreatedEvent,
  type NewAssumption,
  type Origin,
  type ReviewedEvent,
  type ReviewStatus,
  type Status,
  type TrackerEvent,
  type TrackerState,
} from "./types.ts";
import { checkText, comparableText, normalizeText, parseEvent } from "./validation.ts";

const ID_PATTERN = /^A-(\d{3,})$/;

export function createEmptyState(): TrackerState {
  return { assumptions: new Map(), nextNumber: 1 };
}

export function nextId(state: TrackerState): string {
  return `A-${String(state.nextNumber).padStart(3, "0")}`;
}

/**
 * Existing non-rejected item whose normalized title or description equals the candidate's.
 * Rejected items are never matched, so a re-raised rejected idea becomes a new item.
 * ponytail: exact normalized match only; add fuzzy/semantic matching if real duplicates slip through.
 */
export function findDuplicate(state: TrackerState, candidate: NewAssumption): Assumption | undefined {
  const title = comparableText(candidate.title);
  const description = comparableText(candidate.description);
  for (const a of state.assumptions.values()) {
    if (a.status === "rejected") continue;
    if (comparableText(a.title) === title || comparableText(a.description) === description) return a;
  }
  return undefined;
}

/** Builds a "created" event for an already-validated candidate. Does not change state. */
export function buildCreatedEvent(state: TrackerState, input: NewAssumption, origin: Origin, now: string): CreatedEvent {
  return {
    version: 1,
    event: "created",
    assumption: { id: nextId(state), ...input, status: "pending", origin, createdAt: now, updatedAt: now },
  };
}

/** Builds a "reviewed" event with normalized text; run checkEvent before persisting it. */
export function buildReviewedEvent(
  id: string,
  status: ReviewStatus,
  now: string,
  correction?: string,
  reviewNote?: string,
): ReviewedEvent {
  const event: ReviewedEvent = { version: 1, event: "reviewed", id, status, timestamp: now };
  if (correction !== undefined) event.correction = normalizeText(correction);
  if (reviewNote !== undefined && normalizeText(reviewNote) !== "") event.reviewNote = normalizeText(reviewNote);
  return event;
}

/** Returns why the event cannot be applied to this state, or undefined if it can. */
export function checkEvent(state: TrackerState, event: TrackerEvent): string | undefined {
  return event.event === "created" ? checkCreated(state, event) : checkReviewed(state, event);
}

function checkCreated(state: TrackerState, { assumption: a }: CreatedEvent): string | undefined {
  if (!ID_PATTERN.test(a.id)) return `Invalid assumption ID "${a.id}".`;
  if (state.assumptions.has(a.id)) return `Assumption ${a.id} already exists.`;
  if (a.status !== "pending") return "New assumptions must start as pending.";
  if (a.correction !== undefined || a.reviewNote !== undefined) return "New assumptions cannot carry review fields.";
  return checkText("title", a.title) ?? checkText("description", a.description) ?? checkText("reason", a.reason);
}

function checkReviewed(state: TrackerState, e: ReviewedEvent): string | undefined {
  const current = state.assumptions.get(e.id);
  if (!current) return `Unknown assumption ID "${e.id}".`;
  if (current.status !== "pending" && current.status !== "deferred") {
    return `${e.id} is already ${current.status}; re-reviewing a final decision is not supported in v1.`;
  }
  if (current.status === "deferred" && e.status === "deferred") return `${e.id} is already deferred.`;
  if (e.status === "corrected") {
    const error = checkText("correction", e.correction);
    if (error) return error;
  } else if (e.correction !== undefined) {
    return "Only a correction may include replacement text.";
  }
  return e.reviewNote === undefined ? undefined : checkText("reviewNote", e.reviewNote);
}

/** Applies a valid event. An invalid event returns the same state unchanged (good state is never overwritten). */
export function applyEvent(state: TrackerState, event: TrackerEvent): TrackerState {
  if (checkEvent(state, event) !== undefined) return state;
  const assumptions = new Map(state.assumptions);
  if (event.event === "created") {
    const a = event.assumption;
    assumptions.set(a.id, { ...a });
    const n = Number(ID_PATTERN.exec(a.id)![1]);
    return { assumptions, nextNumber: Math.max(state.nextNumber, n + 1) };
  }
  // Reviewable items are pending/deferred, so they never carry an old correction; a note from deferring is kept.
  const updated: Assumption = { ...assumptions.get(event.id)!, status: event.status, updatedAt: event.timestamp };
  if (event.correction !== undefined) updated.correction = event.correction;
  if (event.reviewNote !== undefined) updated.reviewNote = event.reviewNote;
  assumptions.set(event.id, updated);
  return { assumptions, nextNumber: state.nextNumber };
}

/** Replays raw persisted entries in order. Malformed, unknown-version, or inapplicable entries are skipped and counted. */
export function replayEvents(rawEvents: readonly unknown[]): { state: TrackerState; skipped: number } {
  let state = createEmptyState();
  let skipped = 0;
  for (const raw of rawEvents) {
    const event = parseEvent(raw);
    if (!event || checkEvent(state, event) !== undefined) {
      skipped++;
      continue;
    }
    state = applyEvent(state, event);
  }
  return { state, skipped };
}

/** Pending and deferred items, in ID order. */
export function awaitingReview(state: TrackerState): Assumption[] {
  return [...state.assumptions.values()]
    .filter((a) => a.status === "pending" || a.status === "deferred")
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function countByStatus(state: TrackerState): Record<Status, number> {
  const counts: Record<Status, number> = { pending: 0, accepted: 0, corrected: 0, deferred: 0, rejected: 0 };
  for (const a of state.assumptions.values()) counts[a.status]++;
  return counts;
}
