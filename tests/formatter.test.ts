import { describe, expect, it } from "vitest";
import { detailText, listText, statusText, truncate } from "../src/formatter.ts";
import { applyEvent, buildCreatedEvent, buildReviewedEvent, createEmptyState } from "../src/state.ts";
import type { NewAssumption, TrackerState } from "../src/types.ts";

const T = "2026-10-17T08:00:00.000Z";
const item = (n: number): NewAssumption => ({
  title: `Choice ${n}`,
  description: `Description of choice number ${n}.`,
  reason: "",
  impact: "low",
});
function stateWith(count: number): TrackerState {
  let s = createEmptyState();
  for (let n = 1; n <= count; n++) s = applyEvent(s, buildCreatedEvent(s, item(n), "agent", T));
  return s;
}

describe("listText", () => {
  it("shows a helpful message for an empty state", () => {
    expect(listText(createEmptyState(), false)).toBe("No assumptions recorded in this session branch.");
  });

  it("labels items as agent-reported candidates", () => {
    expect(listText(stateWith(1), false)).toMatch(/^Agent-reported assumptions \(candidates, not verified facts\)/);
  });

  it("puts unresolved items first, then sorts by numeric ID", () => {
    let s = stateWith(11);
    s = applyEvent(s, buildReviewedEvent("A-001", "accepted", T));
    s = applyEvent(s, buildReviewedEvent("A-010", "deferred", T));
    const ids = [...listText(s, true).matchAll(/^(A-\d+) \|/gm)].map((m) => m[1]);
    expect(ids).toEqual(["A-002", "A-003", "A-004", "A-005", "A-006", "A-007", "A-008", "A-009", "A-011", "A-010", "A-001"]);
    expect(listText(s, false)).not.toContain("A-001 |");
  });

  it("truncates long descriptions in the list but not in the detail view", () => {
    let s = createEmptyState();
    s = applyEvent(s, buildCreatedEvent(s, { ...item(1), description: "x".repeat(300) }, "agent", T));
    expect(listText(s, false)).toContain(`${"x".repeat(99)}…`);
    expect(listText(s, false)).not.toContain("x".repeat(101));
    expect(detailText(s.assumptions.get("A-001")!)).toContain("x".repeat(300));
  });
});

describe("statusText and truncate", () => {
  it("summarizes pending/deferred and clears when nothing awaits review", () => {
    expect(statusText(stateWith(2))).toBe("Assumptions: 2 pending");
    expect(statusText(createEmptyState())).toBeUndefined();
  });

  it("truncate keeps short text unchanged", () => {
    expect(truncate("abc", 3)).toBe("abc");
    expect(truncate("abcd", 3)).toBe("ab…");
  });
});
