import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { detailText, HELP_TEXT, listText, reviewLabel, statusText } from "./formatter.ts";
import { hasConversation, loadState, NOT_YET_SAVED_WARNING } from "./persistence.ts";
import {
  applyEvent,
  awaitingReview,
  buildCreatedEvent,
  buildReviewedEvent,
  checkEvent,
  createEmptyState,
  findDuplicate,
} from "./state.ts";
import {
  ASSUMPTION_ENTRY_TYPE,
  IMPACTS,
  LIMITS,
  type Assumption,
  type Origin,
  type ReviewedEvent,
  type ReviewStatus,
  type TrackerState,
} from "./types.ts";
import { checkText, validateNewAssumption } from "./validation.ts";

const STATUS_KEY = "assumption-tracker";

const ACTIONS = {
  accept: "Accept: keep the original choice",
  correct: "Correct: replace it with my decision",
  defer: "Defer: decide later",
  reject: "Reject: not permitted, no replacement",
  cancel: "Cancel",
} as const;
const ACTION_STATUS: Record<string, ReviewStatus> = {
  [ACTIONS.accept]: "accepted",
  [ACTIONS.correct]: "corrected",
  [ACTIONS.defer]: "deferred",
  [ACTIONS.reject]: "rejected",
};

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

  /** Check → persist → commit, for review events. Returns an error message, or undefined on success. */
  const commit = (event: ReviewedEvent): string | undefined => {
    const error = checkEvent(state, event);
    if (error) return error;
    pi.appendEntry(ASSUMPTION_ENTRY_TYPE, event);
    state = applyEvent(state, event);
    return undefined;
  };

  const unsavedNote = (ctx: ExtensionContext) => (hasConversation(ctx.sessionManager) ? "" : NOT_YET_SAVED_WARNING);

  /** Without dialog-capable UI, explain on stderr (keeps JSON/print stdout clean) and do nothing. */
  const requireUI = (ctx: ExtensionContext, command: string): boolean => {
    if (ctx.hasUI) return true;
    console.error(`/${command} needs an interactive Pi session (TUI or RPC); nothing was changed.`);
    return false;
  };

  /** Asks for replacement text until it is valid; undefined means the user cancelled. */
  const askCorrection = async (ctx: ExtensionContext, id: string): Promise<string | undefined> => {
    for (;;) {
      const text = await ctx.ui.input(`Correct ${id}: what should be done instead?`, "e.g. Use PostgreSQL instead");
      if (text === undefined) return undefined;
      const error = checkText("correction", text);
      if (!error) return text;
      ctx.ui.notify(`${error} Try again, or press Esc to cancel.`, "warning");
    }
  };

  const review = async (args: string, ctx: ExtensionContext) => {
    if (!requireUI(ctx, "review-assumption")) return;
    const candidates = awaitingReview(state);
    let target: Assumption | undefined;
    const requestedId = args.trim().toUpperCase();
    if (requestedId) {
      target = state.assumptions.get(requestedId);
      if (!target) return ctx.ui.notify(`Unknown assumption ID "${requestedId}". Use /assumptions all to list IDs.`, "error");
      if (!candidates.includes(target)) {
        return ctx.ui.notify(`${target.id} is already ${target.status}; re-reviewing a final decision is not supported in v1.`, "warning");
      }
    } else {
      if (candidates.length === 0) return ctx.ui.notify("No assumptions awaiting review.", "info");
      const labels = candidates.map(reviewLabel);
      const picked = await ctx.ui.select("Review which assumption?", labels);
      if (picked === undefined) return;
      target = candidates[labels.indexOf(picked)];
    }

    const actions = [ACTIONS.accept, ACTIONS.correct, ...(target.status === "pending" ? [ACTIONS.defer] : []), ACTIONS.reject, ACTIONS.cancel];
    const action = await ctx.ui.select(`${detailText(target)}\n\nYour decision:`, actions);
    if (action === undefined || action === ACTIONS.cancel) return;
    const status = ACTION_STATUS[action];

    let correction: string | undefined;
    if (status === "corrected") {
      correction = await askCorrection(ctx, target.id);
      if (correction === undefined) return;
    }
    const note = await ctx.ui.input("Optional review note (Enter to skip, Esc to cancel)", "");
    if (note === undefined) return;

    const error = commit(buildReviewedEvent(target.id, status, new Date().toISOString(), correction, note));
    if (error) return ctx.ui.notify(`Not saved: ${error}`, "error");
    refreshStatus(ctx);
    ctx.ui.notify(`${target.id} marked ${status}. The agent sees this on your next message.${unsavedNote(ctx)}`, "info");
  };

  const addAssumption = async (_args: string, ctx: ExtensionContext) => {
    if (!requireUI(ctx, "add-assumption")) return;
    const title = await ctx.ui.input(`Title (${LIMITS.title[0]}-${LIMITS.title[1]} characters)`, "e.g. No user authentication");
    if (title === undefined) return;
    const description = await ctx.ui.input("What was assumed?", "e.g. The app has no login; anyone can mark attendance.");
    if (description === undefined) return;
    const reason = await ctx.ui.input("Why does it matter? (optional, Enter to skip)", "");
    if (reason === undefined) return;
    const impact = await ctx.ui.select("Impact if this assumption is wrong:", [...IMPACTS]);
    if (impact === undefined) return;

    let result: RecordResult;
    try {
      result = record({ title, description, reason, impact }, "user");
    } catch (error) {
      return ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    }
    refreshStatus(ctx);
    if (result.recorded) ctx.ui.notify(`Added ${result.assumption.id} (pending). Review it with /review-assumption.${unsavedNote(ctx)}`, "info");
    else ctx.ui.notify(`Already recorded as ${result.existing.id} (${result.existing.status}); nothing added.`, "warning");
  };

  pi.registerCommand("assumptions", {
    description: "List assumptions awaiting review (add 'all' to include reviewed ones)",
    getArgumentCompletions: (prefix) => ("all".startsWith(prefix) ? [{ value: "all", label: "all" }] : null),
    handler: async (args, ctx) => {
      const text = listText(state, args.trim().toLowerCase() === "all");
      if (ctx.hasUI) ctx.ui.notify(text, "info");
      else console.error(text);
    },
  });

  pi.registerCommand("review-assumption", {
    description: "Accept, correct, defer or reject a pending assumption",
    getArgumentCompletions: (prefix) => {
      const ids = awaitingReview(state).map((a) => a.id).filter((id) => id.startsWith(prefix.toUpperCase()));
      return ids.length > 0 ? ids.map((id) => ({ value: id, label: id })) : null;
    },
    handler: review,
  });

  pi.registerCommand("add-assumption", {
    description: "Record an assumption the agent missed",
    handler: addAssumption,
  });

  pi.registerCommand("assumptions-help", {
    description: "Explain assumption statuses and commands",
    handler: async (_args, ctx) => {
      if (ctx.hasUI) ctx.ui.notify(HELP_TEXT, "info");
      else console.error(HELP_TEXT);
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
