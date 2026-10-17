# Progress

## Phase 0 — Environment and minimal integration ✅ (2026-10-17)
- Node 26.3.0, npm 11.16.0, Git 2.54.0. Pi 1.3.0 installed project-locally (not global).
- Package family: `@earendil-works/*` 1.3.0. API checked against installed `dist/core/extensions/types.d.ts`
  (`registerCommand`, `ctx.ui.notify(message, "info"|"warning"|"error")`, `ctx.hasUI`).
- `/tracker-hello` command; `npm run typecheck` passes; `npm run smoke` (RPC mode) confirms load + notify.
- Notes: Pi loads `.ts` via jiti (no build). Project `.pi/extensions/` is trust-gated; use `-na -e` to avoid double load.
  Repo path is long on Windows → `git config core.longpaths true`.
- Not done here: provider login (`/login`, `/model`) — needs the user; required from Phase 2.

## Phase 1 — Domain types and pure state ✅ (2026-10-17)
- `src/types.ts`: data contract from plan §7.1 + constants (`ASSUMPTION_ENTRY_TYPE`, `LIMITS`, enums).
- `src/validation.ts`: `validateNewAssumption` (normalize whitespace, length limits, impact enum; rejects, never truncates),
  `parseEvent` (shape check for persisted entries; unknown versions → skipped).
- `src/state.ts` (no Pi imports): `createEmptyState`, `nextId`, `findDuplicate`, `buildCreatedEvent`,
  `buildReviewedEvent`, `checkEvent`, `applyEvent`, `replayEvents`, `awaitingReview`, `countByStatus`.
- Design choices:
  - `checkEvent` returns the reason an event is invalid; `applyEvent` returns the *same* state for invalid events,
    so callers can validate → persist → commit (plan §10.2).
  - `replayEvents(raw: unknown[])` returns `{ state, skipped }` instead of bare state, so Phase 4 can warn about skipped entries.
  - Duplicate = same normalized title **or** description among non-rejected items.
  - Transitions: pending → any review status; deferred → accepted/corrected/rejected; accepted/corrected/rejected are final.
- Tests: 27 passing (`tests/validation.test.ts`, `tests/state.test.ts`), covering plan §14.1 items 1–16 and 20.
  Items 17–19 (formatter) belong to Phases 3/5.

## Next: Phase 2 — `record_assumption` tool (needs `/login` + `/model` in Pi)
