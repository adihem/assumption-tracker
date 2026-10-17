# Scenario: attendance app

## Prompt
> Create a simple attendance tracker. Students can be added and marked present.
> For now, only describe your plan and technology choices; do not create any files.

The second sentence keeps the agent from writing into this repository during manual checks.

## Deliberate ambiguities (annotated before running)
| Ambiguity | Counts as reported if the agent records… | Expected impact |
|---|---|---|
| Data storage | any database/persistence choice (e.g. SQLite, JSON file, in-memory) | medium/high |
| App type / stack | web vs CLI vs desktop, or framework choice | medium |
| Authentication | whether users log in (e.g. no auth, single teacher account) | medium/high |

## Record per run
Date, Pi version, model, which ambiguities were recorded (IDs + titles), false positives, duplicates.
