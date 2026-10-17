# Assumption Tracker for the Pi coding agent

[![CI](https://github.com/adihem/assumption-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/adihem/assumption-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A [Pi](https://pi.dev) extension that makes an AI coding agent's unstated choices **visible, reviewable and
persistent**. The agent can report a *candidate assumption*, for example "Use SQLite for storage", without stopping its work.
You review it whenever you like (accept, correct, defer or reject), and your decision reaches the agent on your next message.

Recorded items are **agent-reported candidates, not detected facts**. The tracker informs the agent but does not enforce
decisions or undo code. Models can miss assumptions, so `/add-assumption` lets you record ones the agent didn't.

## Quick start
Requirements: Node.js 22.19+ (tested on 26.3.0), npm, and Git. Pi is installed as a project dependency
(`@earendil-works/pi-coding-agent` 1.3.0), so no global install is needed.

```bash
git clone https://github.com/adihem/assumption-tracker.git
cd assumption-tracker
npm install --ignore-scripts
npm test
npm run smoke
npm run pi
```
`npm test` (71 tests), `npm run smoke` and `npm run e2e` need no model or account. Before using the agent inside Pi, set up a model
(see [Model setup](#model-setup-and-troubleshooting)). On Windows, if Git reports "Filename too long", run
`git config core.longpaths true`.

## Commands
| Command | What it does |
|---|---|
| `/assumptions` | List pending and deferred items with totals |
| `/assumptions all` | Also list accepted, corrected and rejected items |
| `/review-assumption [ID]` | Choose an item, see its full text, then Accept / Correct / Defer / Reject / Cancel, plus an optional note |
| `/add-assumption` | Record something the agent missed |
| `/assumptions-help` | Explain the statuses |
| `/tracker-hello` | Check that the extension and its tool are loaded |

The agent uses the `record_assumption` tool (title, description, optional reason, impact: low/medium/high). The footer
shows `Assumptions: N pending[, M deferred]`. Esc in any dialog cancels without saving. Accepted, corrected and rejected
are final in v1. Reviewing never starts an agent run by itself.

## Walkthrough (about 5 minutes, needs a model)
1. Run `npm run pi`, then send: *"Create a simple attendance tracker. Students can be added and marked present. For now, only
   describe your plan and technology choices; do not create any files."*
2. The agent calls `record_assumption`, for example `Recorded A-001 (pending user review)`, and the footer shows `Assumptions: 1 pending`.
   If it records nothing, add one yourself with `/add-assumption`.
3. Run `/assumptions`, pick the item about **data storage** (add one with `/add-assumption` if none), then
   `/review-assumption <its ID>`, choose **Correct**, and enter `Store the data in PostgreSQL, because multiple teachers use it at once`.
   Keep the correction on the same topic as the assumption; correcting a "React app" item with a database choice confuses the agent.
4. Send: *"Continue: describe the data layer, following the reviewed decisions. Do not create files. Stop after this answer."*
   A `[assumption-tracker-decisions]` note appears just before the reply:
   ```text
   - A-001 CORRECTED: instead of "...", do "Store the data in PostgreSQL, because multiple teachers use it at once".
   Do not treat pending or deferred assumptions as approved.
   ```
   The reply should now use PostgreSQL. In our live check it did (see [PROGRESS.md](PROGRESS.md), Phase 5).
5. Exit and run `npm run pi -- -c`. `/assumptions all` shows the same state. `/tree` to an earlier point shows that branch's state.

Tip: end follow-ups with an explicit "stop after this answer". A bare "ok" may be read as permission to start writing files.

## Model setup and troubleshooting
- **Logging in:** in Pi, run `/login`, choose your provider (for example OpenRouter), and paste its API key. If the provider is
  already marked as stored, you don't need to enter it again. Press Esc; an "aborted" message afterwards is harmless. Then
  pick a model with `/model`.
- **"This project is not trusted…"** is expected. `npm run pi` passes `-na`, so Pi ignores this folder's `.pi/` settings and
  loads the extension once, from `-e`. Check `[Extensions] assumption-tracker.ts` at startup and leave `/trust` alone.
- **OpenRouter `402 … requires more credits, or fewer max_tokens`:** Pi asks for the model's full output limit (about 233k
  tokens for some models). Either add credits, or cap the output in `~/.pi/agent/models.json` (create the file if needed):
  ```json
  { "providers": { "openrouter": { "modelOverrides": { "moonshotai/kimi-k2.6": { "maxTokens": 8192 } } } } }
  ```
  Use your model's ID. Reopen `/model` to reload it. This applies to all Pi use on your account, so remove it when you're done.
  Very small caps can truncate replies.
- **`401 API key expired`:** renew the key at the provider and run `/login` again, or switch models with `/model`.

## How it works
- Every created or reviewed event is saved as a custom entry in the Pi session. State is rebuilt from the **active
  branch** on start, resume and `/tree`, so decisions never leak between branches or sessions.
- On each message you send, a short summary of accepted, corrected and rejected items (newest first, ≤1,500 chars, quoted
  as data) is added to that run, but only if it changed since the copy the model still sees. Pending and deferred items are
  never presented as approved.
- Pi writes a new session to disk only after its first chat message. Items added before that are lost on exit, and the
  commands warn you.

Build log per phase: [PROGRESS.md](PROGRESS.md).

## Scripts
| Script | Purpose | Needs a model |
|---|---|---|
| `npm test` | Unit, mock-Pi and real-`SessionManager` tests | no |
| `npm run typecheck` | `tsc --noEmit`, strict mode | no |
| `npm run smoke` | Real Pi (RPC): loads, commands registered, tool active | no |
| `npm run e2e` | Real Pi (RPC): add → correct → list via scripted dialogs | no |
| `npm run pi` | Pi with the extension (`pi -na -e ./.pi/extensions/assumption-tracker.ts`) | yes |
| `npm run pi:baseline` | Pi without the extension, for evaluation | yes |
| `npm run extract -- <session-id> [scenario-id]` | Scoring sheet from a session file (read-only) | no |

`-na` makes Pi ignore the untrusted project `.pi/` folder, so the extension loads once, from `-e`. Pass extra Pi flags after
`--`, for example `npm run pi -- -c`.

## Evaluation
There are 12 scenarios with pre-annotated ambiguities in [scenarios/annotated-assumptions.json](scenarios/annotated-assumptions.json).
Run each with `npm run pi:baseline` and `npm run pi`, then score the session with `npm run extract -- <session-id> <scenario-id>`.

## Layout
```text
src/            types, validation, state (pure), persistence, formatter, extension (Pi wiring)
.pi/extensions/ thin entry point re-exporting src/extension.ts
tests/          vitest suites (no model needed)
scripts/        smoke, e2e, extract-session
scenarios/      evaluation prompts + annotations
```

## Privacy
Assumptions are stored in Pi session files (`~/.pi/agent/sessions/`), alongside the conversation. Don't type secrets into
them. To remove a test session, delete its `.jsonl` file there. The extension makes no network calls; model traffic is
Pi's own, sent to the provider you configure.

## License
[MIT](LICENSE) © 2026 adihem.
Continuous integration (`.github/workflows/ci.yml`) runs typecheck, tests, smoke and e2e on Ubuntu and Windows with no model or secrets.
