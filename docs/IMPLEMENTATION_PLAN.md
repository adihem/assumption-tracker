# Assumption Tracker for AI Coding Agents
## Project Information, System Design, and Step-by-Step Implementation Plan

**Version:** 1.0 — planning specification  
**Date:** 17 October 2026  
**Level:** Undergraduate / beginner–intermediate  
**Target platform:** Pi coding agent, TypeScript extension  
**Deliverable:** Working local Pi extension, tests, example scenarios, and short evaluation report  
**Estimated effort:** 4 weeks part-time (roughly 40–60 focused hours), adjustable based on prior TypeScript experience

> **Status:** This is an implementation specification, not a claim that the software has already been built or tested. Pi's API is evolving. Check the currently installed version's type declarations and official documentation before finalizing integrations. This plan follows the official Pi documentation available in October 2026.

---

## 1. Executive summary

### 1.1 Problem
An AI coding agent can silently make decisions that were not provided by the user: database choice, authentication method, persistence behavior, library choice, error handling, and deployment assumptions. Those choices may be reasonable, but users may not notice them until substantial rework is needed.

### 1.2 Proposed solution
A **Pi extension** that allows the coding agent to report a *candidate assumption* using a structured tool. The extension saves it in the active Pi session, shows a lightweight status/count, and gives the user commands to examine and resolve the assumption: **accept**, **correct**, **defer**, or **reject**. Accepted or corrected decisions are summarized back to the agent at the next relevant turn.

### 1.3 Central design promise
Make assumptions **visible, reviewable, persistent, and actionable**, without interrupting the user for every routine decision. The MVP is an *assumption tracker*, not an automatic safety system or a guarantee of detecting every hidden assumption.

### 1.4 Example
User: "Create a student attendance web app."  
Agent intends to use SQLite without an explicit instruction.  
Extension records: `A-001 | SQLite for local data | medium | pending`.  
User selects `A-001`, changes the assumption to "Use PostgreSQL", adds a note, and confirms.  
The extension records the correction and includes it in the next agent-turn context. The user, not the model, owns the decision.

### 1.5 Primary research question
**Can lightweight, non-blocking assumption tracking help users notice and correct AI coding decisions without requiring frequent interruptive clarification questions?**

Secondary questions (optional): (1) What fraction of scenario assumptions are reported? (2) How many user interventions are needed? (3) Are reviewed decisions reflected in the next agent action?

---

## 2. Scope: build only what is necessary

### 2.1 Required for MVP
- A Pi TypeScript extension that loads without errors.
- A model-callable `record_assumption` tool with structured inputs.
- A slash command `/assumptions` listing session assumptions.
- A slash command `/review-assumption` to select an assumption and record a decision.
- A slash command `/add-assumption` for the human to record a missed assumption.
- A footer count (number of pending assumptions) or small text widget, using built-in Pi UI.
- Persistence in native Pi session entries, including restore on session resume and tree navigation.
- Next-turn context that informs the agent about human-approved corrections and rejections.
- Basic duplicate prevention and input validation.
- Unit tests for all core logic, plus manual Pi integration checks.
- README, demonstration scenarios, short evaluation with clear limitations.

### 2.2 Only after MVP succeeds (optional)
- A separate LLM-based checker that scans an agent's final answer for *missed* assumptions.
- A richer terminal list with keyboard navigation.
- Export selected metadata to JSON/CSV (opt-in, sanitized).
- A rule-based advisor to suggest what deserves review.

### 2.3 Explicitly out of scope
- A new coding agent, autonomous agent scheduler, or multi-agent architecture.
- React dashboard, web server, database, authentication system, Kubernetes, Docker, cloud deployment.
- Continuous monitoring of every token or private filesystem content.
- Training or fine-tuning language models.
- Automatically changing code because a status was clicked.
- Blocking dangerous shell commands: an assumption tracker is **not** a permission/safety extension.
- Guaranteeing 100% identification of hidden assumptions, truthful model confidence, or real-world correctness.

### 2.4 Assumption vs requirement vs decision
- **Requirement:** Explicitly specified by the user; do *not* create an assumption for it.
- **Assumption:** A plausible, not explicitly confirmed choice made by the agent.
- **Candidate assumption:** A possible assumption reported by the model or person, not yet verified.
- **Decision:** A user's recorded action (accepted, corrected, deferred, rejected).
- **Issue/bug:** A defect or failing test; do not automatically label every bug an assumption.

---

## 3. Technology and design decisions

| Area | Choice | Why | Avoided alternative |
|---|---|---|---|
| Platform | Pi coding agent | Built-in LLM workflow and terminal UI | Building an agent runtime |
| Extension language | TypeScript | Native Pi extension interface | Python bridge or HTTP service |
| Runtime | Node.js 22.19+ (for current Pi npm installation) | Matches official Pi quickstart | Old Node versions |
| UI | Pi `ctx.ui` dialogs and footer | Minimal code | React / Next.js |
| AI | Model already configured in Pi | No extra API orchestration | Second model backend |
| Reporting | `pi.registerTool()` | Structured tool inputs from model | Regex on conversation text |
| User commands | `pi.registerCommand()` | Discoverable `/` commands | Separate CLI process |
| Storage | `pi.appendEntry()` plus `getBranch()` | Persist and follow session branch | SQLite / JSON sidecar |
| Data model | Plain TypeScript interfaces | Easy to inspect and test | Class-heavy domain models |
| Tests | Vitest + mock Pi API | Fast and beginner-friendly | Full integration framework |
| Architecture | Small modular monolith | Easy to understand | Microservices / agents |
| Dependencies | Pi packages, `typebox`, Vitest, TypeScript | Justified minimum | Orchestration libraries |

**Compatibility note:** The current official Pi docs use `@earendil-works/pi-coding-agent`; older tutorials may use `@mariozechner/pi-coding-agent`. Use one coherent package family matching the *installed Pi version*, not mixed imports. Exact API signatures should be checked from that installation.

---

## 4. Functional requirements (what must work)

| ID | Requirement | How to verify |
|---|---|---|
| F-01 | Extension loads in Pi | Start `pi --extension ...` without exceptions |
| F-02 | Agent can report a candidate | Agent calls `record_assumption`, receives ID |
| F-03 | Reports have required metadata | Empty or invalid values rejected |
| F-04 | User can list pending/all assumptions | `/assumptions` shows correct counts |
| F-05 | User can manually add a missed assumption | `/add-assumption` creates a record |
| F-06 | User can accept an assumption | `/review-assumption` updates status |
| F-07 | User can correct an assumption | Correction requires non-empty replacement |
| F-08 | User can defer or reject | State preserved; no automatic task execution |
| F-09 | Changes persist across restart | Resume session and see same state |
| F-10 | Session branch state is correct | Branch to earlier point; later changes disappear in that branch |
| F-11 | Next agent turn sees human decision context | Agent acknowledges corrected/rejected decisions |
| F-12 | Duplicates and errors are handled | Duplicate tool calls don't flood list |
| F-13 | No UI environment fails gracefully | Test with noninteractive mode, no prompt attempts |
| F-14 | Test suite passes repeatably | `npm test` cleanly passes |

## 5. Non-functional requirements

- **Simple:** 5–8 small source modules, no more than one third-party UI layer.
- **Fast:** Adding, listing, and reviewing an item should be local operations; no added LLM call is required.
- **Privacy:** Store short assumption summaries, not complete source files, credentials, or prompt transcripts.
- **Control:** User decisions remain authoritative. An agent tool cannot accept/reject on behalf of a user.
- **Reliability:** Invalid state changes must not overwrite good state. Safe restart, branch navigation, and UI errors.
- **Reproducibility:** Fixed mock scenarios for tests; no paid model needed for unit tests.
- **Transparency:** Labels must say "agent-reported assumption", not "detected fact".
- **Accessibility:** Text interface remains understandable without color; the decision summary is readable.

---

## 6. Architecture

### 6.1 Logical diagram

```text
                         USER
                          |
                ordinary task in Pi
                          |
                 +--------v---------+
                 | Pi coding agent   |
                 | existing runtime  |
                 +--------+---------+
                          |
                 record_assumption()
                          |
    +---------------------v----------------------+
    | Assumption Tracker Pi extension           |
    |                                            |
    |  1. Pi integration (tool/commands/events)  |
    |  2. Validate + normalize record            |
    |  3. State store / transitions              |
    |  4. Terminal review interface              |
    |  5. Decision context formatter             |
    +------------+------------------+------------+
                 |                  |
       appendEntry()         ctx.ui dialogs/status
                 |                  |
        +--------v--------+   +-----v----------+
        | Pi session tree |   | Human reviews   |
        | events/entries  |   | and chooses     |
        +--------+--------+   +-----+----------+
                 |                  |
                 +---------+--------+
                           |
             on next user-initiated agent turn
                           |
              concise reviewed-decision context
                           |
                   Pi coding agent
```

### 6.2 Why a modular monolith
One extension process is enough. The tracker contains a pure domain module (validation and state), a small Pi adapter (events/tools/commands), and UI helpers. There is no need for an HTTP API, message queue, database, or agent-to-agent infrastructure.

### 6.3 Key processing flows
**Flow A: Record:** model calls tool → validate fields → check duplicate → assign ID → update in-memory state → persist a Pi custom session entry → return brief confirmation to the model → update pending count.

**Flow B: Review:** user types `/review-assumption` → select item and action → optionally enter corrected text → validate transition → persist decision → update list/count → inform agent on its next ordinary turn.

**Flow C: Restore:** Pi fires `session_start` or `session_tree` → replay custom entries from `ctx.sessionManager.getBranch()` → rebuild state → recalculate pending count → refresh UI.

**Flow D: Context:** on a user-started `before_agent_start`, assemble a short summary of reviewed decisions → add it to that run's model context through the supported event return message, without creating an automatic extra run.

### 6.4 No forced interruption
Creating an assumption **never** opens a blocking modal. The status bar can show `Assumptions: 3 pending`. The user chooses when to review. This is the main human–AI interaction idea being evaluated.

---

## 7. Data contract and storage rules

### 7.1 TypeScript data model

```ts
type Impact = "low" | "medium" | "high";
type Status = "pending" | "accepted" | "corrected" | "deferred" | "rejected";
type Origin = "agent" | "user";

interface Assumption {
  id: string;                  // "A-001", assigned locally
  title: string;               // Short label, 3–80 characters
  description: string;         // What was assumed, 10–500 characters
  reason: string;              // Why the assumption was made, 0–300 chars
  impact: Impact;              // Agent-proposed classification
  status: Status;              // Only user can leave "pending"
  origin: Origin;
  createdAt: string;           // ISO-8601 UTC
  updatedAt: string;           // ISO-8601 UTC
  correction?: string;         // Required for "corrected"
  reviewNote?: string;         // Optional user note
}

type TrackerEvent =
  | { version: 1; event: "created"; assumption: Assumption }
  | { version: 1; event: "reviewed"; id: string; status: Exclude<Status, "pending">;
      timestamp: string; correction?: string; reviewNote?: string };
```

**Why keep the schema small?** Every field must justify its existence. No true confidence score, raw transcript, source-file copies, user identity, or external database keys are needed. The `impact` field is a *proposed* impact label, not verified severity.

### 7.2 Example assumption

```json
{
  "id": "A-001",
  "title": "Use SQLite database",
  "description": "Store attendance records in a local SQLite database.",
  "reason": "The task did not specify a database and this is a simple local default.",
  "impact": "medium",
  "status": "pending",
  "origin": "agent",
  "createdAt": "2026-10-17T08:00:00.000Z",
  "updatedAt": "2026-10-17T08:00:00.000Z"
}
```

### 7.3 State transitions

```text
             +----------+
             | pending  |
             +----+-----+
                  |
        +---------+----------+-----------+
        |         |          |           |
        v         v          v           v
     accepted  corrected  deferred    rejected
                            |
                            v
                    (can be reviewed
                     later by user)
```

- `pending -> accepted`: user approves original choice.
- `pending -> corrected`: user supplies an alternative.
- `pending -> deferred`: user postponed the decision.
- `pending -> rejected`: original assumption is not permitted; no replacement is provided.
- `deferred -> accepted/corrected/rejected`: allowed upon later review.
- For simplicity, the first release treats accepted/corrected/rejected as final. A future revision could support reopening with an audit event.
- User-only transitions: the `record_assumption` tool *cannot* set a reviewed status.
- "Reject" **does not** imply deleting or undoing already-written source code; it records the user's instruction for subsequent work.

### 7.4 Session persistence mechanism
Use Pi's `pi.appendEntry("assumption-tracker", eventData)` for each created or reviewed event. Reconstruct from `ctx.sessionManager.getBranch()` and apply entries where `entry.type === "custom" && entry.customType === "assumption-tracker"`.

**Rationale:** Current Pi docs say custom entries are durable but excluded from model context, and recommend rebuilding branch-sensitive state from `getBranch()`. This avoids writing our own database and prevents abandoned session branches from corrupting current state.

### 7.5 Reducer and deterministic replay
Implement pure functions:

```ts
createEmptyState(): TrackerState
applyEvent(state: TrackerState, event: TrackerEvent): TrackerState
replayEvents(events: TrackerEvent[]): TrackerState
nextId(state: TrackerState): string
findDuplicate(state: TrackerState, candidate: NewAssumption): Assumption | undefined
```

`TrackerState` may simply contain `Map<string, Assumption>` and an integer `nextNumber` (computed from maximum seen ID). Use serial event replay; reject invalid or unknown versions gracefully. Never mutate state during rendering.

### 7.6 Duplicate strategy
Start with exact/near-exact normalized text: lowercase + trim + collapse spaces for `title` and `description`. If an active item with the same normalized text already exists, return the existing ID rather than create a new one. No semantic embeddings or second LLM required. Do not merge a new candidate into a previously rejected item automatically; report it as possibly related.

### 7.7 Privacy and retention
Because custom entries live in the Pi session, users should treat them as session history. Use no secrets in assumption text; apply length limits; do not include full code contents in exported files. The extension should not contact a new third-party service. Existing Pi agent/provider traffic continues as configured by the user. Document where Pi session files are stored and how to remove a test session.

---

## 8. Folder and code organization

```text
assumption-tracker/
├── README.md                       # Install, run, examples, limitations
├── package.json                    # Dependencies and scripts
├── package-lock.json               # Reproducible npm install
├── tsconfig.json                   # Strict TypeScript settings
├── .gitignore                      # node_modules, secrets, local outputs
├── .pi/
│   └── extensions/
│       └── assumption-tracker.ts   # Thin Pi entry-point (imports modules)
├── src/
│   ├── types.ts                    # Assumption/Event/State interfaces
│   ├── validation.ts               # Input checks and duplicate helper
│   ├── state.ts                    # Pure create/review/replay operations
│   ├── persistence.ts              # Pi session event adapter
│   ├── formatter.ts                # Lists, status, model-context summary
│   └── extension.ts                # Tool, commands, event registration
├── tests/
│   ├── validation.test.ts
│   ├── state.test.ts
│   ├── formatter.test.ts
│   └── integration.test.ts         # Mock Pi API contracts
├── scenarios/
│   ├── attendance-app.md
│   ├── todo-app.md
│   ├── login-app.md
│   └── annotated-assumptions.json
└── docs/
    ├── ARCHITECTURE.md
    ├── TEST_PLAN.md
    ├── EVALUATION.md
    └── KNOWN_LIMITATIONS.md
```

**Practical simplification:** Begin with `src/types.ts`, `src/state.ts`, `src/extension.ts`, and a single test file. Split modules only after core behavior works. This target tree represents the finished organization, not a requirement to create many empty files on day one.

### 8.1 Responsibility of each module
- `types.ts`: type aliases/interfaces; no side effects.
- `validation.ts`: empty/oversized input checks, remove extra whitespace, enforce valid status/correction.
- `state.ts`: create record, update status, next ID, duplicate detection, apply/replay events. No Pi imports.
- `persistence.ts`: convert Pi custom branch entries to tracker events; persists after successful state transitions.
- `formatter.ts`: stable text summaries for UI, status, agent context; cap lengths.
- `extension.ts`: registers Pi tool and commands; bridges state logic, persistence, UI.
- `.pi/extensions/assumption-tracker.ts`: imports/re-exports default extension factory using a stable relative path.

### 8.2 Coding conventions
- Use camelCase functions, PascalCase types, descriptive names.
- Strict TypeScript mode; avoid `any` unless adapting a third-party API with a comment.
- Prefer pure functions for validation and state transitions.
- Functions should generally perform one operation (roughly 10–35 lines where reasonable).
- Centralize UI strings and schema constants; no magic numbers scattered across files.
- Avoid classes unless a class clearly simplifies a mutable adapter.
- No global mutable state outside the Pi extension factory.
- Never log full model prompts or sensitive files in error messages.
- Use a single event type name constant such as `ASSUMPTION_ENTRY_TYPE = "assumption-tracker"`.

---

## 9. Pi APIs and integration design

### 9.1 Required APIs (confirmed by official docs)
- `pi.registerTool()` — expose structured `record_assumption` to the LLM.
- `pi.registerCommand()` — add `/assumptions`, `/review-assumption`, `/add-assumption`.
- `pi.on("session_start", ...)` — reconstruct tracker on start/resume/reload.
- `pi.on("session_tree", ...)` — reconstruct after moving within session history.
- `pi.on("before_agent_start", ...)` — include a compact human-decision summary on the next run.
- `pi.appendEntry()` — store tracker events.
- `ctx.sessionManager.getBranch()` — load active branch only.
- `ctx.ui.notify()`, `ctx.ui.select()`, `ctx.ui.input()`, `ctx.ui.setStatus()` — simple UI.

**Do not** start with `ctx.ui.custom()`; keyboard handling, rendering, and layout add avoidable complexity. Only consider custom TUI after the text/dialog version works.

### 9.2 Registration sketch (illustrative, not full application)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

export default function assumptionTracker(pi: ExtensionAPI) {
  pi.registerTool({
    name: "record_assumption",
    label: "Record assumption",
    description: "Record a candidate unstated coding decision; do not claim user approval.",
    parameters: Type.Object({
      title: Type.String(),
      description: Type.String(),
      reason: Type.String(),
      impact: StringEnum(["low", "medium", "high"] as const),
    }),
    async execute(_callId, params, _signal, _update, ctx) {
      // 1. Validate params
      // 2. Check duplicate
      // 3. Construct 'created' event
      // 4. Apply to state + persist via pi.appendEntry
      // 5. Refresh status, return ID
      return {
        content: [{ type: "text", text: "Assumption recorded (example)" }],
        details: { example: true },
      };
    },
  });

  pi.registerCommand("assumptions", {
    description: "Show candidate assumptions in this session",
    handler: async (_args, ctx) => { /* format and show */ },
  });
}
```

The snippet is **a wiring sketch**, not a finished executable implementation. The tool body must be completed with the domain functions, and the type definitions should be verified against the installed Pi package.

### 9.3 Model-facing tool usage guidance
Use the Pi tool's model-facing `description`/`promptGuidelines` to say:

> Call `record_assumption` when you choose a meaningful default or design interpretation that the user did not specify, especially choices that affect data storage, security, dependencies, interoperability, or work that is expensive to reverse. Do not record explicitly given requirements. Keep the description concise and avoid secrets. Recording does not mean the user approved the choice. Do not call for trivial implementation details unless they affect the user's goals.

This is *behavior guidance*, not a guarantee of compliance. Evaluation must count missed assumptions too.

### 9.4 Command design

| Command | User effect | Implementation |
|---|---|---|
| `/assumptions` | Show pending/deferred list and brief totals | Format state, UI notification or text panel |
| `/assumptions all` | Show reviewed + unresolved | Parse optional command argument |
| `/review-assumption` | Select assumption and action | `ui.select`, then optional `ui.input` |
| `/add-assumption` | Manually record a missed candidate | Two/three simple `ui.input` calls |
| `/assumptions-help` | Show status meanings | Fixed text notification |

No special syntax parser is required. Prefer interactive selection to asking the user to memorize IDs. If `ctx.hasUI` is false, commands must give a clear text diagnostic and avoid dialogs.

### 9.5 Review command in detail
1. Check whether `ctx.hasUI` supports the required UI method; if not, exit gracefully.
2. Gather `pending` and `deferred` assumptions from the state.
3. If none, notify "No assumptions awaiting review."
4. Let user choose one short label (`A-001 — Use SQLite`).
5. Show title, description, reason, proposed impact, and current status.
6. Present actions: accept, correct, defer, reject, cancel.
7. For correction, request text and reject an empty value.
8. Optional review note (may be skipped).
9. Build a `reviewed` event; use domain validation; persist it.
10. Re-render list/count and show confirmation.
11. **Do not** resume an agent run automatically; user decides when to continue.

### 9.6 Restore and session lifecycle
Register `session_start` and `session_tree` handlers to reconstruct state from current branch. Implement `reconstruct(ctx)` as a pure replay from custom entries; it must not accidentally persist anything while restoring. Do not use `getEntries()` for branch-sensitive tracking because abandoned branches should not be mixed in.

### 9.7 Agent decision context
Because `appendEntry()` deliberately excludes tracker events from the model's transcript context, create a separate, concise model-facing summary at the *next user-initiated run*. In `before_agent_start`, if `event.messageType !== "user"`, return without injection. Otherwise return a supported custom message for that run containing relevant accepted/corrected/rejected decisions, for example:

```text
Human-reviewed project decisions for the current Pi session:
- A-001 CORRECTED: Use PostgreSQL, not SQLite.
- A-004 REJECTED: Do not add social login without a new user request.
Do not treat pending or deferred assumptions as approved.
```

Constraints: cap summary to about 1,500 characters; include newest/relevant reviewed decisions first; no raw code; do not echo everything every tool call; do not create a second model run. Test with an ordinary user turn that the decision is actually visible to and followed by the agent.

**Important:** Agent compliance is not mechanically guaranteed by context injection; it must be evaluated. The extension does not automatically alter files or roll back past actions.

### 9.8 UI status
Display something like `Assumptions: 2 pending, 1 deferred` via `ctx.ui.setStatus()` when interactive. Clear/recalculate when sessions or branches change. Text must remain useful without emoji or color.

### 9.9 Parallel tool calls
Pi can execute sibling tool calls concurrently. Avoid a read–modify–await–write gap during updates. For the undergraduate project, keep the state transition and `appendEntry` call synchronous within the execute handler before awaiting anything else. If future I/O is needed inside writes, add a small serialized promise queue and a test for simultaneous calls.

---

## 10. Deterministic algorithm design

### 10.1 Create a candidate

```text
function record(input, origin):
    normalize and validate input
    if invalid: return structured error; do not modify state
    if exact active duplicate found: return existing ID
    id = next identifier based on state
    assumption = build record(status=pending, timestamps=now)
    event = { version:1, event:"created", assumption }
    nextState = applyEvent(currentState, event)
    persist event to Pi session
    commit nextState as currentState
    refresh UI count
    return ID and short confirmation
```

### 10.2 Review an existing assumption

```text
function review(id, action, correction?, note?):
    find ID; reject missing ID
    validate transition from pending/deferred
    require replacement text if action=corrected
    build reviewed event with timestamp
    compute nextState through reducer
    persist event
    commit nextState
    update UI
    return confirmation
```

Persistence should be attempted before replacing in-memory state if the append operation can fail; failure must not lead to a UI success message. Pi's append API may have different synchronous semantics across releases; test its actual behavior.

### 10.3 Replay

```text
function replay(activeBranchEntries):
    state = emptyState()
    for entry in activeBranchEntries ordered by session order:
        if custom assumption-tracker entry:
            parse version/type/data
            if valid: state = applyEvent(state, data)
            else: report unsupported/invalid entry, ignore safely
    return state
```

Unknown versions should not crash the extension. A new event must not be re-appended while replaying (prevents duplication).

### 10.4 Formatting
Display unresolved first; group by impact if helpful. Truncate long descriptions in list view but show full stored text during review. IDs must stay stable in a single session branch.

---

## 11. Input validation and error states

| Input/problem | Expected behavior |
|---|---|
| Empty title or description | Reject, show clear message |
| Too-long text | Reject or truncate only after explaining limit; prefer rejection |
| Invalid impact string | Reject; only `low`, `medium`, `high` allowed |
| Explicit user instruction reported as assumption | Prompt discourages this; human can reject; evaluator counts false positive |
| Repeated tool call | Return existing active item ID |
| Unknown assumption ID | Do not change state; show error |
| Correct action without replacement | Ask again or cancel |
| UI cancel/ESC | Return without changing state |
| Already-final item | Do not silently overwrite; explain no re-review in v1 |
| Invalid persisted entry | Skip with warning; retain good entries |
| Pi resumed into earlier branch | Rebuild only current branch |
| No UI available | Tool remains functional; interactive command fails gracefully |
| Model fails to call tool | Manual add remains available; record as detection miss |
| Sensitive content in a candidate | Avoid logging/export; document user responsibility |

No automatic retry loop is needed in the MVP.

---

## 12. Environment setup (Windows, Linux, macOS)

### 12.1 Prerequisites
- Node.js 22.19+ for Pi's currently documented npm installation.
- npm, Git, VS Code (or any code editor).
- Pi coding agent and a supported model/provider login or local model.
- Familiarity with basic TypeScript syntax and `npm` scripts.

### 12.2 Pi installation and verification

```bash
node --version
npm --version
git --version
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
pi
```

In Pi, use `/login` and then `/model` as needed. API subscriptions or usage may incur costs; pure unit tests should not require a model.

**On Windows:** Pi supports native Windows with Git Bash or Windows Subsystem for Linux (WSL). Follow the official Windows configuration instructions; do not mix Windows paths with a WSL-only installation.

### 12.3 Initialize project

```bash
mkdir assumption-tracker
cd assumption-tracker
git init
npm init -y
npm install -D typescript vitest @types/node
npm install @earendil-works/pi-coding-agent @earendil-works/pi-ai typebox
npx tsc --init
```

Verify dependency versions are compatible with your installed Pi. Pin versions after the initial working build. Add a `typecheck` script using `tsc --noEmit` and a `test` script using `vitest run`. Enable TypeScript `strict: true` and appropriate Node ESM settings.

**Note:** The global Pi CLI, the project-local development dependencies, and a project-local extension loader may resolve modules differently. First verify a minimal hello extension loads; do not proceed to full architecture until imports work.

### 12.4 Load the extension during development

```bash
pi --extension ./.pi/extensions/assumption-tracker.ts
```

Pi's current docs also support project-local auto-discovery at `.pi/extensions/`. The explicit flag is useful for initial testing. Use Pi's documented reload behavior to test changes; do not assume a reloaded extension retains closure state.

---

## 13. Detailed build sequence and acceptance criteria

### Phase 0 — Environment and minimal integration (2–3 hours)
**Steps**
1. Install/verify Node, npm, Git, Pi.
2. Authenticate a provider or select a compatible local model.
3. Create Git repository and scripts.
4. Add an extension with a single `/tracker-hello` command.
5. Start Pi using `--extension` and invoke the command.
6. Commit a working baseline.

**Done when:** `/tracker-hello` displays a notification; no load errors; `npm run typecheck` passes.

### Phase 1 — Domain types and pure state (4–6 hours)
1. Implement types/interfaces and constants.
2. Write validation of title/description/reason/impact.
3. Implement `createEmptyState`, `applyEvent`, `nextId`, `findDuplicate`.
4. Write tests first for creating, reviewing, and replaying.
5. Implement pending/deferred selection and counts.

**Done when:** Domain tests pass without launching Pi or calling an API.

### Phase 2 — Model-callable assumption registration (4–6 hours)
1. Register `record_assumption` with TypeBox schema.
2. Map tool inputs to domain event.
3. Reject invalid inputs before persistence.
4. Persist with Pi session custom entries.
5. Return ID and clear message to model.
6. Add prompt guidance in tool description.
7. Test with the attendance-app scenario.

**Done when:** One genuine agent tool call creates an assumption visible after restart.

### Phase 3 — User review commands (5–7 hours)
1. Implement `/assumptions` listing.
2. Implement `/add-assumption` with user input.
3. Implement `/review-assumption` selection.
4. Implement four actions (accept/correct/defer/reject).
5. Save review decisions and update status.
6. Test cancellation and missing IDs.

**Done when:** Human can review and change an item without the agent running again.

### Phase 4 — Correct session behavior (4–6 hours)
1. Implement `reconstruct()` from active branch.
2. Rebuild state at `session_start`.
3. Rebuild state at `session_tree`.
4. Test fresh session vs resumed session.
5. Test a branch created before a review decision.
6. Confirm duplicate prevention and ID assignment after branching.

**Done when:** No stale decisions appear from another branch or unrelated session.

### Phase 5 — Inform the agent of review decisions (3–5 hours)
1. Format concise accepted/corrected/rejected decisions.
2. Inject on the next *user-initiated* agent start via the supported event result.
3. Limit message size and exclude deferred/pending from approved context.
4. Test with a corrected database choice.
5. Verify Pi does not auto-run or create extra turns when review happens.

**Done when:** The agent can see a corrected instruction after a human review, and the extension does not claim to enforce it automatically.

### Phase 6 — Polish and evaluation (6–10 hours)
1. Add footer count; optional list sort and useful messages.
2. Write README with installation, commands, and expected output.
3. Build 10–15 fixed scenarios with ground-truth assumptions.
4. Run manual end-to-end checks and collect results.
5. Document design limitations and failures.
6. Create a short screen recording and final report.

**Done when:** Another student can install, run, and understand the project from its README.

---

## 14. Test strategy

### 14.1 Unit tests (no model provider needed)
Recommended core tests:
1. Can create valid low-impact assumption.
2. Cannot create empty title.
3. Cannot create invalid impact.
4. Can normalize whitespace.
5. Can detect duplicate pending item.
6. Duplicate returns original ID.
7. Can accept pending item.
8. Can correct pending item with replacement.
9. Cannot correct without replacement.
10. Can defer pending item.
11. Can later review deferred item.
12. Can reject pending item.
13. Cannot silently modify finalized item.
14. Replays created + reviewed sequence deterministically.
15. Ignores malformed or future-version entries safely.
16. Derives next ID from replayed branch.
17. Builds model context with no pending items called approved.
18. Caps output length and sorts stably.
19. Empty state list shows helpful message.
20. No state mutation occurs when review is cancelled.

### 14.2 Integration tests with mocked Pi interfaces
- Tool registration includes required fields and valid schema.
- A tool execution produces one persisted event and an ID.
- Command review produces one review event, or zero on cancel.
- `session_start` rebuilds state from a mock branch.
- `session_tree` recomputes branch-specific state.
- `before_agent_start` handles user vs custom starts properly.
- `ctx.hasUI === false` avoids calling interactive dialogs.
- Simulate two records arriving close together; assert unique IDs and no missing events.

### 14.3 Manual system tests inside Pi
**S1. Happy path:** Agent reports SQLite, user accepts; status persists.
**S2. Correction:** User changes SQLite to PostgreSQL, next agent response reflects instruction.
**S3. Defer:** User defers a UI-color assumption, can later review.
**S4. Reject:** User rejects unrequested social login; agent sees rejection next turn.
**S5. Missing assumption:** Agent overlooks assumption; human adds it manually.
**S6. Duplicate:** Model reports same assumption twice; one active item remains.
**S7. Restart:** Exit/resume Pi; state is restored.
**S8. Branch:** Branch before correction; correction does not appear on earlier branch.
**S9. Invalid values:** Empty fields/unsupported status have clear errors.
**S10. Noninteractive mode:** No blocking UI calls or crash.

### 14.4 Definition of a passing release
- All unit tests green.
- At least the ten listed manual system scenarios attempted and recorded, with blockers resolved or explicitly documented.
- Demonstration can be reproduced by following README.
- No required feature relies on a separate custom LLM API or paid test account.
- No misleading claim of complete or reliable automatic assumption detection.

---

## 15. Evaluation design (small undergraduate study)

### 15.1 Main comparison
Compare two conditions on the same type of coding task:
- **Baseline:** Ordinary Pi interaction with no assumption-tracking extension.
- **Tracker:** Pi with model-reported assumptions and human review commands.

Optional third condition: an "always ask" instruction that explicitly asks for clarification whenever an important choice is not specified. This third condition is harder to standardize; leave it out if time is limited.

### 15.2 Benchmark materials
Create 10–15 short coding prompts (login screen, attendance app, task manager, small REST API, file upload, etc.). For each, annotate 1–3 deliberate ambiguities and list what counts as detecting the ambiguity. Do not create labels after seeing the model's results. Keep the same model, prompt text, and configuration when comparing conditions. Capture the model/version and experiment date.

### 15.3 Metrics and equations

**Candidate recall (scenario-based):**

```text
recall = number of predefined assumptions reported / total predefined assumptions
```

**False-positive fraction:**

```text
false_positive_fraction = reported items judged not to be assumptions / total reported items
```

**Review interaction count:** count manual review actions (accept/correct/defer/reject) per task.

**Missed critical decisions:** number of predefined medium/high-impact ambiguities not surfaced for review.

**Correction uptake:** fraction of corrected decisions reflected by the agent in its following output. This is a qualitative/manual coding metric at first; avoid claiming automated semantic enforcement.

**Time/rework (optional):** time spent reviewing or correcting, recorded consistently. If testing people, record self-reported effort and usability notes.

### 15.4 Pilot protocol
1. Freeze the scenario list and annotation guide.
2. Run several dry runs to verify prompts produce meaningful ambiguities.
3. Evaluate the baseline and tracker in comparable conditions.
4. Independently assess candidate assumption correctness using the pre-written annotation guide.
5. Report counts, percentages, and representative examples.
6. Analyze failures: missed assumption, trivial false positive, incorrect impact, confusing text, ignored human correction.
7. State limitations: small sample, prompt/model variability, self-report bias, subjectivity of some annotations, simulated tasks.

If conducting a human-user study, request informed consent, avoid real passwords/data, and check university ethics/data-handling requirements. A 5–8 participant formative usability pilot is optional, not necessary to prove a strong final claim.

### 15.5 Success targets (design goals, not promised results)
- A user can review a single assumption in under five interactions.
- The tracker does not itself create mandatory interruptions when candidates are recorded.
- State survives restart and respects branch history in all prepared tests.
- Most benchmarked scenarios should produce at least one useful candidate, but report actual results even if performance is poor.
- Demonstrate at least one corrected choice that changes the agent's subsequent plan/output.

---

## 16. Example end-to-end demonstration

**Step 1:** Start Pi with the extension loaded.

**Step 2:** User prompt: "Create a simple attendance tracker. Students can be added and marked present."

**Step 3:** Agent chooses local SQLite storage. Following tool guidance, agent invokes `record_assumption` with title/description/reason/impact. Pi extension returns `A-001`.

**Step 4:** Pi footer shows `Assumptions: 1 pending` rather than interrupting work.

**Step 5:** User types `/assumptions`, sees `A-001 | SQLite local storage | medium | pending`.

**Step 6:** User types `/review-assumption`, chooses `A-001`, selects **Correct**, enters `Use PostgreSQL, because multiple users will access the service`.

**Step 7:** Extension saves a `reviewed` event and updates status to `corrected`.

**Step 8:** User sends ordinary chat message: "Continue with implementation and follow the reviewed decisions."

**Step 9:** `before_agent_start` injects the human-approved corrected decision into model context. Agent should reflect the change, but automated file modifications remain subject to the agent's ordinary permissions and are separately testable.

**Step 10:** User exits and resumes Pi; the item remains corrected. On navigation to an earlier branch, the previous status is restored appropriately.

---

## 17. Safety, integrity, and honest limitations

1. **Candidate ≠ fact:** LLMs can miss assumptions or propose false ones; manual review is necessary.
2. **Confidence ≠ permission:** No numeric confidence is needed for MVP; the user is authoritative.
3. **Tracking ≠ enforcement:** A `rejected` state does not stop Pi's built-in shell or edit tools. Do not advertise this as a safety gate.
4. **Potential code changes before review:** Non-blocking tracking may record an assumption after work has started; it is intended to increase awareness, not prevent all rework. A later project could implement permission gates for consequential operations.
5. **Security:** Pi extensions run with powerful local permissions; load trusted code only. No unnecessary network access in our extension.
6. **Prompt injection:** Assumption descriptions may contain untrusted text. Treat them as data in displays and model summaries, not executable instructions. Bound length; never evaluate or execute content.
7. **Privacy:** No private code/transcripts in GitHub evaluation fixtures. Use synthetic examples.
8. **Portability:** Match Pi's current package namespace and extension API; maintain compatibility notes.
9. **Branching:** Decisions only apply within their Pi session branch; do not use a global mutable preferences file.
10. **Model compliance:** Even accepted human decisions may be misunderstood. Verify whether the agent uses corrections properly in subsequent output.

---

## 18. Risk and mitigation table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pi API mismatch after upgrade | Medium | Medium | Check docs/types; pin versions after baseline |
| Agent does not call tool | High | Medium | Clear tool guidance; manual add; measure recall |
| Too many trivial candidates | Medium | Medium | Guidance and dedup; user can reject |
| State disappears after restart | Medium | High | Native session entries + resume tests |
| Branch state leaks | Medium | High | `getBranch()` reconstruction + branch tests |
| Next turn ignores correction | Medium | High | Inject compact context; explicit scenario tests |
| Complex UI slows implementation | High | Medium | Simple select/input only; no custom TUI v1 |
| Privacy leakage in screenshots | Medium | High | Synthetic tasks; redact screenshots |
| Scope creep into advisor framework | High | High | Freeze MVP and document optional future work |
| Hardware / API costs | Low | Low/Medium | No hardware; deterministic unit tests; small model usage |

---

## 19. Project schedule and milestones

| Week | Primary tasks | Required output | Completion check |
|---|---|---|---|
| 1 | Setup, domain types, reducer, validation/tests | Pi hello extension + passing unit tests | Toolchain and tests run |
| 2 | `record_assumption`, persistence, list | Agent-reported candidates persist | Restart works |
| 3 | Review command, manual add, session branching, next-turn context | Full human-review workflow | End-to-end demo works |
| 4 | QA, prepared evaluation, README, report | Reproducible repository and results | Tests + ten scenarios documented |

**Approximate effort:** 40–60 hours. If you are new to TypeScript, add a few days for syntax and npm familiarity. This is a planning estimate, not a guaranteed completion time.

**Milestone gates:** Do not begin optional detection or advisor features until all of Week 3 works correctly, including session restore and human-decision context.

---

## 20. Roles if 2–3 undergraduate team members collaborate

**Student 1 — Core state & testing:** type contract, reducer, validation, duplicate logic, unit tests.  
**Student 2 — Pi integration & UI:** extension, tool/command registration, session events, UI review flow.  
**Student 3 (optional) — Evaluation & documentation:** scenarios, annotation rubric, experiments, user-facing README and report.

All contributors must cross-review the integrated workflow. Split work by modules only after agreeing on the shared `Assumption` and `TrackerEvent` contract. A single student can also complete the full MVP.

---

## 21. Documentation and final submission checklist

### Repository contents
- [ ] Running Pi extension source
- [ ] Locked, reproducible dependency versions
- [ ] Installation instructions tested from fresh clone
- [ ] Commands table with screenshots or GIF
- [ ] Sample scenario and walkthrough
- [ ] Architecture diagram and data model
- [ ] Tests + repeatable test command
- [ ] Evaluation scenarios and labeled ground truth
- [ ] Actual (not invented) results with baseline definition
- [ ] Limitations and threat/ethics notes
- [ ] License and contributors (if publishing)

### Final demo checklist
- [ ] Pi successfully loads extension
- [ ] Agent creates candidate through tool
- [ ] Status shows pending count
- [ ] Human reviews assumption
- [ ] Review persists
- [ ] Corrected decision reaches agent next turn
- [ ] Restart + branch test succeed
- [ ] Unit tests pass
- [ ] README describes limits and reproduces demo

### Target resume claim (only after achievement is real)
"Built a TypeScript extension for the Pi coding agent to record implicit development assumptions, support human review decisions, and persist corrections across sessions; evaluated the workflow using structured test scenarios."

Add a quantified result only after measuring one.

---

## 22. Starting instructions for AI coding tools (optional)

If using an AI coding assistant, do **not** simply ask it to build the complete project in one pass. Use this staged instruction:

> Read `ASSUMPTION_TRACKER_IMPLEMENTATION_PLAN.md` completely. Build only Phase 0 first. Verify the installed Pi package imports and extension API against its local type declarations. Implement a minimal working extension and a typecheck script. Show the exact files changed and actual command output. Then proceed one phase at a time. For each phase, first explain your design, implement the smallest working slice, add tests, run checks, and update `PROGRESS.md`. Follow the agreed data contract and do not add a web frontend, database, external LLM service, multi-agent architecture, or extra dependencies unless essential. Never claim tests passed without executing them. Do not proceed past a failed acceptance gate until fixed.

Suggested per-phase continuation prompt:

> Implement Phase [X] only. Preserve previous working features. Add the tests listed for this phase. Report files changed, commands executed, test results, unresolved issues, and the next small step.

---

## 23. Official references (checked October 2026)

1. Pi Extensions — https://pi.dev/docs/latest/extensions
2. Pi Quickstart — https://pi.dev/docs/latest/quickstart
3. Pi on Windows — https://pi.dev/docs/latest/windows
4. Pi TypeScript extension types — https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts
5. Official Pi todo extension (tool + session replay example) — https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/todo.ts
6. Pi extension examples — https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions

---

## 24. Final recommendation

Implement the **smallest honest system that works end-to-end**: report → store → show → review → inform agent → persist across session changes → test. The value of the project is not architectural complexity. It is providing a transparent interaction mechanism and demonstrating through controlled examples where it helps and where it fails.

**Do not start by building an advanced automatic assumption detector.** That would change the project from a human–AI interaction prototype into a difficult extraction/verification system. The explicit tool-reporting approach is a realistic undergraduate foundation and gives a clear comparison point for later research.
