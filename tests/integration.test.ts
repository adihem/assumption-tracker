import { describe, expect, it } from "vitest";
import assumptionTracker from "../src/extension.ts";
import { ASSUMPTION_ENTRY_TYPE } from "../src/types.ts";

type Entry = { type: string; customType?: string; data?: unknown };

function mockPi(branch: Entry[] = [], hasUI = true) {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
  const statuses: (string | undefined)[] = [];
  const notifications: string[] = [];
  const answers: (string | undefined)[] = [];
  const prompts: string[] = [];
  const answer = async (title: string, options?: string[]) => {
    prompts.push(title);
    if (answers.length === 0) throw new Error(`unexpected dialog: ${title}`);
    const reply = answers.shift();
    return options && reply !== undefined ? options.find((o) => o.startsWith(reply)) ?? reply : reply;
  };
  let failAppend = false;
  const pi = {
    registerTool: (tool: any) => tools.set(tool.name, tool),
    registerCommand: (name: string, options: any) => commands.set(name, options),
    on: (name: string, handler: any) => handlers.set(name, handler),
    appendEntry: (customType: string, data: unknown) => {
      if (failAppend) throw new Error("disk full");
      branch.push({ type: "custom", customType, data: structuredClone(data) });
    },
  };
  const ctx = {
    hasUI,
    sessionManager: { getBranch: () => branch, getEntries: () => [{ type: "message", message: { role: "user" } }, ...branch] },
    ui: {
      setStatus: (_key: string, text: string | undefined) => statuses.push(text),
      notify: (message: string) => notifications.push(message),
      select: (title: string, options: string[]) => answer(title, options),
      input: (title: string) => answer(title),
    },
  };
  assumptionTracker(pi as any);
  handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  const tool = tools.get("record_assumption");
  return {
    branch,
    tool,
    statuses,
    notifications,
    setFailAppend: (v: boolean) => (failAppend = v),
    prompts,
    emit: (name: string) => handlers.get(name)!({ type: name }, ctx),
    call: (params: Record<string, unknown>) => tool.execute("call-1", params, undefined, undefined, ctx),
    run: async (name: string, args = "", replies: (string | undefined)[] = []) => {
      answers.push(...replies);
      await commands.get(name)!.handler(args, ctx);
      expect(answers, "unused scripted answers").toEqual([]);
    },
    commandNames: () => [...commands.keys()],
  };
}

const sqlite = {
  title: "Use SQLite database",
  description: "Store attendance records in a local SQLite database.",
  reason: "The task did not specify a database.",
  impact: "medium",
};
const text = (result: any) => result.content[0].text as string;

describe("record_assumption tool", () => {
  it("is registered with the required fields and schema", () => {
    const { tool } = mockPi();
    expect(tool).toMatchObject({ name: "record_assumption", label: "Record assumption" });
    expect(tool.description).toMatch(/does not mean the user approved/);
    expect(tool.promptGuidelines.length).toBeGreaterThan(0);
    expect(Object.keys(tool.parameters.properties)).toEqual(["title", "description", "reason", "impact"]);
    expect(tool.parameters.required).toEqual(["title", "description", "impact"]);
  });

  it("persists exactly one created event and returns the ID", async () => {
    const m = mockPi();
    const result = await m.call(sqlite);
    expect(text(result)).toMatch(/^Recorded A-001 \(pending user review\)/);
    expect(result.details).toEqual({ id: "A-001", duplicate: false });
    expect(m.branch).toHaveLength(1);
    expect(m.branch[0]).toMatchObject({
      type: "custom",
      customType: ASSUMPTION_ENTRY_TYPE,
      data: { version: 1, event: "created", assumption: { id: "A-001", status: "pending", origin: "agent" } },
    });
    expect(m.statuses.at(-1)).toBe("Assumptions: 1 pending");
  });

  it("rejects invalid input before persisting anything", async () => {
    const m = mockPi();
    await expect(m.call({ ...sqlite, title: " ", impact: "huge" })).rejects.toThrow(
      /Assumption not recorded: title must be at least 3 characters\. impact must be one of/,
    );
    expect(m.branch).toHaveLength(0);
  });

  it("returns the existing ID for a duplicate without persisting again", async () => {
    const m = mockPi();
    await m.call(sqlite);
    const again = await m.call({ ...sqlite, title: "  use sqlite DATABASE " });
    expect(text(again)).toBe("Already recorded as A-001 (status: pending); not recorded again.");
    expect(again.details).toEqual({ id: "A-001", duplicate: true });
    expect(m.branch).toHaveLength(1);
  });

  it("assigns unique IDs to calls arriving together", async () => {
    const m = mockPi();
    const results = await Promise.all(
      ["one", "two", "three"].map((w) => m.call({ ...sqlite, title: `Choice ${w}`, description: `Description of choice ${w}.` })),
    );
    expect(results.map((r) => r.details.id)).toEqual(["A-001", "A-002", "A-003"]);
    expect(m.branch).toHaveLength(3);
  });

  it("leaves state unchanged when persistence fails", async () => {
    const m = mockPi();
    m.setFailAppend(true);
    await expect(m.call(sqlite)).rejects.toThrow("disk full");
    m.setFailAppend(false);
    expect((await m.call(sqlite)).details).toEqual({ id: "A-001", duplicate: false });
  });

  it("works without a UI", async () => {
    const m = mockPi([], false);
    expect((await m.call(sqlite)).details.id).toBe("A-001");
    expect(m.statuses).toEqual([]);
  });
});

describe("session restore", () => {
  it("restores recorded assumptions on session_start (resume)", async () => {
    const first = mockPi();
    await first.call(sqlite);

    const resumed = mockPi(first.branch);
    expect(resumed.statuses.at(-1)).toBe("Assumptions: 1 pending");
    expect(text(await resumed.call(sqlite))).toMatch(/Already recorded as A-001/);
    const next = await resumed.call({ ...sqlite, title: "Use REST API", description: "Expose a JSON REST API." });
    expect(next.details.id).toBe("A-002");
  });

  it("rebuilds from the active branch on session_tree", async () => {
    const branch: Entry[] = [];
    const m = mockPi(branch);
    await m.call(sqlite);
    branch.length = 0;
    m.emit("session_tree");
    expect(m.statuses.at(-1)).toBeUndefined();
    expect((await m.call(sqlite)).details).toEqual({ id: "A-001", duplicate: false });
  });

  it("skips invalid saved entries with a warning and keeps good ones", async () => {
    const first = mockPi();
    await first.call(sqlite);
    first.branch.push({ type: "custom", customType: ASSUMPTION_ENTRY_TYPE, data: { version: 99 } });
    first.branch.push({ type: "custom", customType: "other-extension", data: { version: 99 } });

    const resumed = mockPi(first.branch);
    expect(resumed.notifications).toEqual(["Assumption Tracker skipped 1 invalid saved entry."]);
    expect(resumed.statuses.at(-1)).toBe("Assumptions: 1 pending");
  });
});

describe("review commands", () => {
  const reviewEvents = (branch: Entry[]) => branch.filter((e: any) => e.data?.event === "reviewed").map((e) => e.data);
  async function withOne(hasUI = true) {
    const m = mockPi([], hasUI);
    await m.call(sqlite);
    return m;
  }

  it("registers the Phase 3 commands", () => {
    expect(mockPi().commandNames()).toEqual(
      expect.arrayContaining(["assumptions", "review-assumption", "add-assumption", "assumptions-help"]),
    );
  });

  it("/assumptions lists unresolved items, and 'all' adds reviewed ones", async () => {
    const m = await withOne();
    await m.run("assumptions");
    expect(m.notifications.at(-1)).toMatch(/^Agent-reported assumptions.*1 pending/);
    expect(m.notifications.at(-1)).toContain("A-001 | Use SQLite database | medium | pending");

    await m.run("review-assumption", "", ["A-001", "Accept", ""]);
    await m.run("assumptions");
    expect(m.notifications.at(-1)).toMatch(/No assumptions awaiting review/);
    await m.run("assumptions", "all");
    expect(m.notifications.at(-1)).toContain("A-001 | Use SQLite database | medium | accepted");
  });

  it("accepts via the selector with one persisted review event", async () => {
    const m = await withOne();
    await m.run("review-assumption", "", ["A-001", "Accept", ""]);
    expect(reviewEvents(m.branch)).toEqual([expect.objectContaining({ id: "A-001", status: "accepted" })]);
    expect(m.notifications.at(-1)).toBe("A-001 marked accepted. The agent sees this on your next message.");
    expect(m.statuses.at(-1)).toBeUndefined();
    expect(m.prompts[1]).toContain("Assumption: Store attendance records in a local SQLite database.");
  });

  it("corrects, re-asking until the replacement is non-empty, and saves the note", async () => {
    const m = await withOne();
    await m.run("review-assumption", "a-001", ["Correct", "   ", "Use PostgreSQL", "Multiple users"]);
    expect(m.notifications).toContain("correction must not be empty. Try again, or press Esc to cancel.");
    expect(reviewEvents(m.branch)).toEqual([
      expect.objectContaining({ status: "corrected", correction: "Use PostgreSQL", reviewNote: "Multiple users" }),
    ]);
  });

  it("defers, then allows a later review without offering Defer again", async () => {
    const m = await withOne();
    await m.run("review-assumption", "A-001", ["Defer", "Ask the team"]);
    expect(m.statuses.at(-1)).toBe("Assumptions: 0 pending, 1 deferred");

    await m.run("review-assumption", "A-001", ["Reject", ""]);
    expect(m.prompts.at(-2)).toContain("Status: deferred");
    expect(reviewEvents(m.branch).map((e: any) => e.status)).toEqual(["deferred", "rejected"]);
  });

  it("Esc or Cancel at any step persists nothing", async () => {
    const m = await withOne();
    await m.run("review-assumption", "", [undefined]);
    await m.run("review-assumption", "A-001", ["Cancel"]);
    await m.run("review-assumption", "A-001", [undefined]);
    await m.run("review-assumption", "A-001", ["Correct", undefined]);
    await m.run("review-assumption", "A-001", ["Accept", undefined]);
    expect(reviewEvents(m.branch)).toEqual([]);
    expect(m.statuses.at(-1)).toBe("Assumptions: 1 pending");
  });

  it("reports unknown IDs, final items, and an empty review queue without changing state", async () => {
    const m = await withOne();
    await m.run("review-assumption", "A-404");
    expect(m.notifications.at(-1)).toMatch(/Unknown assumption ID "A-404"/);

    await m.run("review-assumption", "A-001", ["Reject", ""]);
    await m.run("review-assumption", "A-001");
    expect(m.notifications.at(-1)).toMatch(/already rejected; re-reviewing a final decision is not supported/);
    await m.run("review-assumption");
    expect(m.notifications.at(-1)).toBe("No assumptions awaiting review.");
    expect(reviewEvents(m.branch)).toHaveLength(1);
  });

  it("/add-assumption records a user-origin item, and rejects invalid input or duplicates", async () => {
    const m = mockPi();
    await m.run("add-assumption", "", ["No authentication", "Anyone can mark attendance without logging in.", "", "high"]);
    expect(m.branch.at(-1)).toMatchObject({ data: { assumption: { id: "A-001", origin: "user", impact: "high", reason: "" } } });
    expect(m.notifications.at(-1)).toBe("Added A-001 (pending). Review it with /review-assumption.");

    await m.run("add-assumption", "", ["No", "Too short", "", "low"]);
    expect(m.notifications.at(-1)).toMatch(/Assumption not recorded: title must be at least 3 characters/);
    await m.run("add-assumption", "", ["no authentication", "Different description text here.", "", "low"]);
    expect(m.notifications.at(-1)).toBe("Already recorded as A-001 (pending); nothing added.");
    await m.run("add-assumption", "", ["Some title", undefined]);
    expect(m.branch).toHaveLength(1);
  });

  it("does not open dialogs without a UI", async () => {
    const m = await withOne(false);
    await m.run("review-assumption", "A-001");
    await m.run("add-assumption");
    expect(reviewEvents(m.branch)).toEqual([]);
  });

  it("re-reporting a rejected item creates a new pending item flagged as possibly related", async () => {
    const m = await withOne();
    await m.run("review-assumption", "A-001", ["Reject", ""]);
    const again = await m.call(sqlite);
    expect(again.details).toEqual({ id: "A-002", duplicate: false });
    expect(text(again)).toBe(
      "Recorded A-002 (pending user review). This is not user approval; continue with the task. " +
        "Possibly related to A-001, which the user rejected; do not act on this without asking the user.",
    );
    expect(text(await m.call({ ...sqlite, title: "Use REST API", description: "Expose a JSON REST API." }))).not.toMatch(/Possibly related/);
  });

  it("a reviewed decision survives resume", async () => {
    const m = await withOne();
    await m.run("review-assumption", "A-001", ["Correct", "Use PostgreSQL", ""]);
    const resumed = mockPi(m.branch);
    await resumed.run("assumptions", "all");
    expect(resumed.notifications.at(-1)).toContain("Corrected to: Use PostgreSQL");
    expect(text(await resumed.call(sqlite))).toBe(
      "Already recorded as A-001 (status: corrected); not recorded again. The user corrected it to: Use PostgreSQL",
    );
  });
});
