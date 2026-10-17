# Classmate test: step-by-step guide

This guide takes a new user from an empty computer to a working demo of the Assumption Tracker. It takes about
**30–45 minutes**. Part A is for the person running the test (the organizer). Parts B–F are for the tester.

---

## Part A — Organizer: before the session (10 min)

1. **Make the project zip** from the tagged release. Run this inside the `assumption-tracker` folder:
   ```bash
   git archive --format=zip -o ../assumption-tracker-v1.0.0.zip v1.0.0
   ```
   This gives you a clean copy with no `node_modules` and no Git history. Give the tester the zip and this guide.
2. **Sort out a model key.** The tester needs an OpenRouter API key that has some credit, either their own or a throwaway key
   you create for the session with a small spending limit. Free-tier keys often fail with `402` errors (see Part F).
   Never paste your main key into someone else's computer.
3. **Print or open the results form** at the end of this guide (Part E).
4. **During the test:** sit back and only take notes. Help only if they're completely stuck, and write down each time you
   help and why.

---

## Part B — Tester: install the tools (5–10 min)

You need **Node.js 22.19 or newer**. Git is not needed.

1. Open a terminal:
   - **Windows:** press Start, type `PowerShell`, and open **Windows PowerShell**.
   - **macOS:** open **Terminal**. **Linux:** open your terminal app.
2. Check whether Node.js is already installed:
   ```bash
   node --version
   ```
   - If it prints `v22.19.0` or higher (for example `v24.x` or `v26.x`), go to Part C.
   - If it says *not recognized* / *command not found*, or shows a lower version, install the **LTS** version from
     <https://nodejs.org>, accepting the defaults. Then **close and reopen** the terminal and run `node --version` again.
3. Check that npm works:
   ```bash
   npm --version
   ```
   It should print a version number such as `11.x`.
   **Windows:** if you see *"running scripts is disabled on this system"*, use `npm.cmd` instead of `npm` in every command
   below (for example `npm.cmd install --ignore-scripts`), or use **Command Prompt** instead of PowerShell.

---

## Part C — Tester: get the project and check it works (5 min)

1. **Unzip** `assumption-tracker-v1.0.0.zip` into a short path, for example `C:\Users\<you>\Documents\assumption-tracker`
   or `~/assumption-tracker`. Very long folder paths can cause problems on Windows.
2. **Go into the folder** in your terminal. Change the path to wherever you unzipped it:
   ```bash
   cd ~/Documents/assumption-tracker
   ```
   Run `dir` (Windows) or `ls` (macOS/Linux). You should see `README.md`, `package.json`, `src`, `tests` and `docs`.
3. **Install the dependencies.** This includes the Pi coding agent itself, so it takes 1–2 minutes:
   ```bash
   npm install --ignore-scripts
   ```
   ✅ It should end with something like `added … packages` and `found 0 vulnerabilities`. Warnings are fine; an `ERR!` is not.
4. **Run the automated tests.** These need no account and no internet:
   ```bash
   npm test
   ```
   ✅ Expect `Test Files  5 passed (5)` and `Tests  71 passed (71)`. A few `stderr |` lines in the middle are expected.
5. **Check that the extension loads in Pi:**
   ```bash
   npm run smoke
   ```
   ✅ Expect `SMOKE OK`.
6. **Check the review commands end to end:**
   ```bash
   npm run e2e
   ```
   ✅ Expect 12 lines starting with `ok`, then `E2E OK`, then a short list of three assumptions.

If any step shows `FAIL` or an error, stop and write down the exact message in the form.

---

## Part D — Tester: use it with the AI agent (15–20 min)

### D1. Start Pi and log in
1. Start Pi with the extension:
   ```bash
   npm run pi
   ```
   A full-screen text interface opens. Near the top you should see:
   - `[Extensions]` with **`assumption-tracker.ts`** under it
   - *"This project is not trusted…"*. This is **expected**, so ignore it and do **not** run `/trust`.
   - possibly *"No models available"*, which goes away after logging in.
2. Log in to OpenRouter. Type this and press Enter:
   ```text
   /login openrouter
   ```
   Paste the API key you were given and press Enter.
3. Choose the model. Type this and press Enter (if the organizer named a different model, use that ID instead):
   ```text
   /model openrouter/moonshotai/kimi-k2.6
   ```
   The model name appears at the bottom right. Alternatively, type `/model` on its own and pick from the list with the arrow keys.
4. Check that the extension is ready:
   ```text
   /tracker-hello
   ```
   ✅ Expect: `Assumption Tracker loaded. record_assumption tool: active.`

**How to use Pi:** type at the bottom and press Enter. Lines starting with `/` are commands that the extension runs itself.
Everything else is a chat message sent to the AI. In menus, use the ↑/↓ arrow keys and Enter; **Esc** cancels.

### D2. Ask the agent for a plan
Copy and send this message exactly:
```text
Create a simple attendance tracker. Students can be added and marked present. For now, only describe your plan and technology choices; do not create any files.
```
Wait for the reply. It can take up to a minute.

✅ Look for one or more lines like **`Recorded A-001 (pending user review)`**. These are choices the agent made that you
never asked for, for example how data is stored. At the very bottom, the footer should show **`Assumptions: 1 pending`**
(or a higher number).

If nothing was recorded, add one yourself:
1. Type `/add-assumption`.
2. Title: `Use SQLite database`. Description: `Store attendance records in a local SQLite file.` Press Enter to skip the
   reason, then pick `medium`.

### D3. Look at and correct an assumption
1. List them:
   ```text
   /assumptions
   ```
   You should see lines like `A-001 | <title> | medium | pending`.
2. Review the first one:
   ```text
   /review-assumption A-001
   ```
   Read the details, choose **Correct**, type the text below and press Enter. Then press Enter again to skip the note.
   ```text
   Use PostgreSQL, because multiple teachers use it at once
   ```
   ✅ Expect `A-001 marked corrected. The agent sees this on your next message.` Notice that the agent did **not** start
   working by itself.

### D4. Check that the agent follows your decision
Send this message exactly:
```text
Continue: describe the data layer in more detail, following the reviewed decisions. Do not create files. Stop after this answer.
```
✅ Just before the agent's reply, a block labelled **`[assumption-tracker-decisions]`** appears, containing
`A-001 CORRECTED: … do "Use PostgreSQL, because multiple teachers use it at once"`. The reply should now use **PostgreSQL**.
Write down whether it did.

> Tip: don't send a bare "ok" to the agent; it may take that as permission to start writing files. If it ever starts
> creating files you didn't ask for, press **Esc** to stop it.

### D5. Check that it survives a restart
1. Exit Pi: press **Ctrl+D** on an empty prompt, or **Ctrl+C** twice.
2. Start it again and continue the same session:
   ```bash
   npm run pi -- -c
   ```
3. Type `/assumptions all`.
   ✅ A-001 is still shown as **corrected**, with `Corrected to: Use PostgreSQL…`.

### D6. (Optional) Go back in time
1. Type `/tree`, select your **first** message (the attendance-tracker request), and press Enter.
2. Type `/assumptions all`. ✅ On this earlier branch, A-001 is **pending** again, because the correction happened later.
3. Exit Pi (Ctrl+D).

### D7. Answer two questions
Answer without asking anyone. You may use `/assumptions-help` or the README.
1. What does the status **"deferred"** mean?
2. If you **reject** an assumption, does the extension undo code the agent already wrote?

---

## Part E — Results form (fill in during the test)

| Item | Result |
|---|---|
| Tester (initials, programme/year) | |
| Date, operating system, `node --version` | |
| Part B: tools installed without help | yes / no |
| Part C: `npm test` 71 passed / `SMOKE OK` / `E2E OK` | yes / no / no |
| D1: logged in, `/tracker-hello` says active | yes / no |
| D2: saw `Recorded A-…` and the footer count (or added one manually) | recorded / manual |
| D3: corrected A-001 | yes / no |
| D4: saw the `[assumption-tracker-decisions]` block | yes / no |
| D4: reply followed the correction (PostgreSQL) | yes / no |
| D5: correction still there after restart | yes / no |
| D6 (optional): earlier branch showed pending | yes / no / skipped |
| D7 answers correct* | 1: yes / no — 2: yes / no |
| Total time (minutes) | |
| Times the organizer helped, and why | |
| Where the tester got stuck or confused | |
| Suggested changes to the README/guide | |
| Pi session ID (printed on exit: `pi --session <id>`) | |

*Answers: 1) postponed, so it still needs a decision later and is not approved. 2) No; it only records your decision and
tells the agent.

**The test passes** when Parts B–D5 and D7 are finished without the organizer's help. Add the completed form to
[README_TEST.md](README_TEST.md).

---

## Part F — If something goes wrong

| Problem | What to do |
|---|---|
| `node` or `npm` not recognized | Install Node.js LTS from nodejs.org, then close and reopen the terminal |
| PowerShell: "running scripts is disabled" | Use `npm.cmd` instead of `npm`, or use Command Prompt |
| `npm install` fails with network errors | Check internet/proxy, then run it again |
| `402 … requires more credits, or fewer max_tokens` | Add credit to the key, **or** cap the output (below), then reopen `/model` |
| `401 … API key expired / invalid` | Run `/login openrouter` again with a valid key |
| Agent records nothing | That's allowed, since models sometimes miss assumptions. Use `/add-assumption` (D2) and note it on the form |
| Typed a command without the leading `/` | It went to the AI as a chat message. Type it again starting with `/` |
| Pi seems stuck | Press **Esc** once to interrupt; Ctrl+D (empty prompt) exits |

**Capping output for the 402 error.** This creates `~/.pi/agent/models.json`. First check that the file doesn't already
exist; if it does, ask the organizer.
- Windows PowerShell:
  ```powershell
  New-Item -ItemType Directory -Force "$HOME\.pi\agent" | Out-Null
  Set-Content -Path "$HOME\.pi\agent\models.json" -Value '{ "providers": { "openrouter": { "modelOverrides": { "moonshotai/kimi-k2.6": { "maxTokens": 8192 } } } } }'
  ```
- macOS/Linux:
  ```bash
  mkdir -p ~/.pi/agent && echo '{ "providers": { "openrouter": { "modelOverrides": { "moonshotai/kimi-k2.6": { "maxTokens": 8192 } } } } }' > ~/.pi/agent/models.json
  ```

---

## Part G — Clean up afterwards
1. If you created `~/.pi/agent/models.json` for the 402 fix, delete it.
2. Remove the saved login: start Pi (`npm run pi`), run `/logout`, then exit. The organizer should revoke any throwaway
   key on openrouter.ai.
3. The test conversation is saved under `~/.pi/agent/sessions/`. Give the organizer the session ID first, then you may
   delete that folder's `.jsonl` file.
4. Delete the unzipped project folder if you don't need it any more.
