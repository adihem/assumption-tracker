# Progress

## Phase 0 — Environment and minimal integration ✅ (2026-10-17)
- Node 26.3.0, npm 11.16.0, Git 2.54.0. Pi 1.3.0 installed project-locally (not global).
- Package family: `@earendil-works/*` 1.3.0. API checked against installed `dist/core/extensions/types.d.ts`
  (`registerCommand`, `ctx.ui.notify(message, "info"|"warning"|"error")`, `ctx.hasUI`).
- `/tracker-hello` command; `npm run typecheck` passes; `npm run smoke` (RPC mode) confirms load + notify.
- Notes: Pi loads `.ts` via jiti (no build). Project `.pi/extensions/` is trust-gated; use `-na -e` to avoid double load.
  Repo path is long on Windows → `git config core.longpaths true`.
- Not done here: provider login (`/login`, `/model`) — needs the user; required from Phase 2.

## Next: Phase 1 — domain types and pure state
