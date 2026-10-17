# Test plan and status

## Automated (`npm test`, no model)
| File | Covers |
|---|---|
| `tests/validation.test.ts` | Field limits, whitespace normalization, impact enum, persisted-entry shape checks |
| `tests/state.test.ts` | Create/review/replay reducer, transitions, final items, duplicates, next ID, counts |
| `tests/formatter.test.ts` | List/detail text, truncation, sort order, footer, decision summary (cap, quoting, no pending as approved) |
| `tests/integration.test.ts` | Mock Pi: tool registration, persistence, invalid input, concurrency, append failure, every command flow incl. Esc, no-UI mode |
| `tests/branching.test.ts` | Pi's real `SessionManager`: `/tree` navigation, per-branch decisions/IDs, session switches, resume, decision injection and dedup |

Other headless checks against real Pi (RPC mode, in-memory session, no model):
- `npm run smoke`: extension loads, all commands registered, tool active.
- `npm run e2e`: `/add-assumption` → `/review-assumption` (correct) → `/assumptions all`.

Mutation checks done during development: each of these deliberate bugs made a test fail.
- Matching rejected duplicates
- Dropping the Esc guard on the note
- `getEntries()` instead of `getBranch()`
- Dropping the `messageType` guard
- Dropping the injection dedup

## Manual system scenarios (plan §14.3)
| # | Scenario | Status | Evidence |
|---|---|---|---|
| S1 | Agent reports, user accepts, persists | ◐ Report and persist live (Phase 2); accept automated only | PROGRESS Phase 2; tests |
| S2 | Correction reflected in the next response | ✅ Live | PROGRESS Phase 5 (session 01a14ab3) |
| S3 | Defer, review later | ◐ Defer live (Phase 3); later review automated only | PROGRESS Phase 3; tests |
| S4 | Reject; agent sees it next turn | ◐ Automated only | `branching.test.ts` |
| S5 | Agent misses one; human adds it | ✅ Live | PROGRESS Phase 3 (`/add-assumption` → A-002 user) |
| S6 | Duplicate report | ◐ Automated only | `integration.test.ts` |
| S7 | Exit and resume | ✅ Live | PROGRESS Phases 2–3 |
| S8 | Branch before a correction | ✅ Live (footer pending on the earlier branch) | PROGRESS Phase 4 (session 01a14a96) |
| S9 | Invalid values give clear errors | ✅ Live (empty correction re-asked) + automated | PROGRESS Phase 3 |
| S10 | Noninteractive mode, no crash | ◐ Automated only (`hasUI: false`) | `integration.test.ts` |

◐ = covered by tests but not yet confirmed by hand. To finish one, run it in `npm run pi` and add the session ID here.
