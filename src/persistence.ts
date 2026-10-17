import { replayEvents } from "./state.ts";
import { ASSUMPTION_ENTRY_TYPE, type TrackerState } from "./types.ts";

interface BranchEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

export function trackerEntries(branch: readonly BranchEntry[]): unknown[] {
  return branch.filter((e) => e.type === "custom" && e.customType === ASSUMPTION_ENTRY_TYPE).map((e) => e.data);
}

export function hasConversation(sessionManager: { getEntries(): readonly BranchEntry[] }): boolean {
  return sessionManager.getEntries().some((e) => {
    const role = (e as { message?: { role?: string } }).message?.role;
    return e.type === "message" && (role === "user" || role === "assistant");
  });
}

export const NOT_YET_SAVED_WARNING =
  " Note: this new session is not on disk until you send a first message; exiting before that loses it.";

export const DECISION_MESSAGE_TYPE = "assumption-tracker-decisions";

export function lastDecisionSummary(sessionManager: { buildContextEntries(): readonly BranchEntry[] }): string | undefined {
  const entries = sessionManager.buildContextEntries();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as BranchEntry & { content?: unknown };
    if (e.type === "custom_message" && e.customType === DECISION_MESSAGE_TYPE) {
      return typeof e.content === "string" ? e.content : undefined;
    }
  }
  return undefined;
}

export function loadState(sessionManager: { getBranch(): readonly BranchEntry[] }): {
  state: TrackerState;
  skipped: number;
} {
  return replayEvents(trackerEntries(sessionManager.getBranch()));
}
