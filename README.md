# Assumption Tracker (Pi extension)

Pi coding agent extension that records agent-reported assumptions for human review.
Status: **Phase 2**. The agent can record candidate assumptions with the `record_assumption` tool. They are saved
in the Pi session, restored on resume, and counted in the footer. Review commands (`/assumptions`,
`/review-assumption`, `/add-assumption`) arrive in Phase 3.

Recorded items are *agent-reported* candidates, not detected facts, and recording one never blocks the agent.

## Requirements
- Node.js 22.19+ (tested on 26.3.0), npm, Git
- Pi is a project dependency (`@earendil-works/pi-coding-agent` 1.3.0); run it with `npx pi`, no global install needed.
- A model provider in Pi (`/login`, then `/model`) for anything involving the agent. Unit tests and smoke check need none.

## Setup
```bash
npm install --ignore-scripts
npm run typecheck
npm test
```

## Run in Pi
```bash
npm run pi
```
This runs `pi -na -e ./.pi/extensions/assumption-tracker.ts`. `-na` skips trust-gated
project-local auto-discovery, so the extension is loaded once, from the explicit `-e` path.
Extra Pi flags go after `--`, e.g. `npm run pi -- -c` continues the most recent session.

In Pi, `/tracker-hello` reports "Assumption Tracker loaded. record_assumption tool: active."

## Headless smoke check (no model/login needed)
```bash
npm run smoke
```
Starts Pi in RPC mode, checks that `/tracker-hello` is registered, runs it, and expects the message that confirms the tool
is active. Prints `SMOKE OK` (exit 0) or `SMOKE FAILED {...}` (exit 1). Works in PowerShell, cmd and bash.

## Layout
- `src/types.ts`: data contract and constants
- `src/validation.ts`: input checks, whitespace normalization, persisted-entry shape check
- `src/state.ts`: pure reducer (create/review/replay, duplicates, counts)
- `src/persistence.ts`: rebuilds state from the active session branch
- `src/formatter.ts`: footer text
- `src/extension.ts`: Pi wiring (tool, commands, session events)
- `.pi/extensions/assumption-tracker.ts`: thin entry point re-exporting the extension
- `tests/`: unit tests and mock-Pi integration tests
- `scenarios/`: manual test prompts with pre-annotated ambiguities

## Privacy
Assumptions are stored as custom entries in the Pi session file, alongside the conversation history. Don't put secrets in them.
The extension makes no network calls of its own.
