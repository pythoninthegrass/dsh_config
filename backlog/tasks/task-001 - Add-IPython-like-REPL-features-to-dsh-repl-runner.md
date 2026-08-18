---
id: TASK-001
title: Add IPython-like REPL features to dsh-repl-runner
status: In Progress
assignee:
  - '@pythoninthegrass'
created_date: '2026-08-18 16:32'
updated_date: '2026-08-18 16:43'
labels: []
dependencies: []
references:
  - 'https://ipython.readthedocs.io/en/stable/'
  - 'https://github.com/ipython/ipython'
priority: medium
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring dsh-repl-runner closer to a modern interactive shell UX, using IPython (https://ipython.readthedocs.io/en/stable/, https://github.com/ipython/ipython, v9.16.1) as the feature reference.

Currently dsh-repl-runner is a bare readline loop: one Agent/Session kept alive across turns, with the live streaming/quiet-MCP-logs fixes already in place. It has none of IPython's interactive-shell ergonomics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Persistent input history across sessions (up/down arrow recall), not just within one process lifetime
- [ ] #2 Extensible tab completion (at minimum: prior inputs / slash-commands; ideally file paths)
- [ ] #3 Multi-line editing with visible continuation (readline currently treats every Enter as a submit — no way to compose a multi-line prompt before sending)
- [ ] #4 Session logging to disk (transcript of prompts + responses), separate from dsh-session's own event log
- [ ] #5 A lightweight alias/magic-command system for REPL-only meta-commands (e.g. history, clear, save, reload) distinct from agent tool calls
- [ ] #6 Evaluate whether any of the above are already provided free by node's readline/repl modules before hand-rolling
- [ ] #7 "!"-prefixed shell command escape (run in user shell, output inline), with Esc cancelling a composed shell line before submit
- [ ] #8 "@"-prefixed relative file/directory completion, matches surfaced below the cursor like existing tab completion
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Switch plugins/dsh-repl-runner/index.js's core loop from readline.createInterface to node:repl's repl.start() with a custom eval(cmd, context, filename, callback). Confirmed via local probes against the installed Node 24.12.0 runtime (not just docs):
   - setupHistory({filePath, size, removeHistoryDuplicates}) persists r.history to disk and reloads it on next process start -> AC#1 free.
   - Throwing new repl.Recoverable(err) from eval when input looks incomplete (unterminated ``` fence, or trailing \) makes repl buffer lines and show a visible "|" continuation prompt -> AC#3 free.
   - defineCommand(name, {help, action}) gives free dot-commands (.exit/.help/.save/.load/.editor already built in) layered under our own "/"-prefixed magic commands -> contributes to AC#5.
   - completer option replaces the default JS completer entirely -> AC#2/#8, fully hand-rolled (repl's default completer is JS-global-aware, useless here). Multiple-match display "below the cursor" (AC#8) is native default readline/repl completion-list rendering, not custom UI.
   - Probed and confirmed REPLServer does NOT serialize eval() calls for burst/piped input (fires eval for line 2 before line 1's callback) -> the existing manual `queue = queue.then(...)` chaining must be KEPT, just moved inside eval(). Not free.
   - "!" shell-escape (AC#7) and Esc-to-cancel are entirely hand-rolled: no repl/readline primitive for either.
2. New pure/testable modules (mirroring the existing summarize-turn.js pattern, each with a colocated *.test.js, written test-first per repo TDD convention):
   - continuation.js: needsContinuation(cmd) - fence/backslash detection for AC#3.
   - magic-commands.js: parseMagicCommand(line) + canonical command list/help text for AC#5 (/help, /history [n], /clear, /save <path>, /reload, /exit, /quit).
   - shell-escape.js: isShellEscape(line), shellCommandBody(line) for AC#7's "!" prefix detection (spawning itself is I/O, stays in index.js).
   - completion.js: createCompleter({ magicCommands, historyRef, cwd }) for AC#2/#8: "/" slash-commands, "@" relative file/dir paths (cwd-relative, "@" stripped for the fs lookup and re-added on each candidate), plain "." / "~" / "/"-containing tokens, else prefix match against prior-input history.
   - paths.js: resolveDshHome() (process.env.DSH_HOME ?? ~/.dsh per README), historyFilePath(), transcriptFilePath(sessionId) for AC#1/AC#4 storage locations under <DSH_HOME>/repl-runner/.
3. index.js wires these together inside eval(): shell-escape check first ("!" never reaches the Agent or magic dispatch) -> magic-command check (handled entirely in-process) -> continuation check (Recoverable) -> else enqueue the existing agent.followup/whenIdle/sessions.flush/summarizeTurn turn logic (same queue pattern as today, now living inside eval's callback chain).
   - AC#7 execution: pause the interface, drop stdin out of raw mode, child_process.spawnSync(userShell, ["-c", body], {stdio:"inherit"}), restore raw mode, resume - matches the documented pattern for shelling out from a raw-mode readline/repl. Esc-to-cancel: a keypress listener (readline.emitKeypressEvents) active only while the composed line starts with "!"; on Escape, clear the line via the two documented default emacs-style bindings (rl.write(null,{ctrl:true,name:'e'}) then {ctrl:true,name:'u'}), no reliance on private readline internals.
   - AC#4 transcript (separate from dsh-session's own event log): plain-text timestamped "> "/"< " lines per turn appended to transcriptFilePath(sessionId); /save copies that file to a user-given path.
   - /reload discards the current Agent/Session and creates a fresh one via the same agents.create()/defaultModel.currentSelection() call already used at startup (also rotates to a fresh transcript file).
   - Existing streaming-chunk (session/event -> assistant/chunk) feedback hook is unchanged; its streamed/thinking reset just moves to the top of the real-turn branch in eval.
4. Minor polish (not a hard AC, low-risk): numbered "[n]> " prompt (increment per real turn) and a touch of ANSI color on the prompt, matching the "IPython feels more polished" note - skip full markdown syntax highlighting as out of scope/YAGNI.
5. Update README.md's dsh-repl-runner section and this task's AC#6 answer (documented inline as a short header comment in index.js: free vs. hand-rolled, matching the probe findings above).
6. Manual smoke test at a real TTY (raw-mode/keypress behavior can't be probed via non-tty PassThrough streams): multi-line fence continuation, history recall across two separate process invocations, /help, /history, /save, /reload, tab completion for "/", "@", and history, "!ls"-style shell escape plus Esc-cancel mid-line.
<!-- SECTION:PLAN:END -->
