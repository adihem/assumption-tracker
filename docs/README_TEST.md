# README first-run check

Checked on 2026-10-17 by running the documented commands and Walkthrough in Pi 1.3.0 with `openrouter/moonshotai/kimi-k2.6` at medium thinking. This was an agent-run check, not a classmate test. `npm install --ignore-scripts` completed successfully (159 packages audited, 0 vulnerabilities); tests and smoke were rerun afterward.

The Quick start clone line uses the placeholder `git clone <this repo>`; a student needs the repository URL from whoever shared the project.

## Outcome

- `npm test`: passed, 70 tests.
- `npm run smoke`: passed (`SMOKE OK`).
- `npm install --ignore-scripts`: completed; dependencies were up to date, 159 packages audited, 0 vulnerabilities.
- Walkthrough: passed after the model request limit was adjusted. The prompt produced `Recorded A-001 (pending user review)` and the footer showed `Assumptions: 1 pending`. `/review-assumption A-001` → Correct accepted `Use PostgreSQL, because multiple teachers use it at once`. The next-turn `[assumption-tracker-decisions]` note appeared before the reply, and the reply used PostgreSQL.

## Where the run got stuck

- The first model call failed with OpenRouter 402 because Pi requested up to 233,565 output tokens while the key could afford about 11,000. A temporary user-level Pi model override capped the model output at 8,192 tokens; the successful README run used that cap. A new user with the same model/key may hit this before reaching the Walkthrough result.
- Pi printed a project trust warning (`-na` ignores project resources) even though `assumption-tracker.ts` was listed as loaded. The README does not explain whether the user needs to act on that warning.
- Following `/login` → API key → OpenRouter (already marked stored) opened an API-key entry prompt. Canceling it displayed an aborted-save error; `/model` still showed the configured Kimi model and the run worked. This flow was confusing but did not block the run.

No question to the evaluator was needed after those workarounds. The model limit workaround is a real setup dependency that should be considered when interpreting the “another student can install, run, and understand” gate.

## Follow-up
README updated after this check: the placeholder clone line was replaced, and a "Model setup and troubleshooting" section
now covers `/login`, the project-trust warning, the OpenRouter 402 `maxTokens` override (`modelOverrides` in
`~/.pi/agent/models.json`) and expired keys. A real classmate test is still outstanding.

## Classmate test (to be done by a real person)
Full step-by-step instructions for the organizer and the tester, including a results form: [CLASSMATE_GUIDE.md](CLASSMATE_GUIDE.md).
The summary below is kept for reference.
Give the tester only the project folder and README.md. Don't help unless they're completely stuck, and write down every
time they ask something.

**Setup by you, beforehand:** a provider key with credits, or the `maxTokens` override from the README. Also a fresh terminal
in the project folder.

**Tasks for the tester:**
1. Install, run the tests and run the smoke check, following Quick start.
2. Do the Walkthrough steps 1–4.
3. Without help, answer: *What does "deferred" mean? Does rejecting an assumption undo code?*

**Record:**
| Item | Result |
|---|---|
| Tester (initials, programme/year) | |
| Date, OS, Node version | |
| Tests green / smoke OK | yes / no |
| Saw `Recorded A-…` and footer count | yes / no |
| Corrected an item; saw the `[assumption-tracker-decisions]` note | yes / no |
| Agent's next reply followed the correction | yes / no |
| Answers to task 3 correct | yes / no |
| Time to finish (min) | |
| Questions asked / places stuck | |
| Suggested README changes | |

The gate passes when the tester finishes tasks 1–3 without help.

## Screen recording checklist (≈3 min)
1. `npm test` and `npm run smoke`: show the green output.
2. `npm run pi`, then send the walkthrough prompt. Show the `record_assumption` call and the footer count.
3. `/assumptions`, then `/review-assumption A-001` → Correct → `Use PostgreSQL…`.
4. Send the follow-up prompt. Pause on the `[assumption-tracker-decisions]` note and the PostgreSQL reply.
5. Exit, `npm run pi -- -c`, `/assumptions all`: the same state.
6. (Optional) `/tree` to before the review: the footer shows pending again.

Before recording, hide API keys, OpenRouter key URLs from error messages, and personal paths if you want.

## Classmate test 1 — results (2026-10-17)
Run by a student following [CLASSMATE_GUIDE.md](CLASSMATE_GUIDE.md). Pi session `01a14b10-357c-7471-b8b2-7f732cb3fa73`,
Windows (build 10.0.26200), Command Prompt, model `thinkingmachines/inkling:free` (the first model attempt failed with a 402).
The form's tester, time and "organizer helped" fields were left blank; fill them in if known.

**Caveat:** the run used the developer's machine and project folder (npm said `up to date`), not a freshly unzipped copy,
so Parts B–C were less of a fresh-install test than intended.

| Item | Form | Checked against the session file |
|---|---|---|
| B: tools installed | yes | — |
| C: 71 tests / `SMOKE OK` / `E2E OK` | yes | ✅ the transcript shows all three |
| D1: logged in, `/tracker-hello` active | yes | — (model changes logged) |
| D2: recorded | recorded | ✅ A-001 "Web-based React/TypeScript attendance tracker" (agent, low). The tester also added A-002 "Use SQLite database" |
| D3: corrected | yes | ✅ A-001 corrected → "Use PostgreSQL, because multiple teachers use it at once" |
| D4: decisions block shown | yes | ✅ one `assumption-tracker-decisions` entry before the follow-up |
| D4: reply followed correction | yes | ✅ the reply gave a PostgreSQL schema. But see finding 2 |
| D5: survives restart | yes | ✅ replaying the file at its latest entry gives A-001 corrected, A-002 pending |
| D6: earlier branch pending | **no** | Guide ambiguity, not a bug. See finding 3 |
| D7: questions | yes / yes | — |

**Result: the gate is met.** B–D5 and D7 were completed, and correct behaviour was confirmed from the session file. This
assumes the organizer did not help; that field is blank.

**Findings (all fixed in the guide/README):**
1. **Getting into the folder was hard:** about 10 `cd` attempts. Command Prompt does not understand `~`, and the path has
   spaces. → The guide now opens a terminal from the Explorer address bar (`cmd`), with quoted per-shell `cd` examples and the
   drag-and-drop tip.
2. **The correction did not match the assumption's topic.** The guide said to correct A-001 to PostgreSQL whatever A-001 was.
   Here A-001 was the *app stack*, so the agent's reasoning read the correction as "PostgreSQL instead of React". The final
   answer still described a PostgreSQL data layer. → The guide and README now say to pick the *storage* assumption and keep
   corrections on the same topic.
3. **D6 "no" was caused by a retried prompt.** The first attendance message failed with a 402 and was sent again. "Select your
   **first** message" pointed at the failed attempt, which comes before A-001 existed, so `No assumptions recorded` was the
   correct output. Replaying the file with Pi's `SessionManager` at the plan reply gives A-001 **pending**, as intended.
   → The guide now says to select the agent's plan reply right after the `Recorded A-…` line.
4. The 402 error appeared again with the first model. The tester switched to a free model and continued without the
   `maxTokens` fix.
