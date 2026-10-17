import { SessionManager } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import assumptionTracker from "../src/extension.ts";

const sqlite = {
  title: "Use SQLite database",
  description: "Store attendance records in a local SQLite database.",
  reason: "No database was specified.",
  impact: "medium",
};
const auth = { title: "No authentication", description: "Anyone can mark attendance without logging in.", impact: "high" };

function harness(sm = SessionManager.inMemory("/project")) {
  const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
  const commands = new Map<string, any>();
  let tool: any;
  const answers: (string | undefined)[] = [];
  const notifications: string[] = [];
  const ctx: any = {
    hasUI: true,
    sessionManager: sm,
    ui: {
      setStatus: () => {},
      notify: (m: string) => notifications.push(m),
      select: async (_t: string, options: string[]) => {
        const r = answers.shift();
        return r === undefined ? undefined : options.find((o) => o.startsWith(r));
      },
      input: async () => answers.shift(),
    },
  };
  const pi: any = {
    registerTool: (t: any) => (tool = t),
    registerCommand: (name: string, o: any) => commands.set(name, o),
    on: (name: string, h: any) => handlers.set(name, h),
    appendEntry: (type: string, data: unknown) => ctx.sessionManager.appendCustomEntry(type, data),
  };
  assumptionTracker(pi);
  handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);

  return {
    ctx,
    notifications,
    get sm(): SessionManager {
      return ctx.sessionManager;
    },
    async record(params: Record<string, unknown>) {
      const before = ctx.sessionManager.getLeafId();
      const result = await tool.execute("call", params, undefined, undefined, ctx);
      const leaf = ctx.sessionManager.getLeafId();
      return { id: result.details.id as string, duplicate: result.details.duplicate as boolean, entryId: leaf !== before ? leaf : undefined };
    },
    async review(id: string, replies: (string | undefined)[]) {
      answers.push(...replies);
      await commands.get("review-assumption").handler(id, ctx);
      return ctx.sessionManager.getLeafId() as string;
    },
    async list() {
      await commands.get("assumptions").handler("all", ctx);
      return notifications.at(-1)!;
    },
    navigate(entryId: string) {
      ctx.sessionManager.branch(entryId);
      handlers.get("session_tree")!({ type: "session_tree" }, ctx);
    },
    async startRun(messageType: "user" | "custom" = "user") {
      const result: any = await handlers.get("before_agent_start")!(
        { type: "before_agent_start", messageType, prompt: "continue", systemPrompt: "", systemPromptOptions: {} },
        ctx,
      );
      if (messageType === "user") ctx.sessionManager.appendMessage({ role: "user", content: "continue", timestamp: Date.now() });
      if (result?.message) {
        const { customType, content, display } = result.message;
        ctx.sessionManager.appendCustomMessageEntry(customType, content, display);
      }
      return result?.message as { customType: string; content: string; display: boolean } | undefined;
    },
    switchTo(next: SessionManager, reason = "resume") {
      ctx.sessionManager = next;
      handlers.get("session_start")!({ type: "session_start", reason }, ctx);
    },
  };
}

describe("branch navigation (session_tree)", () => {
  it("a branch made before a review shows the item as pending, and returning restores the decision", async () => {
    const h = harness();
    const { entryId: created } = await h.record(sqlite);
    const reviewed = await h.review("A-001", ["Correct", "Use PostgreSQL", ""]);
    expect(await h.list()).toContain("Corrected to: Use PostgreSQL");

    h.navigate(created!);
    const before = await h.list();
    expect(before).toContain("A-001 | Use SQLite database | medium | pending");
    expect(before).not.toContain("PostgreSQL");

    h.navigate(reviewed);
    expect(await h.list()).toContain("A-001 | Use SQLite database | medium | corrected");
  });

  it("each branch can hold its own decision for the same item", async () => {
    const h = harness();
    const { entryId: created } = await h.record(sqlite);
    const corrected = await h.review("A-001", ["Correct", "Use PostgreSQL", ""]);

    h.navigate(created!);
    const rejected = await h.review("A-001", ["Reject", ""]);
    expect(await h.list()).toContain("| rejected");

    h.navigate(corrected);
    expect(await h.list()).toContain("| corrected");
    h.navigate(rejected);
    expect(await h.list()).toContain("| rejected");
    expect(h.sm.getEntries().filter((e: any) => e.data?.event === "reviewed")).toHaveLength(2);
  });

  it("assigns IDs and detects duplicates from the active branch only", async () => {
    const h = harness();
    const { entryId: first } = await h.record(sqlite);
    await h.record(auth);

    h.navigate(first!);
    expect(await h.record(auth)).toMatchObject({ id: "A-002", duplicate: false });
    expect(await h.record(sqlite)).toMatchObject({ id: "A-001", duplicate: true });
    expect(await h.list()).toMatch(/2 pending/);
  });

  it("navigating to before the first assumption empties the list", async () => {
    const sm = SessionManager.inMemory("/project");
    const root = sm.appendCustomEntry("other-extension", { unrelated: true });
    const h = harness(sm);
    await h.record(sqlite);
    h.navigate(root);
    expect(await h.list()).toBe("No assumptions recorded in this session branch.");
    expect((await h.record(sqlite)).id).toBe("A-001");
  });
});

describe("session switches (session_start)", () => {
  it("a new session starts empty and an unrelated session's items never appear", async () => {
    const h = harness();
    await h.record(sqlite);
    const original = h.sm;

    h.switchTo(SessionManager.inMemory("/project"), "new");
    expect(await h.list()).toBe("No assumptions recorded in this session branch.");
    await h.record(auth);
    expect(await h.list()).toContain("A-001 | No authentication");

    h.switchTo(original);
    const back = await h.list();
    expect(back).toContain("A-001 | Use SQLite database");
    expect(back).not.toContain("No authentication");
  });

  it("a resumed session (fresh runtime, same entries) restores items and decisions", async () => {
    const h = harness();
    await h.record(sqlite);
    await h.review("A-001", ["Defer", "later"]);
    const resumed = harness(h.sm);
    expect(await resumed.list()).toContain("A-001 | Use SQLite database | medium | deferred");
    expect((await resumed.record(auth)).id).toBe("A-002");
  });

  it("warns that a review is not on disk yet until the session has a chat message", async () => {
    const h = harness();
    await h.record(sqlite);
    await h.review("A-001", ["Defer", ""]);
    expect(h.notifications.at(-1)).toMatch(/marked deferred\..*not on disk until you send a first message/);

    h.sm.appendMessage({ role: "user", content: "hello", timestamp: Date.now() } as any);
    await h.review("A-001", ["Accept", ""]);
    expect(h.notifications.at(-1)).toBe("A-001 marked accepted. The agent sees this on your next message.");
  });

  it("restoring never writes entries", () => {
    const h = harness();
    const count = h.sm.getEntries().length;
    h.navigate(h.sm.appendCustomEntry("other-extension", {}));
    h.switchTo(h.sm);
    expect(h.sm.getEntries().length).toBe(count + 1);
  });
});

describe("decision context for the agent (before_agent_start)", () => {
  it("injects nothing until a decision exists, then the corrected decision on the next user run", async () => {
    const h = harness();
    await h.record(sqlite);
    expect(await h.startRun()).toBeUndefined();
    await h.review("A-001", ["Correct", "Use PostgreSQL", ""]);

    const message = await h.startRun();
    expect(message).toMatchObject({ customType: "assumption-tracker-decisions", display: true });
    expect(message!.content).toContain('- A-001 CORRECTED: instead of "Use SQLite database", do "Use PostgreSQL".');
  });

  it("does not repeat an unchanged summary, but re-sends after a new decision", async () => {
    const h = harness();
    await h.record(sqlite);
    await h.record(auth);
    await h.review("A-001", ["Accept", ""]);
    expect(await h.startRun()).toBeDefined();
    expect(await h.startRun()).toBeUndefined();

    await h.review("A-002", ["Reject", ""]);
    const updated = await h.startRun();
    expect(updated!.content).toContain("A-002 REJECTED");
    expect(updated!.content).toContain("A-001 ACCEPTED");
  });

  it("ignores runs started by custom messages", async () => {
    const h = harness();
    await h.record(sqlite);
    await h.review("A-001", ["Accept", ""]);
    expect(await h.startRun("custom")).toBeUndefined();
  });

  it("follows the branch: no decision before the review, re-sent after returning to a branch without it", async () => {
    const h = harness();
    const { entryId: created } = await h.record(sqlite);
    await h.review("A-001", ["Correct", "Use PostgreSQL", ""]);
    expect(await h.startRun()).toBeDefined();

    h.navigate(created!);
    expect(await h.startRun()).toBeUndefined();

    await h.review("A-001", ["Reject", ""]);
    expect((await h.startRun())!.content).toContain("A-001 REJECTED");
  });

  it("does not write entries or start a run when a review happens", async () => {
    const h = harness();
    await h.record(sqlite);
    const before = h.sm.getEntries().length;
    await h.review("A-001", ["Accept", ""]);
    const added = h.sm.getEntries().slice(before).map((e: any) => e.type);
    expect(added).toEqual(["custom"]);
  });
});
