# Assumption Tracker (Pi extension)

Pi coding agent extension that records agent-reported assumptions for human review.
Status: **Phase 0** — only `/tracker-hello` exists.

## Requirements
- Node.js 22.19+ (tested on 26.3.0), npm, Git
- Pi is a project dependency (`@earendil-works/pi-coding-agent` 1.3.0); run it with `npx pi`, no global install needed.

## Setup
```bash
npm install --ignore-scripts
npm run typecheck
```

## Run in Pi
```bash
npm run pi
```
This runs `pi -na -e ./.pi/extensions/assumption-tracker.ts`. `-na` skips trust-gated
project-local auto-discovery, so the extension is loaded once, from the explicit `-e` path.
In Pi, type `/tracker-hello` → notification "Assumption Tracker loaded."

## Headless smoke check (no model/login needed)
```bash
npm run smoke
```
Starts Pi in RPC mode, checks `/tracker-hello` is registered, runs it, and expects its
notification. Prints `SMOKE OK` (exit 0) or `SMOKE FAILED {...}` (exit 1). Works in PowerShell, cmd and bash.

## Layout
- `src/extension.ts` — extension factory
- `.pi/extensions/assumption-tracker.ts` — thin entry point re-exporting it
