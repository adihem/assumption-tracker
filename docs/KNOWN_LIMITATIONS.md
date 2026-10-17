# Known limitations

1. **Candidates, not facts.** The agent decides what to record. Models miss assumptions; in pilot P1 a free model
   recorded none. They may also record non-assumptions. `/add-assumption` is the fallback, and recall must be measured.
2. **Tracking is not enforcement.** A rejected or corrected item does not block Pi's edit or shell tools, and nothing
   undoes code already written. The decision summary informs the agent, and the agent may still ignore it.
3. **Non-blocking means late.** An assumption may be recorded after work based on it has started.
4. **Ambiguous follow-ups.** In the Phase 5 check, a plain "ok" was read as permission to start implementing. The tracker
   does not change how the agent interprets user messages.
5. **Not saved before the first message.** Pi writes a new session file only after its first user/assistant message.
   Items added before that are lost on exit, and the commands warn about this.
6. **Final decisions are final (v1).** Accepted, corrected and rejected items cannot be re-reviewed. Branch with `/tree` to try
   another decision.
7. **Simple duplicate detection.** Only exact normalized title or description matches count. A repeat of a *rejected* item
   becomes a new pending item flagged "possibly related to rejected A-…" rather than being merged. Reworded repeats create
   new items.
8. **Proposed impact is unverified.** `impact` is the agent's guess, not a measured severity.
9. **Summary size cap.** At most ~1,500 characters reach the agent. Older decisions beyond that are listed only as a count.
10. **Session history, not secrets storage.** Items live in Pi session files under `~/.pi/agent/sessions/`. Don't type
    secrets into them. To remove a test session, delete its `.jsonl` file there.
11. **Prompt injection.** Stored text is quoted and labelled as data in the agent summary. That reduces, but cannot
    eliminate, the chance a crafted title steers the model.
12. **Evaluation scope.** A single annotator, a small sample, free models with frequent `402` errors, and plan-only
    prompts. See [EVALUATION.md](EVALUATION.md).
