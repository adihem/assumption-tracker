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
