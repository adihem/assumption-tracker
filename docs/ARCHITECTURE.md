# Architecture

One Pi extension. Pure domain logic sits in the middle, and a thin Pi adapter sits around it. There is no server, database or
second model.

```text
 agent ──record_assumption──┐            ┌── /assumptions, /review-assumption, /add-assumption (user)
                            v            v
                     src/extension.ts  (Pi adapter: tool, commands, events)
                            │  validate → check → pi.appendEntry → apply
                            v
     src/validation.ts ── src/state.ts (pure reducer) ── src/formatter.ts (text views)
                            ^
                            │  replay on session_start / session_tree
                     src/persistence.ts ── ctx.sessionManager.getBranch()
                            │
 before_agent_start (user runs) ── decision summary as a custom message, only when changed
```

## Modules
| File | Role | Pi imports |
|---|---|---|
| `src/types.ts` | Data contract (`Assumption`, `TrackerEvent`, `TrackerState`), limits, constants | none |
| `src/validation.ts` | Input normalization/limits, persisted-entry shape checks | none |
| `src/state.ts` | `applyEvent`, `checkEvent`, `replayEvents`, duplicates, IDs, counts; never mutates | none |
| `src/formatter.ts` | Footer, list, detail, help, model-facing decision summary | none |
| `src/persistence.ts` | Branch replay, "written to disk?" check, last summary still in context | none (structural types) |
| `src/extension.ts` | Registers the tool, commands and event handlers; holds the single in-memory state | yes |

## Key decisions
- **Event-sourced in Pi's session.** Each created or reviewed event is a `custom` entry (`assumption-tracker`). State is always
  rebuilt from `getBranch()`, so branches, resume and fork are correct by construction, with no sidecar database.
- **Check before persisting.** `checkEvent` runs first, then `appendEntry`, then the state is replaced. A failed append leaves
  the state untouched, and invalid input never reaches the session.
- **Synchronous record path.** Nothing is awaited between reading and writing the state, so parallel tool calls get unique IDs.
- **User-only reviews.** The tool can only create `pending` items. Every status change goes through a command.
- **Inform, don't enforce.** On user-started runs, `before_agent_start` adds one capped, quoted summary. It skips this when
  the same text is already in `buildContextEntries()`, which keeps the context small and handles compaction and branches.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §6–§10 for the original design and `PROGRESS.md` for what changed per phase.
