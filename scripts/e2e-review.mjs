// Headless end-to-end check of the review commands in real Pi (RPC mode, in-memory session, no model):
// /add-assumption → /review-assumption (correct) → /assumptions all. Dialogs are answered from a script.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const cli = "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js";
const pi = spawn(
  process.execPath,
  [cli, "-na", "--offline", "--no-session", "-e", "./.pi/extensions/assumption-tracker.ts", "--mode", "rpc"],
  { stdio: ["pipe", "pipe", "inherit"] },
);
const send = (obj) => pi.stdin.write(JSON.stringify(obj) + "\n");

// Replies in dialog order; a select reply is matched as an option prefix.
const replies = [
  "No authentication", "Anyone can mark attendance without logging in.", "", "high", // /add-assumption
  "A-001", "Correct", "Teachers log in with a password", "Security matters", // /review-assumption
];
const prompts = ["/add-assumption", "/review-assumption", "/assumptions all"];
const notes = [];
let finished = 0;

createInterface({ input: pi.stdout }).on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.type === "extension_ui_request" && (msg.method === "select" || msg.method === "input")) {
    const reply = replies.shift();
    const value = msg.method === "select" ? msg.options.find((o) => o.startsWith(reply)) : reply;
    send(value === undefined ? { type: "extension_ui_response", id: msg.id, cancelled: true } : { type: "extension_ui_response", id: msg.id, value });
  } else if (msg.type === "extension_ui_request" && msg.method === "notify") {
    notes.push(msg.message);
  } else if (msg.type === "response" && msg.command === "prompt") {
    if (++finished < prompts.length) send({ id: String(finished), type: "prompt", message: prompts[finished] });
    else pi.stdin.end();
  }
});

pi.on("close", () => {
  const list = notes.at(-1) ?? "";
  const checks = {
    added: notes.some((n) => n.startsWith("Added A-001 (pending). Review it with /review-assumption.")),
    reviewed: notes.some((n) => n.startsWith("A-001 marked corrected. The agent sees this on your next message.")),
    // in-memory session with no chat message yet, so the not-on-disk warning must be shown
    warned: notes.some((n) => n.includes("not on disk until you send a first message")),
    listed: list.includes("A-001 | No authentication | high | corrected") && list.includes("Corrected to: Teachers log in with a password"),
    allRepliesUsed: replies.length === 0,
  };
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "E2E OK" : `E2E FAILED ${JSON.stringify({ checks, notes }, null, 1)}`);
  if (ok) console.log(list);
  process.exit(ok ? 0 : 1);
});
setTimeout(() => pi.stdin.end(), 60_000);
send({ id: "0", type: "prompt", message: prompts[0] });
