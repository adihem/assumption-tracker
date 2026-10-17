import { describe, expect, it } from "vitest";
import {
  applyEvent,
  awaitingReview,
  buildCreatedEvent,
  buildReviewedEvent,
  checkEvent,
  countByStatus,
  createEmptyState,
  findDuplicate,
  nextId,
  replayEvents,
} from "../src/state.ts";
import type { NewAssumption, TrackerEvent, TrackerState } from "../src/types.ts";

const T0 = "2026-10-17T08:00:00.000Z";
const T1 = "2026-10-17T09:00:00.000Z";

const sqlite: NewAssumption = {
  title: "Use SQLite database",
  description: "Store attendance records in a local SQLite database.",
  reason: "No database was specified.",
  impact: "medium",
};
const login: NewAssumption = {
  title: "Add social login",
  description: "Let users sign in with Google accounts.",
  reason: "",
  impact: "high",
};

function create(state: TrackerState, input: NewAssumption): TrackerState {
  return applyEvent(state, buildCreatedEvent(state, input, "agent", T0));
}

const oneItem = () => create(createEmptyState(), sqlite);

describe("create", () => {
  it("creates a pending item with a sequential ID", () => {
    const state = create(oneItem(), login);
    expect([...state.assumptions.keys()]).toEqual(["A-001", "A-002"]);
    expect(state.assumptions.get("A-001")).toMatchObject({ ...sqlite, status: "pending", origin: "agent", createdAt: T0 });
    expect(nextId(state)).toBe("A-003");
  });

  it("rejects a reused ID and a non-pending new item", () => {
    const state = oneItem();
    const reused = buildCreatedEvent(createEmptyState(), login, "agent", T0); // also A-001
    expect(checkEvent(state, reused)).toMatch(/already exists/);
    expect(applyEvent(state, reused)).toBe(state);

    const sneaky = buildCreatedEvent(state, login, "agent", T0);
    sneaky.assumption.status = "accepted";
    expect(checkEvent(state, sneaky)).toMatch(/must start as pending/);
  });

  it("does not mutate the previous state", () => {
    const before = oneItem();
    create(before, login);
    expect(before.assumptions.size).toBe(1);
    expect(before.nextNumber).toBe(2);
  });
});

describe("findDuplicate", () => {
  it("matches normalized title or description and returns the original item", () => {
    const state = oneItem();
    expect(findDuplicate(state, { ...sqlite, title: "  use sqlite   DATABASE " })?.id).toBe("A-001");
    expect(findDuplicate(state, { ...sqlite, title: "Other title" })?.id).toBe("A-001");
    expect(findDuplicate(state, login)).toBeUndefined();
  });

  it("ignores rejected items", () => {
    const state = applyEvent(oneItem(), buildReviewedEvent("A-001", "rejected", T1));
    expect(findDuplicate(state, sqlite)).toBeUndefined();
  });
});

describe("review", () => {
  const review = (state: TrackerState, ...args: Parameters<typeof buildReviewedEvent>) =>
    applyEvent(state, buildReviewedEvent(...args));

  it("accepts a pending item", () => {
    const a = review(oneItem(), "A-001", "accepted", T1).assumptions.get("A-001")!;
    expect(a).toMatchObject({ status: "accepted", updatedAt: T1, createdAt: T0 });
  });

  it("corrects with normalized replacement text", () => {
    const a = review(oneItem(), "A-001", "corrected", T1, "  Use   PostgreSQL ").assumptions.get("A-001")!;
    expect(a).toMatchObject({ status: "corrected", correction: "Use PostgreSQL" });
  });

  it("refuses a correction without replacement text", () => {
    const state = oneItem();
    for (const text of [undefined, "", "   "]) {
      const e = buildReviewedEvent("A-001", "corrected", T1, text);
      expect(checkEvent(state, e)).toMatch(/correction must/);
      expect(applyEvent(state, e)).toBe(state);
    }
  });

  it("refuses replacement text on non-correction actions", () => {
    expect(checkEvent(oneItem(), buildReviewedEvent("A-001", "accepted", T1, "Use PostgreSQL"))).toMatch(/Only a correction/);
  });

  it("defers, keeps the note, and allows a later review", () => {
    const deferred = review(oneItem(), "A-001", "deferred", T1, undefined, "Ask the team");
    expect(deferred.assumptions.get("A-001")).toMatchObject({ status: "deferred", reviewNote: "Ask the team" });
    expect(checkEvent(deferred, buildReviewedEvent("A-001", "deferred", T1))).toMatch(/already deferred/);

    const accepted = review(deferred, "A-001", "accepted", T1);
    expect(accepted.assumptions.get("A-001")).toMatchObject({ status: "accepted", reviewNote: "Ask the team" });
  });

  it("rejects a pending item", () => {
    expect(review(oneItem(), "A-001", "rejected", T1).assumptions.get("A-001")!.status).toBe("rejected");
  });

  it("does not silently modify a final item", () => {
    for (const status of ["accepted", "rejected"] as const) {
      const final = review(oneItem(), "A-001", status, T1);
      const again = buildReviewedEvent("A-001", "corrected", T1, "Use PostgreSQL");
      expect(checkEvent(final, again)).toMatch(/not supported in v1/);
      expect(applyEvent(final, again)).toBe(final);
    }
  });

  it("rejects an unknown ID without changing state", () => {
    const state = oneItem();
    const e = buildReviewedEvent("A-999", "accepted", T1);
    expect(checkEvent(state, e)).toMatch(/Unknown assumption ID/);
    expect(applyEvent(state, e)).toBe(state);
  });
});

describe("replayEvents", () => {
  const events: TrackerEvent[] = (() => {
    const e1 = buildCreatedEvent(createEmptyState(), sqlite, "agent", T0);
    const s1 = applyEvent(createEmptyState(), e1);
    const e2 = buildCreatedEvent(s1, login, "user", T0);
    return [e1, e2, buildReviewedEvent("A-001", "corrected", T1, "Use PostgreSQL")];
  })();

  it("replays created + reviewed deterministically", () => {
    const first = replayEvents(events);
    const second = replayEvents(structuredClone(events));
    expect(first.skipped).toBe(0);
    expect(first.state).toEqual(second.state);
    expect(first.state.assumptions.get("A-001")).toMatchObject({ status: "corrected", correction: "Use PostgreSQL" });
    expect(first.state.assumptions.get("A-002")).toMatchObject({ status: "pending", origin: "user" });
  });

  it("skips malformed, future-version, and inapplicable entries but keeps good ones", () => {
    const { state, skipped } = replayEvents([
      events[0],
      null,
      { version: 2, event: "created", assumption: events[1] },
      buildReviewedEvent("A-404", "accepted", T1), // unknown ID
      events[0], // duplicate create
      events[1],
    ]);
    expect(skipped).toBe(4);
    expect([...state.assumptions.keys()]).toEqual(["A-001", "A-002"]);
  });

  it("derives the next ID from the highest replayed ID", () => {
    const gap = structuredClone(events[1]) as Extract<TrackerEvent, { event: "created" }>;
    gap.assumption.id = "A-007";
    expect(nextId(replayEvents([events[0], gap]).state)).toBe("A-008");
    expect(nextId(replayEvents([]).state)).toBe("A-001");
  });
});

describe("awaitingReview and countByStatus", () => {
  it("lists pending and deferred items in ID order and counts every status", () => {
    let state = createEmptyState();
    const inputs = ["one", "two", "three", "four"].map((w) => ({
      ...sqlite,
      title: `Item ${w}`,
      description: `Description for item ${w}.`,
    }));
    for (const input of inputs) state = create(state, input);
    state = applyEvent(state, buildReviewedEvent("A-002", "deferred", T1));
    state = applyEvent(state, buildReviewedEvent("A-003", "rejected", T1));

    expect(awaitingReview(state).map((a) => [a.id, a.status])).toEqual([
      ["A-001", "pending"],
      ["A-002", "deferred"],
      ["A-004", "pending"],
    ]);
    expect(countByStatus(state)).toEqual({ pending: 2, accepted: 0, corrected: 0, deferred: 1, rejected: 1 });
    expect(countByStatus(createEmptyState())).toEqual({ pending: 0, accepted: 0, corrected: 0, deferred: 0, rejected: 0 });
  });
});
