import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { EXTENSION_ARGS, noModelEnv, PI_CLI } from "./no-model-env.mjs";

const env = noModelEnv();
const results = {};

const steps = [
  { prompt: "/add-assumption", replies: ["Use SQLite database", "Store attendance records in a local SQLite file.", "", "medium"] },
  { prompt: "/add-assumption", replies: ["No authentication", "Anyone can mark attendance without logging in.", "", "high"] },
  { prompt: "/add-assumption", replies: ["Add social login", "Offer Google sign-in on the login page.", "", "low"] },
  { prompt: "/review-assumption A-001", replies: ["Accept", ""] },
  { prompt: "/review-assumption A-002", replies: ["Defer", "Ask the teachers"] },
  { prompt: "/review-assumption A-002", replies: ["Correct", "Teachers log in with a password", ""] },
  { prompt: "/review-assumption A-003", replies: ["Reject", ""] },
  { prompt: "/review-assumption A-003", replies: [] },
  { prompt: "/assumptions all", replies: [] },
];
const replies = steps.flatMap((s) => s.replies);
const notes = [];
const deferOptions = [];

await new Promise((resolve) => {
  const pi = spawn(process.execPath, [PI_CLI, ...EXTENSION_ARGS, "--no-session", "--mode", "rpc"], {
    env,
    stdio: ["pipe", "pipe", "inherit"],
  });
  const send = (obj) => pi.stdin.write(JSON.stringify(obj) + "\n");
  let step = 0;
  createInterface({ input: pi.stdout }).on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.type === "extension_ui_request" && (msg.method === "select" || msg.method === "input")) {
      if (msg.method === "select" && msg.title?.includes("Your decision:")) deferOptions.push(msg.options.some((o) => o.startsWith("Defer")));
      const reply = replies.shift();
      const value = msg.method === "select" ? msg.options.find((o) => o.startsWith(reply)) : reply;
      send(value === undefined ? { type: "extension_ui_response", id: msg.id, cancelled: true } : { type: "extension_ui_response", id: msg.id, value });
    } else if (msg.type === "extension_ui_request" && msg.method === "notify") {
      notes.push(msg.message);
    } else if (msg.type === "response" && msg.command === "prompt") {
      if (++step < steps.length) send({ id: String(step), type: "prompt", message: steps[step].prompt });
      else pi.stdin.end();
    }
  });
  pi.on("close", resolve);
  setTimeout(() => pi.stdin.end(), 60_000);
  send({ id: "0", type: "prompt", message: steps[0].prompt });
});

const list = notes.at(-1) ?? "";
const has = (prefix) => notes.some((n) => n.startsWith(prefix));
Object.assign(results, {
  "added three": has("Added A-001") && has("Added A-002") && has("Added A-003"),
  "not-on-disk warning": notes.some((n) => n.includes("not on disk until you send a first message")),
  "S1 accept": has("A-001 marked accepted") && list.includes("A-001 | Use SQLite database | medium | accepted"),
  "S3 defer then correct": has("A-002 marked deferred") && has("A-002 marked corrected") && list.includes("Corrected to: Teachers log in with a password"),
  "S3 no Defer offered twice": deferOptions.length === 4 && deferOptions[1] === true && deferOptions[2] === false,
  "S4 reject": has("A-003 marked rejected") && list.includes("A-003 | Add social login | low | rejected"),
  "final item refused": notes.some((n) => n.includes("A-003 is already rejected")),
  "list summary": list.includes("0 pending, 0 deferred, 3 reviewed"),
  "all replies used": replies.length === 0,
});

for (const [command, expected] of [
  ["/assumptions", "No assumptions recorded in this session branch."],
  ["/review-assumption A-001", "/review-assumption needs an interactive Pi session"],
  ["/add-assumption", "/add-assumption needs an interactive Pi session"],
]) {
  const r = spawnSync(process.execPath, [PI_CLI, ...EXTENSION_ARGS, "--no-session", "-p", command], { env, encoding: "utf8", timeout: 60_000 });
  results[`S10 print ${command}`] = r.status === 0 && r.stderr.includes(expected);
}

const ok = Object.values(results).every(Boolean);
for (const [name, pass] of Object.entries(results)) console.log(`${pass ? "ok  " : "FAIL"} ${name}`);
console.log(ok ? "E2E OK" : `E2E FAILED\n${JSON.stringify({ notes }, null, 1)}`);
if (ok) console.log(list);
process.exit(ok ? 0 : 1);
