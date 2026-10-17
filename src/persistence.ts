// Bridge between Pi session entries and tracker events. Reading only: writes go through pi.appendEntry in extension.ts.
import { replayEvents } from "./state.ts";
import { ASSUMPTION_ENTRY_TYPE, type TrackerState } from "./types.ts";

interface BranchEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

/** Raw tracker event payloads on the given branch, in session order. */
export function trackerEntries(branch: readonly BranchEntry[]): unknown[] {
  return branch.filter((e) => e.type === "custom" && e.customType === ASSUMPTION_ENTRY_TYPE).map((e) => e.data);
}

/**
 * Pi writes a new session file only once it holds a user or assistant message (SessionManager._persist),
 * so tracker entries added before the first chat message are lost if Pi exits first.
 */
export function hasConversation(sessionManager: { getEntries(): readonly BranchEntry[] }): boolean {
  return sessionManager.getEntries().some((e) => {
    const role = (e as { message?: { role?: string } }).message?.role;
    return e.type === "message" && (role === "user" || role === "assistant");
  });
}

export const NOT_YET_SAVED_WARNING =
  " Note: this new session is not on disk until you send a first message; exiting before that loses it.";

/** Rebuilds state from the active branch only (never getEntries(), which mixes in abandoned branches). Never writes. */
export function loadState(sessionManager: { getBranch(): readonly BranchEntry[] }): {
  state: TrackerState;
  skipped: number;
} {
  return replayEvents(trackerEntries(sessionManager.getBranch()));
}
