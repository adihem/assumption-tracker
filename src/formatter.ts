// Plain-text views of tracker state. Readable without color; assumption text is shown as data, never interpreted.
import { countByStatus } from "./state.ts";
import type { Assumption, Status, TrackerState } from "./types.ts";

const LIST_DESCRIPTION_MAX = 100;
const STATUS_ORDER: Record<Status, number> = { pending: 0, deferred: 1, corrected: 2, accepted: 3, rejected: 4 };

export const HELP_TEXT = [
  "Assumption Tracker: agent-reported candidate assumptions, reviewed by you.",
  "  pending   - recorded, not reviewed yet",
  "  accepted  - you approved the original choice",
  "  corrected - you replaced it with your own decision",
  "  deferred  - postponed; review it again later",
  "  rejected  - not permitted; no replacement given (existing code is not undone)",
  "Commands: /assumptions [all], /review-assumption [ID], /add-assumption, /assumptions-help",
  "Accepted, corrected and rejected are final in this version.",
].join("\n");

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Footer text, e.g. "Assumptions: 2 pending, 1 deferred". Undefined clears the footer when nothing awaits review. */
export function statusText(state: TrackerState): string | undefined {
  const { pending, deferred } = countByStatus(state);
  if (pending === 0 && deferred === 0) return undefined;
  const parts = [`${pending} pending`];
  if (deferred > 0) parts.push(`${deferred} deferred`);
  return `Assumptions: ${parts.join(", ")}`;
}

/** Short selector label, e.g. "A-001 — Use SQLite (pending, medium)". */
export function reviewLabel(a: Assumption): string {
  return `${a.id} — ${a.title} (${a.status}, ${a.impact})`;
}

/** Full stored text, shown while reviewing. */
export function detailText(a: Assumption): string {
  const lines = [
    `${a.id}: ${a.title}`,
    `Status: ${a.status} | Proposed impact: ${a.impact} | Reported by: ${a.origin}`,
    `Assumption: ${a.description}`,
    `Reason: ${a.reason || "(none given)"}`,
  ];
  if (a.correction) lines.push(`Correction: ${a.correction}`);
  if (a.reviewNote) lines.push(`Note: ${a.reviewNote}`);
  return lines.join("\n");
}

function listEntry(a: Assumption): string {
  const lines = [`${a.id} | ${a.title} | ${a.impact} | ${a.status}`, `    ${truncate(a.description, LIST_DESCRIPTION_MAX)}`];
  if (a.correction) lines.push(`    Corrected to: ${truncate(a.correction, LIST_DESCRIPTION_MAX)}`);
  return lines.join("\n");
}

/** List for /assumptions: unresolved items by default, everything with `all`. Unresolved first, then by ID. */
export function listText(state: TrackerState, all: boolean): string {
  const items = [...state.assumptions.values()];
  if (items.length === 0) return "No assumptions recorded in this session branch.";
  const c = countByStatus(state);
  const reviewed = c.accepted + c.corrected + c.rejected;
  const shown = items
    .filter((a) => all || a.status === "pending" || a.status === "deferred")
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const header = `Agent-reported assumptions (candidates, not verified facts): ${c.pending} pending, ${c.deferred} deferred, ${reviewed} reviewed`;
  if (shown.length === 0) return `${header}\nNo assumptions awaiting review. Use /assumptions all to see reviewed items.`;
  return [header, ...shown.map(listEntry)].join("\n");
}
