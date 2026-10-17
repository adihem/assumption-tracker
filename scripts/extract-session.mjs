// Read-only: summarize one Pi session file as a Markdown scoring sheet for docs/EVALUATION.md.
// Usage: npm run extract -- <session-id | path.jsonl> [scenario-id]
// Matching recorded items to annotated ambiguities stays a human judgement; this only gathers the facts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [target, scenarioId] = process.argv.slice(2);
if (!target) {
  console.error("Usage: npm run extract -- <session-id | path.jsonl> [scenario-id]");
  process.exit(1);
}

function findSession(idOrPath) {
  if (idOrPath.endsWith(".jsonl")) return idOrPath;
  const root = process.env.PI_CODING_AGENT_SESSION_DIR ?? join(homedir(), ".pi", "agent", "sessions");
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : name.includes(idOrPath) && name.endsWith(".jsonl") ? [p] : [];
    });
  const hits = walk(root);
  if (hits.length !== 1) {
    console.error(hits.length === 0 ? `No session file matching "${idOrPath}" under ${root}` : `Ambiguous id:\n${hits.join("\n")}`);
    process.exit(1);
  }
  return hits[0];
}

const file = findSession(target);
const entries = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
const textOf = (content) =>
  typeof content === "string" ? content : (content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const models = [...new Set(entries.filter((e) => e.type === "model_change").map((e) => `${e.provider}/${e.modelId}`))];
const userPrompts = entries.filter((e) => e.type === "message" && e.message.role === "user").map((e) => textOf(e.message.content));
const tracker = entries.filter((e) => e.type === "custom" && e.customType === "assumption-tracker").map((e) => e.data);
const created = tracker.filter((d) => d.event === "created").map((d) => d.assumption);
const reviewed = tracker.filter((d) => d.event === "reviewed");
const injections = entries.filter((e) => e.type === "custom_message" && e.customType === "assumption-tracker-decisions");
const toolCalls = entries
  .filter((e) => e.type === "message" && e.message.role === "assistant")
  .flatMap((e) => (Array.isArray(e.message.content) ? e.message.content : []).filter((c) => c.type === "toolCall"))
  .map((c) => c.name);
const replies = entries.filter((e) => e.type === "message" && e.message.role === "assistant").map((e) => textOf(e.message.content)).filter(Boolean);

const out = [
  `### Session ${entries[0]?.id ?? "?"}${scenarioId ? ` — ${scenarioId}` : ""}`,
  `- Date: ${entries[0]?.timestamp ?? "?"}`,
  `- Model(s): ${models.join(", ") || "?"}`,
  `- Condition: ${tracker.length > 0 || toolCalls.includes("record_assumption") ? "tracker" : "baseline or tracker with no tool calls (check how Pi was started)"}`,
  `- Tool calls: ${toolCalls.length ? Object.entries(toolCalls.reduce((m, n) => ((m[n] = (m[n] ?? 0) + 1), m), {})).map(([n, c]) => `${n}×${c}`).join(", ") : "none"}`,
  `- User prompts: ${userPrompts.length}; decision injections: ${injections.length}`,
  "",
  "Recorded assumptions:",
  ...(created.length
    ? created.map((a) => `- ${a.id} [${a.origin}, ${a.impact}] ${a.title}: ${short(a.description, 160)}`)
    : ["- (none)"]),
  "",
  "Reviews:",
  ...(reviewed.length ? reviewed.map((r) => `- ${r.id} → ${r.status}${r.correction ? `: ${r.correction}` : ""}`) : ["- (none)"]),
  "",
  `Last assistant reply (first 500 chars): ${short(replies.at(-1) ?? "(none)", 500).replace(/\n+/g, " ")}`,
];

if (scenarioId) {
  const spec = JSON.parse(readFileSync(new URL("../scenarios/annotated-assumptions.json", import.meta.url), "utf8"));
  const scenario = spec.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) {
    console.error(`Unknown scenario "${scenarioId}". Known: ${spec.scenarios.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  out.push(
    "",
    "Scoring (fill in: Y = surfaced, N = missed; give the assumption ID or quote the reply sentence):",
    "| Ambiguity | Impact | Counts if | Surfaced? | Evidence |",
    "|---|---|---|---|---|",
    ...scenario.ambiguities.map((a) => `| ${a.id} | ${a.impact} | ${a.countsIf} | | |`),
    "",
    `False positives (recorded items matching no ambiguity and not real assumptions): ___ of ${created.filter((a) => a.origin === "agent").length} agent-reported`,
  );
}

console.log(out.join("\n"));
