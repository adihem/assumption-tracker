import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { statusText } from "./formatter.ts";
import { loadState } from "./persistence.ts";
import { applyEvent, buildCreatedEvent, createEmptyState, findDuplicate } from "./state.ts";
import { ASSUMPTION_ENTRY_TYPE, IMPACTS, LIMITS, type Assumption, type Origin, type TrackerState } from "./types.ts";
import { validateNewAssumption } from "./validation.ts";

const STATUS_KEY = "assumption-tracker";

const RecordParams = Type.Object({
  title: Type.String({ description: `Short label, ${LIMITS.title[0]}-${LIMITS.title[1]} characters.` }),
  description: Type.String({
    description: `What you assumed, ${LIMITS.description[0]}-${LIMITS.description[1]} characters. No secrets or code.`,
  }),
  reason: Type.Optional(Type.String({ description: `Why you chose it, up to ${LIMITS.reason[1]} characters.` })),
  impact: StringEnum(IMPACTS, { description: "Your proposed impact if the user disagrees with this choice." }),
});

export type RecordResult = { recorded: true; assumption: Assumption } | { recorded: false; existing: Assumption };

export default function assumptionTracker(pi: ExtensionAPI) {
  let state: TrackerState = createEmptyState();

  const refreshStatus = (ctx: ExtensionContext) => {
    if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, statusText(state));
  };

  const restore = (ctx: ExtensionContext) => {
    const loaded = loadState(ctx.sessionManager);
    state = loaded.state;
    if (loaded.skipped > 0 && ctx.hasUI) {
      ctx.ui.notify(`Assumption Tracker skipped ${loaded.skipped} invalid saved entr${loaded.skipped === 1 ? "y" : "ies"}.`, "warning");
    }
    refreshStatus(ctx);
  };

  /**
   * Validate → duplicate check → persist → commit. Synchronous from read to write, so concurrent
   * tool calls cannot interleave (plan §9.9). If appendEntry throws, in-memory state is left unchanged.
   */
  const record = (input: Record<string, unknown>, origin: Origin): RecordResult => {
    const valid = validateNewAssumption(input);
    if (!valid.ok) throw new Error(`Assumption not recorded: ${valid.errors.join(" ")}`);
    const existing = findDuplicate(state, valid.value);
    if (existing) return { recorded: false, existing };
    const event = buildCreatedEvent(state, valid.value, origin, new Date().toISOString());
    pi.appendEntry(ASSUMPTION_ENTRY_TYPE, event);
    state = applyEvent(state, event);
    return { recorded: true, assumption: event.assumption };
  };

  pi.on("session_start", (_event, ctx) => restore(ctx));
  pi.on("session_tree", (_event, ctx) => restore(ctx));

  pi.registerTool({
    name: "record_assumption",
    label: "Record assumption",
    description:
      "Record a candidate assumption: a meaningful default or design interpretation you chose that the user did not specify. " +
      "Recording does not mean the user approved it; the user reviews it later.",
    promptSnippet: "Record an unstated design choice you made so the user can review it later",
    promptGuidelines: [
      "Call record_assumption when you choose a meaningful default or design interpretation the user did not specify, especially choices affecting data storage, security, dependencies, interoperability, or work that is expensive to reverse.",
      "Do not record requirements the user stated explicitly, and do not record trivial implementation details unless they affect the user's goals.",
      "Keep the description concise and never include secrets or code. Recording an assumption does not mean the user approved it.",
      "This also applies when you only describe a plan: record_assumption does not create or change project files, so use it even when told not to create files.",
    ],
    parameters: RecordParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = record(params, "agent");
      refreshStatus(ctx);
      const a = result.recorded ? result.assumption : result.existing;
      let text = result.recorded
        ? `Recorded ${a.id} (pending user review). This is not user approval; continue with the task.`
        : `Already recorded as ${a.id} (status: ${a.status}); not recorded again.`;
      if (!result.recorded && a.status === "corrected") text += ` The user corrected it to: ${a.correction}`;
      return { content: [{ type: "text", text }], details: { id: a.id, duplicate: !result.recorded } };
    },
  });

  pi.registerCommand("tracker-hello", {
    description: "Check that the Assumption Tracker extension is loaded",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      const active = pi.getActiveTools().includes("record_assumption");
      ctx.ui.notify(`Assumption Tracker loaded. record_assumption tool: ${active ? "active" : "NOT active"}.`, "info");
    },
  });
}
