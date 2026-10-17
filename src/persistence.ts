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

/** Rebuilds state from the active branch only (never getEntries(), which mixes in abandoned branches). Never writes. */
export function loadState(sessionManager: { getBranch(): readonly BranchEntry[] }): {
  state: TrackerState;
  skipped: number;
} {
  return replayEvents(trackerEntries(sessionManager.getBranch()));
}
