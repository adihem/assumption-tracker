import {
  EVENT_VERSION,
  IMPACTS,
  LIMITS,
  ORIGINS,
  STATUSES,
  type Assumption,
  type NewAssumption,
  type TrackerEvent,
} from "./types.ts";

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function comparableText(text: string): string {
  return normalizeText(text).toLowerCase();
}

export function checkText(field: keyof typeof LIMITS, value: unknown): string | undefined {
  if (typeof value !== "string") return `${field} must be text.`;
  const [min, max] = LIMITS[field];
  const length = normalizeText(value).length;
  if (length < min) return min === 1 ? `${field} must not be empty.` : `${field} must be at least ${min} characters.`;
  if (length > max) return `${field} must be at most ${max} characters (got ${length}).`;
  return undefined;
}

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

export function validateNewAssumption(input: Record<string, unknown>): Result<NewAssumption> {
  const errors = [
    checkText("title", input.title),
    checkText("description", input.description),
    checkText("reason", input.reason ?? ""),
    isOneOf(IMPACTS, input.impact) ? undefined : `impact must be one of: ${IMPACTS.join(", ")}.`,
  ].filter((e): e is string => e !== undefined);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title: normalizeText(input.title as string),
      description: normalizeText(input.description as string),
      reason: normalizeText((input.reason ?? "") as string),
      impact: input.impact as NewAssumption["impact"],
    },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isOptionalString = (v: unknown) => v === undefined || typeof v === "string";

function isAssumption(v: unknown): v is Assumption {
  return (
    isObject(v) &&
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.description === "string" &&
    typeof v.reason === "string" &&
    isOneOf(IMPACTS, v.impact) &&
    isOneOf(STATUSES, v.status) &&
    isOneOf(ORIGINS, v.origin) &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string" &&
    isOptionalString(v.correction) &&
    isOptionalString(v.reviewNote)
  );
}

export function parseEvent(raw: unknown): TrackerEvent | undefined {
  if (!isObject(raw) || raw.version !== EVENT_VERSION) return undefined;
  if (raw.event === "created") return isAssumption(raw.assumption) ? (raw as TrackerEvent) : undefined;
  if (
    raw.event === "reviewed" &&
    typeof raw.id === "string" &&
    isOneOf(STATUSES, raw.status) &&
    raw.status !== "pending" &&
    typeof raw.timestamp === "string" &&
    isOptionalString(raw.correction) &&
    isOptionalString(raw.reviewNote)
  ) {
    return raw as TrackerEvent;
  }
  return undefined;
}
