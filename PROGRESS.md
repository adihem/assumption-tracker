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

## Phase 2 — Model-callable assumption registration ✅ (2026-10-17)
- `record_assumption` tool (TypeBox schema, `StringEnum` impact, optional `reason`), with model guidance from plan §9.3
  in `description`, `promptSnippet` and `promptGuidelines`.
- Flow: validate → duplicate check → `pi.appendEntry("assumption-tracker", event)` → commit state → footer count.
  Invalid input throws, so Pi returns an error result to the model and nothing is persisted. A failed append leaves state unchanged.
  A duplicate returns the existing ID (and the user's correction, if any).
- `src/persistence.ts`: `loadState` replays only the `getBranch()` custom entries. It is wired to `session_start` and `session_tree`
  now, so restart already works. Phase 4 adds the real branch/resume scenario tests.
- `src/formatter.ts`: `statusText` → `Assumptions: N pending[, M deferred]` via `ctx.ui.setStatus` (only when `hasUI`).
- `/tracker-hello` now also reports whether `record_assumption` is active; `npm run smoke` asserts it.
- Tests: 37 passing (+10 in `tests/integration.test.ts`, which uses a mock Pi): registration and schema, one persisted event per call,
  invalid input → no persist, duplicate → same ID, concurrent calls → unique IDs, append failure, no-UI mode,
  restore on resume, `session_tree` rebuild, invalid saved entries skipped with a warning.
- Scenario: `scenarios/attendance-app.md`.
- Live gate ✅ (2026-10-17, Pi 1.3.0, OpenRouter):
  - Run 1, `nvidia/nemotron-3.5-super-vl:free`, thinking off: **no tool call**. The model chose React, localStorage and Vite unprompted.
    Likely cause: "do not create files" read as "use no tools". Fix: guideline that record_assumption is allowed in plan-only turns.
  - Run 2, `thinkingmachines/inkling:free`, thinking medium: recorded `A-001 "Data storage choice"` (medium). The footer showed
    `Assumptions: 1 pending`. After `pi -c` the footer was restored, and the session file holds one valid `created` entry.
  - Scenario recall in run 2: 1/3 (storage ✓; app type/stack and authentication not recorded).
  - Unrelated noise: OpenRouter 402 errors (Pi requested max_tokens ≈ 233k, more than the free credits allow) before the call succeeded.

## Phase 3 — User review commands ✅ (2026-10-17)
- Commands: `/assumptions [all]`, `/review-assumption [ID]`, `/add-assumption`, `/assumptions-help`.
- Review flow (plan §9.5):
  - Pick an item via `ui.select`, or pass an ID (case-insensitive).
  - The full detail is shown, then Accept / Correct / Defer (pending only) / Reject / Cancel.
  - Correct re-asks until the text is valid. An optional note follows. Esc anywhere means no change.
- Saving uses the same check → `appendEntry` → apply order as recording, and is re-checked against the latest state at commit time.
- Without a UI, commands print a diagnostic to stderr and open no dialogs (`/assumptions` prints the list).
- `src/formatter.ts`: `listText` (unresolved first, numeric ID order, descriptions truncated at 100 chars), `detailText` (full text),
  `reviewLabel`, `HELP_TEXT`. Labels say "agent-reported … candidates, not verified facts".
- Tests: 53 passing (+6 in `tests/formatter.test.ts`, +10 command-flow tests that use scripted dialog answers).
  A deliberate bug (removing the Esc guard on the note) was caught.
- `npm run e2e`: real Pi over RPC, add → correct → list, passes. `npm run smoke` now checks all 5 commands.
- Manual TUI check ✅ (2026-10-17):
  - The `/add-assumption` → A-002 (user) entry, the A-001 correction (the empty answer was re-asked) and the A-002 deferral were all saved.
    The session file holds exactly one entry per action.
  - The final-item warning works. `/assumptions all` shows the deferred item first and the correction. The footer showed `0 pending, 1 deferred`.
    The same state was present after `pi -c`.
  - Notes: the TUI displayed one notification twice (display only; one saved event).
    The step "re-review A-002 without Defer" was typed as chat text instead of a `/` command, so the agent explored the repo read-only.
    That path is covered by an automated test.

## Phase 4 — Correct session behaviour ✅ (2026-10-17)
- Restore was already wired in Phase 2: `session_start` and `session_tree` both call `loadState(getBranch())`, and restoring never writes.
- `tests/branching.test.ts` (8 tests) uses Pi's real `SessionManager.inMemory()` tree, not a mock:
  - A branch made before a review shows the item as pending, and returning restores the decision.
  - Two branches can hold different decisions for the same item.
  - IDs and duplicates come from the active branch only (the same ID can exist on two branches).
  - Navigating before the first item gives an empty list.
  - A new session starts empty, an unrelated session never leaks in, and a resume restores everything.
  - Restoring writes nothing.
- Mutation check: replacing `getBranch()` with `getEntries()` fails 4 branch tests.
- Finding (Pi behaviour): Pi writes a new session file only after its first user/assistant message (`SessionManager._persist`).
  Items added or reviewed before that are lost on exit. `/add-assumption` and `/review-assumption` now warn in that case.
- No real-Pi branch e2e: RPC `fork` and `/tree` need user messages, which need a model call. A probe accidentally sent one request
  ("hello") to the user's OpenRouter model, so the scripts now avoid model calls entirely. The branch check stays manual (`/tree`).
- Tests: 61 passing.
- Manual `/tree` check ✅ (2026-10-17, session 01a14a96):
  - The tree shows `created A-001` before the first chat message, and it reached disk after `ok`.
    Later, `reviewed A-001 corrected -> Use PostgreSQL` then `noted`.
  - After `/tree` back to before the review, the footer showed `Assumptions: 1 pending`, so the state was rebuilt from that branch.
  - The return-to-latest step was not done manually; it is covered by the branching tests.
  - Observation for Phase 5: typing "Use PostgreSQL" as chat confused the agent. It has no view of tracker decisions yet.

## Next: Phase 5 — inform the agent of review decisions
