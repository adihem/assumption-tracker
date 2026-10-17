import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { EXTENSION_ARGS, noModelEnv, PI_CLI } from "./no-model-env.mjs";

const EXPECTED_COMMANDS = ["tracker-hello", "assumptions", "review-assumption", "add-assumption", "assumptions-help"];
const pi = spawn(
  process.execPath,
  [PI_CLI, ...EXTENSION_ARGS, "--no-session", "--mode", "rpc"],
  { env: noModelEnv(), stdio: ["pipe", "pipe", "inherit"] },
);
const seen = { registered: false, notified: false, handled: false };
const ok = () => seen.registered && seen.notified && seen.handled;
pi.on("close", () => {
  console.log(ok() ? "SMOKE OK" : `SMOKE FAILED ${JSON.stringify(seen)}`);
  process.exit(ok() ? 0 : 1);
});
const timer = setTimeout(() => pi.stdin.end(), 60_000);

createInterface({ input: pi.stdout }).on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === "1") {
    const names = new Set(msg.data?.commands?.map((c) => c.name));
    seen.registered = EXPECTED_COMMANDS.every((n) => names.has(n));
  }
  if (msg.type === "extension_ui_request" && msg.method === "notify") seen.notified = msg.message === "Assumption Tracker loaded. record_assumption tool: active.";
  if (msg.id === "2") seen.handled = msg.success === true;
  if (ok()) { clearTimeout(timer); pi.stdin.end(); }
});

pi.stdin.write(JSON.stringify({ id: "1", type: "get_commands" }) + "\n");
pi.stdin.write(JSON.stringify({ id: "2", type: "prompt", message: "/tracker-hello" }) + "\n");
