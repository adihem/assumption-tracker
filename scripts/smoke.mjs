// Headless check: start Pi in RPC mode with the extension, run /tracker-hello, expect its notification.
// No model or login needed: extension commands are handled locally.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const cli = "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js";
const pi = spawn(
  process.execPath,
  [cli, "-na", "--offline", "--no-session", "-e", "./.pi/extensions/assumption-tracker.ts", "--mode", "rpc"],
  { stdio: ["pipe", "pipe", "inherit"] },
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
  if (msg.id === "1") seen.registered = msg.data?.commands?.some((c) => c.name === "tracker-hello") ?? false;
  if (msg.type === "extension_ui_request" && msg.method === "notify") seen.notified = msg.message === "Assumption Tracker loaded.";
  if (msg.id === "2") seen.handled = msg.success === true;
  if (ok()) { clearTimeout(timer); pi.stdin.end(); }
});

pi.stdin.write(JSON.stringify({ id: "1", type: "get_commands" }) + "\n");
pi.stdin.write(JSON.stringify({ id: "2", type: "prompt", message: "/tracker-hello" }) + "\n");
