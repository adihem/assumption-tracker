import { describe, expect, it } from "vitest";
import { normalizeText, parseEvent, validateNewAssumption } from "../src/validation.ts";

const valid = {
  title: "Use SQLite database",
  description: "Store attendance records in a local SQLite database.",
  reason: "No database was specified.",
  impact: "medium",
};

describe("validateNewAssumption", () => {
  it("accepts a valid low-impact assumption", () => {
    const r = validateNewAssumption({ ...valid, impact: "low" });
    expect(r).toEqual({ ok: true, value: { ...valid, impact: "low" } });
  });

  it("rejects an empty or whitespace-only title", () => {
    for (const title of ["", "   "]) {
      const r = validateNewAssumption({ ...valid, title });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]).toMatch(/title must be at least 3/);
    }
  });

  it("rejects an invalid impact", () => {
    const r = validateNewAssumption({ ...valid, impact: "critical" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(["impact must be one of: low, medium, high."]);
  });

  it("rejects too-long text instead of truncating", () => {
    const r = validateNewAssumption({ ...valid, description: "x".repeat(501) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/at most 500 characters \(got 501\)/);
  });

  it("rejects non-string fields", () => {
    const r = validateNewAssumption({ ...valid, title: 42 });
    expect(r.ok).toBe(false);
  });

  it("reports every invalid field at once", () => {
    const r = validateNewAssumption({ title: "", description: "", impact: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });

  it("normalizes whitespace and allows a missing reason", () => {
    const r = validateNewAssumption({ ...valid, title: "  Use   SQLite\n database ", reason: undefined });
    expect(r).toEqual({ ok: true, value: { ...valid, title: "Use SQLite database", reason: "" } });
  });
});

describe("normalizeText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeText("\t a  b \n c ")).toBe("a b c");
  });
});

describe("parseEvent", () => {
  it("rejects malformed and future-version entries", () => {
    expect(parseEvent(null)).toBeUndefined();
    expect(parseEvent("text")).toBeUndefined();
    expect(parseEvent({ version: 2, event: "reviewed", id: "A-001", status: "accepted", timestamp: "t" })).toBeUndefined();
    expect(parseEvent({ version: 1, event: "deleted", id: "A-001" })).toBeUndefined();
    expect(parseEvent({ version: 1, event: "reviewed", id: "A-001", status: "pending", timestamp: "t" })).toBeUndefined();
    expect(parseEvent({ version: 1, event: "created", assumption: { id: "A-001" } })).toBeUndefined();
  });

  it("accepts a well-formed reviewed event", () => {
    const e = { version: 1, event: "reviewed", id: "A-001", status: "accepted", timestamp: "t" };
    expect(parseEvent(e)).toEqual(e);
  });
});
