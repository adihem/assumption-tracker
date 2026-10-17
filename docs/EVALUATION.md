# Evaluation

**Question:** Can lightweight, non-blocking assumption tracking help users notice and correct AI coding decisions
without frequent interruptive clarification questions?

This is a small, formative evaluation: five scenarios, one model, and simulated task runs. Report the actual numbers,
including poor ones. Four runs were delegated to simulated personas; they are not independent human participants.

## Materials
- 12 scenarios with 3 pre-annotated ambiguities each: [`scenarios/annotated-assumptions.json`](../scenarios/annotated-assumptions.json).
  The annotations were frozen on 2026-10-17, before the evaluation runs. Don't change them after seeing results.
- Every prompt gets the suffix *"For now, only describe your plan and technology choices; do not create any files."*,
  so runs never modify the repository.

## Conditions
| Condition | Start Pi with | What counts as "surfaced" |
|---|---|---|
| Baseline | `npm run pi:baseline` (Pi without the extension) | The reply explicitly states the choice as an assumption or asks about it |
| Tracker | `npm run pi` | The agent recorded it with `record_assumption`, or the reply explicitly states it as above |

Use the same model, thinking level, prompt text and date range for both conditions. Write down the model ID and Pi version
(1.3.0).

## Procedure (per scenario and condition)
1. Start a **fresh** session (`npm run pi` or `npm run pi:baseline`).
2. Paste the scenario `prompt` + `promptSuffix` exactly. Wait for the reply. Do not nudge.
3. Tracker only: with `/review-assumption`, correct one medium/high item, if one was recorded. Then send
   *"Continue: describe that part in more detail, following the reviewed decisions. Do not create files. Stop after this answer."*
4. Exit. Note the session ID that Pi prints (`To resume this session: pi --session <id>`).
5. Run `npm run extract -- <id> <scenario-id>` and paste the output below. Fill in the Y/N column using the `countsIf` text,
   **without changing it**.

## Metrics
- **Recall** = surfaced ambiguities / annotated ambiguities (per condition; 36 per condition for all 12 scenarios).
- **False-positive fraction** = agent-reported items that are not real assumptions / all agent-reported items (tracker only).
- **Missed critical** = medium/high ambiguities not surfaced.
- **Review interactions** = accept/correct/defer/reject actions per scenario.
- **Correction uptake** = corrected decisions reflected in the next reply / corrected decisions (judged manually).
- **Interruptions** = blocking dialogs caused by recording. This is 0 by design; confirm that none happened.

## Results

### Pilot runs during development (not the formal evaluation)
These used the S01 prompt while the extension was still changing, so they only show feasibility.

| Run | Model (OpenRouter) | Recorded | Recall (S01) | Notes |
|---|---|---|---|---|
| P1 | nvidia/nemotron-3.5-super-vl:free, thinking off | 0 | 0/3 | Chose React, localStorage and Vite without recording anything; this was before the "plan-only turns" guideline |
| P2 | thinkingmachines/inkling:free, medium | A-001 "Data storage choice" | 1/3 (storage) | Footer and restart OK |
| P3 | thinkingmachines/inkling:free, medium | A-001 "In-memory web app" | storage ✓; app-type: one item covers both (evaluator to judge) | Correction to PostgreSQL taken up in the next reply (uptake 1/1); a single decisions injection |

Practical issue: OpenRouter free tiers returned many `402` errors (Pi requests ~233k max tokens) before a call succeeded.

### Formal runs

Run on 2026-10-17 with Pi 1.3.0 and `openrouter/moonshotai/kimi-k2.6` at medium thinking. Each condition used a fresh
session and the exact annotated prompt plus the documented suffix. Every session was passed to
`npm run extract -- <session-id> <scenario-id>`; the session IDs and filled Y/N scores are below. Token caps were matched
within each pair: S01, S03 and S05 used 262,144 context / 8,192 max output; S02 and S04 used 8,192 / 4,096.

The four delegated runs used distinct simulated perspectives: Clara (methodical first-time student, S02), Max (hurried
but capable student, S03), Sam (skeptical engineering student, S04), and Nina (privacy-first student, S05). The primary
operator ran S01 and the README check. These perspectives add task variation, not human-subject evidence.

| Condition | Model | Scenarios | Recall | Missed medium/high | False-positive fraction | Correction uptake |
|---|---|---:|---:|---|---:|---|
| Baseline | `openrouter/moonshotai/kimi-k2.6` | 5/12 | **12/15** | 3: S01 auth (high), S02 multi-user (medium), S04 API auth (high) | n/a | n/a |
| Tracker | `openrouter/moonshotai/kimi-k2.6` | 5/12 | **11/15** | 4: S01 auth (high), S02 multi-user (medium), S03 auth-method and password-storage (both high) | **0/10** | **3/3 observable**; one additional correction could not be observed |

Each scenario had three annotated ambiguities. “Y/N” follows the annotations' `countsIf` rules; order is the annotation
order in `scenarios/annotated-assumptions.json`. A tracker item only counts as surfaced when recorded or explicitly
stated as an assumption/asked about in the first reply. S03's password and password-hashing design was not recorded or
framed as an assumption, so it is N under that rule.

| Scenario | Condition | Session ID | Y/N by annotation | Recall | Missed medium/high |
|---|---|---|---|---:|---|
| S01 attendance | Baseline | `01a14aca-133b-77c3-b38e-290998065638` | storage Y; app-type Y; auth N | 2/3 | auth (high) |
| S01 attendance | Tracker | `01a14ac7-0389-733d-875a-7dfa8f37997d` | storage Y; app-type Y; auth N | 2/3 | auth (high) |
| S02 todo | Baseline | `01a14acb-45d5-750a-aa41-882ceae6d2c5` | storage Y; multi-user N; platform Y | 2/3 | multi-user (medium) |
| S02 todo | Tracker | `01a14acc-52fa-752a-b49f-dfff42bfb54e` | storage Y; multi-user N; platform Y | 2/3 | multi-user (medium) |
| S03 login | Baseline | `01a14ad0-8b9f-7244-848a-856096ef1426` | auth-method Y; password-storage Y; session Y | 3/3 | none |
| S03 login | Tracker | `01a14ad2-0d8f-772f-9943-7f7ce3c1c494` | auth-method N; password-storage N; session Y | 1/3 | auth-method (high), password-storage (high) |
| S04 REST API | Baseline | `01a14ac7-7c51-73d6-8712-b3a788c7f10c` | framework Y; storage Y; api-auth N | 2/3 | api-auth (high) |
| S04 REST API | Tracker | `01a14ac8-3830-746d-b546-ca9c47c0abed` | framework Y; storage Y; api-auth Y | 3/3 | none |
| S05 file upload | Baseline | `01a14ad5-3752-7475-8e34-cf8dd12e9940` | upload-storage Y; limits Y; processing Y | 3/3 | none |
| S05 file upload | Tracker | `01a14ad6-7a63-764e-a08b-46e069f60de2` | upload-storage Y; limits Y; processing Y | 3/3 | none |

#### Extract and review notes

- **S01:** Baseline chose Next.js/TypeScript/SQLite+Prisma and surfaced storage and app type, but not authentication. Tracker recorded A-001 (CLI vs web and local JSON storage; medium), then the operator corrected it to PostgreSQL for multiple teachers. The decision note appeared before the next answer, which used PostgreSQL. One correction; uptake 1/1; 0/1 false positives.
- **S02 primary matched-cap pair:** Baseline chose React 19/TypeScript/Vite and localStorage. Tracker chose React/TypeScript/Tailwind and localStorage but made no `record_assumption` calls. Both first replies were truncated after the relevant choices; the visible choices were scored. No review or correction; tracker false positives 0/0.
- **S03:** Baseline described email/password fields, bcrypt, and an HttpOnly-cookie JWT session. Tracker recorded four candidates (React/Vite, Tailwind, cookie sessions vs JWT in localStorage, and React Hook Form/Zod). A-003 was corrected to server-side sessions with an opaque ID in a Secure/HttpOnly/SameSite=Strict cookie; the injected decision appeared before the follow-up, which adopted the server-side store and did not use JWT. One correction; uptake 1/1; 0/4 false positives. Under the stated criterion the tracker still missed auth method and password storage.
- **S04:** Baseline proposed Node's native HTTP module or Express and in-memory persistence, but did not mention authentication. Tracker recorded TypeScript/Express/SQLite, no authentication, and SQLite file persistence. A-001 was corrected to JavaScript/Fastify and leaving the database open. The first reply surfaced all three labels; 0/3 false positives. The prescribed follow-up was sent and the decision injection appeared, but OpenRouter returned `402 in_flight_budget_exhausted` before the reply, so uptake is unobserved, not scored as failure.
- **S05:** Baseline proposed S3-compatible object storage, JPEG/PNG/WebP and a 5–10 MB limit, plus resized images and thumbnails. Tracker recorded local filesystem storage and an existing users/auth table, and also specified a 5 MB/type validation and Sharp resizing/thumbnailing. A-001 was corrected to S3/R2 object storage with the object key in the database; the next reply acknowledged and followed it. One correction; uptake 1/1; 0/2 false positives. The privacy-first evaluator noted that avatar visibility/access remained undecided.

Across tracker sessions there were 10 reported candidates and no items judged false positives. S05's A-002 was treated as a genuine but unannotated assumption about existing authentication/users. There were four corrections total; uptake was visible in three successful follow-ups, while S04's follow-up was blocked by the provider error. No recording-caused blocking dialog was observed. The README run did show a non-blocking Pi project-trust warning.

This is **12/15 baseline and 11/15 tracker**, not a full-set result out of 36. Five of twelve scenarios are a formative sample; no estimate for the unrun seven scenarios is implied. S02's truncated responses and S04's provider failure further limit interpretation.

#### All attempts and exclusions
Every evaluation-window session found in the Pi session folders. Most are in `~/.pi/agent/sessions/`; S04 is in
`%TEMP%\pi-eval-s04-config\sessions\`. The list was audited from the session files on 2026-10-17.
Inclusion rule as applied: the first attempt per scenario × condition with Kimi K2.6, matched token caps, and a complete
(not error/`length`-truncated) **first** reply. Truncation of a later follow-up does not exclude a run (S02 tracker).

| Session | Scenario | Condition | Outcome | Used? | Reason |
|---|---|---|---|---|---|
| `01a14ac6-0042` | S02 | — | 402, no reply | no | provider error |
| `01a14ac6-180d` | S03 | — | 402, no reply | no | provider error |
| `01a14ac6-1954` | S01 | — | 402, no reply | no | provider error |
| `01a14ac6-4ae2` | S04 | — | 402, no reply | no | provider error |
| `01a14ac7-7618` | S02 | tracker | complete; recorded 3 (A-001 "No backend or auth needed", A-002, A-003); A-001 corrected | no (sensitivity only) | Token caps did not match the S02 baseline: it used the temporary 262,144/8,192 cap, while the matched S02 pair used 8,192/4,096 (confirmed by the evaluator). See rescore below. |
| `01a14ac7-a5ae` | S03 | baseline | complete | no | different model (`z-ai/glm-4.6`) |
| `01a14ac8-908a` | S03 | tracker | 402 after tool calls, no reply | no | provider error |
| `01a14ac8-cc10` | S02 | baseline | 402, no reply | no | provider error |
| `01a14ace-c5e9` | S03 | baseline | first reply truncated (`length`) | no | truncated |
| `01a14acf-aa16` | S03 | tracker | first reply truncated (`length`), 0 recorded | no | truncated |
| the 10 sessions in the table above | | | | yes | |

#### S02 unmatched-cap sensitivity rescore

`npm run extract -- 01a14ac7-7618 S02-todo` confirms this is a complete Kimi K2.6 tracker session with three recorded
items, one correction, and one decision injection. Its filled score is:

| Ambiguity | Impact | Surfaced? | Evidence |
|---|---|---|---|
| storage | medium | Y | A-001: “Todos will be stored in browser localStorage only”; first reply also says localStorage persists todos across browser sessions. |
| multi-user | medium | Y | A-001: “No backend or auth needed” and “no user accounts or cloud sync.” |
| platform | low | Y | First reply selects React 19 + TypeScript + Vite for a single-page app. |

Rescore: **3/3**, no missed medium/high items, and **0/3 false positives**. A-002 (no undo/bulk actions) and A-003 (no priority,
due dates or categories) are genuine low-impact product choices outside the annotated labels. The exact follow-up was sent;
the next reply adopted the correction to PostgreSQL, email/password accounts, and cross-device sync. Correction uptake: **1/1**.

This session started at 16:52:28Z, 30 seconds after the successful README session that used the temporary 262,144/8,192
cap, and before the matched-cap S02 pair at 16:56:38Z/16:57:47Z (8,192/4,096). The evaluator confirmed that its token caps
did not match the S02 baseline, which is why it is excluded from the primary matched-cap table. The session JSONL itself
records the model and response usage but not the requested caps, so the reason rests on the evaluator's record of the run
settings. As a sensitivity substitution for
the primary S02 tracker run, totals become **12/15 tracker recall**, **3 missed medium/high**, **0/13 false positives**, and **4/4
observable corrections taken up** (with the S04 correction still unobservable). Thus tracker recall ties baseline in
this five-scenario slice under this substitution; it does not establish a result for all 12 scenarios.

## Threats to validity
A single annotator (the author) wrote the annotations and judged the matches. The sample is small, and the same Kimi
model was used for all formal runs; outputs may vary on a rerun. The simulated personas are not independent human users.
Judging "surfaced" in the baseline is subjective. Plan-only prompts may change how often agents record assumptions
compared with real implementation work. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
