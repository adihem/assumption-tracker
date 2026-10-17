// Environment for running real Pi with no reachable model: an empty, throwaway config dir (no saved logins) and
// every credential-like or provider variable removed. Used by the headless checks so they can never call a model.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CREDENTIAL_LIKE = /key|token|secret|password|anthropic|openai|openrouter|gemini|google|groq|mistral|azure|aws|bedrock|xai|deepseek|ollama|claude/i;

export function noModelEnv() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !CREDENTIAL_LIKE.test(name)));
  const dir = mkdtempSync(join(tmpdir(), "pi-no-model-"));
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  env.PI_CODING_AGENT_DIR = dir;
  env.PI_OFFLINE = "1";
  return env;
}

export const PI_CLI = "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js";
export const EXTENSION_ARGS = ["-na", "--offline", "-e", "./.pi/extensions/assumption-tracker.ts"];
