import { countByStatus } from "./state.ts";
import type { TrackerState } from "./types.ts";

/** Footer text, e.g. "Assumptions: 2 pending, 1 deferred". Undefined clears the footer when nothing awaits review. */
export function statusText(state: TrackerState): string | undefined {
  const { pending, deferred } = countByStatus(state);
  if (pending === 0 && deferred === 0) return undefined;
  const parts = [`${pending} pending`];
  if (deferred > 0) parts.push(`${deferred} deferred`);
  return `Assumptions: ${parts.join(", ")}`;
}
