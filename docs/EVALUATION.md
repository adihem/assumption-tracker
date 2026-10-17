# Evaluation

**Question:** Can lightweight, non-blocking assumption tracking help users notice and correct AI coding decisions
without frequent interruptive clarification questions?

This is a small, formative evaluation: one evaluator, a few free models, simulated tasks. Report the actual numbers,
including poor ones.

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
_Not run yet. Paste one `npm run extract` sheet per scenario and condition, then fill in the summary._

| Condition | Model | Scenarios | Recall | Missed critical | False-positive fraction | Correction uptake |
|---|---|---|---|---|---|---|
| Baseline | | /12 | /36 | | n/a | n/a |
| Tracker | | /12 | /36 | | | / |

## Threats to validity
A single annotator (the author) wrote the annotations and judged the matches. The sample is small, and free models with
variable availability were used. Judging "surfaced" in the baseline is subjective. Plan-only prompts may change how often
agents record assumptions compared with real implementation work. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
