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
