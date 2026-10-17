# Test plan and status

## Automated (`npm test`, no model)
| File | Covers |
|---|---|
| `tests/validation.test.ts` | Field limits, whitespace normalization, impact enum, persisted-entry shape checks |
| `tests/state.test.ts` | Create/review/replay reducer, transitions, final items, duplicates, next ID, counts |
| `tests/formatter.test.ts` | List/detail text, truncation, sort order, footer, decision summary (cap, quoting, no pending as approved) |
| `tests/integration.test.ts` | Mock Pi: tool registration, persistence, invalid input, concurrency, append failure, every command flow incl. Esc, no-UI mode |
| `tests/branching.test.ts` | Pi's real `SessionManager`: `/tree` navigation, per-branch decisions/IDs, session switches, resume, decision injection and dedup |

Other headless checks against real Pi, with no reachable model (`scripts/no-model-env.mjs`: empty throwaway config dir, all credential
and provider variables removed):
- `npm run smoke`: extension loads, all commands registered, tool active.
- `npm run e2e`: in RPC mode, add three items, accept (S1), defer then correct (S3), reject (S4), refuse a re-review of a final item,
  then list. In print mode (no UI, S10), `/assumptions`, `/review-assumption` and `/add-assumption` answer on stderr with no dialog.

Mutation checks done during development: each of these deliberate bugs made a test fail.
- Matching rejected duplicates
- Dropping the Esc guard on the note
- `getEntries()` instead of `getBranch()`
- Dropping the `messageType` guard
- Dropping the injection dedup
- Dropping the "possibly related to a rejected item" note

## Manual system scenarios (plan §14.3)
| # | Scenario | Status | Evidence |
|---|---|---|---|
| S1 | Agent reports, user accepts, persists | ✅ Report and persist live (Phase 2); accept in real Pi via `npm run e2e` | PROGRESS Phase 2; e2e |
| S2 | Correction reflected in the next response | ✅ Live | PROGRESS Phase 5 (session 01a14ab3) |
| S3 | Defer, review later | ✅ Defer live (Phase 3); defer → later correct in real Pi via `npm run e2e`, Defer not offered twice | PROGRESS Phase 3; e2e |
| S4 | Reject; agent sees it next turn | ◐ Reject in real Pi via `npm run e2e`; the agent-side note only on the real `SessionManager` (Pi needs a model to start a run) | e2e; `branching.test.ts` |
| S5 | Agent misses one; human adds it | ✅ Live | PROGRESS Phase 3 (`/add-assumption` → A-002 user) |
| S6 | Duplicate report | ◐ Automated only (needs the model to repeat a tool call) | `integration.test.ts` |
| S7 | Exit and resume | ✅ Live | PROGRESS Phases 2–3 |
| S8 | Branch before a correction | ✅ Live (footer pending on the earlier branch) | PROGRESS Phase 4 (session 01a14a96) |
| S9 | Invalid values give clear errors | ✅ Live (empty correction re-asked) + automated | PROGRESS Phase 3 |
| S10 | Noninteractive mode, no crash | ✅ Real Pi print mode via `npm run e2e`: commands answer on stderr, exit 0, no dialogs | e2e; `integration.test.ts` |

◐ = covered by tests, but the agent-dependent part has not been confirmed in a live session. To finish one, run it in `npm run pi`
(S4: reject an item, then send a message and check the note says REJECTED; S6: ask the agent to record the same assumption
twice) and add the session ID here.
