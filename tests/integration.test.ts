import { describe, expect, it } from "vitest";
import assumptionTracker from "../src/extension.ts";
import { ASSUMPTION_ENTRY_TYPE } from "../src/types.ts";

type Entry = { type: string; customType?: string; data?: unknown };

/** Minimal stand-in for the parts of Pi the extension uses. The branch is shared, so a new mock can "resume" it. */
function mockPi(branch: Entry[] = [], hasUI = true) {
  const tools = new Map<string, any>();
  const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
  const statuses: (string | undefined)[] = [];
  const notifications: string[] = [];
  let failAppend = false;
  const pi = {
    registerTool: (tool: any) => tools.set(tool.name, tool),
    registerCommand: () => {},
    on: (name: string, handler: any) => handlers.set(name, handler),
    appendEntry: (customType: string, data: unknown) => {
      if (failAppend) throw new Error("disk full");
      branch.push({ type: "custom", customType, data: structuredClone(data) });
    },
  };
  const ctx = {
    hasUI,
    sessionManager: { getBranch: () => branch },
    ui: {
      setStatus: (_key: string, text: string | undefined) => statuses.push(text),
      notify: (message: string) => notifications.push(message),
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
    emit: (name: string) => handlers.get(name)!({ type: name }, ctx),
    call: (params: Record<string, unknown>) => tool.execute("call-1", params, undefined, undefined, ctx),
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

    const resumed = mockPi(first.branch); // new extension runtime, same session branch
    expect(resumed.statuses.at(-1)).toBe("Assumptions: 1 pending");
    expect(text(await resumed.call(sqlite))).toMatch(/Already recorded as A-001/);
    const next = await resumed.call({ ...sqlite, title: "Use REST API", description: "Expose a JSON REST API." });
    expect(next.details.id).toBe("A-002");
  });

  it("rebuilds from the active branch on session_tree", async () => {
    const branch: Entry[] = [];
    const m = mockPi(branch);
    await m.call(sqlite);
    branch.length = 0; // navigate to a point before the assumption was recorded
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
