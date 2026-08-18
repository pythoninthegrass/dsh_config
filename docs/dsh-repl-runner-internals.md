# dsh-repl-runner implementation notes

Rationale for the non-obvious parts of `plugins/dsh-repl-runner/index.js`.

## Built on `node:repl`, not hand-rolled readline

Most interactive-shell ergonomics come free from `node:repl`, verified against
this project's own Node runtime rather than assumed from docs: persistent
cross-process history (`repl.setupHistory()`), visible multi-line
continuation (throwing `repl.Recoverable` from `eval()`), and dot-commands
(`.exit`/`.help`/`.save`/`.load`/`.editor`, built into `REPLServer`). What
isn't free, and stays hand-rolled: tab completion (repl's default completer is
JS-global-aware, useless for chat text), the `/` magic-command system, `!`
shell-escape + Esc-to-cancel, and turn serialization.

## Turn serialization (`enqueue`/`queue`)

`REPLServer` does not wait for one `eval()` call to finish before starting the
next on burst/piped input, confirmed by probing it directly — `eval()` itself
can't be trusted to serialize turns, so every real unit of work (agent turns,
magic commands, shell escapes) funnels through a chained promise instead.

## Live turn feedback

`whenIdle()` gives no signal until the whole turn (all steps, all tool calls)
settles, which reads as a hang on anything slower than a trivial reply. Text
is streamed as `text-delta` chunks arrive instead of waiting for the final
assistant message, with a one-line `(thinking...)` marker on the first
reasoning-delta so a thinking-heavy turn isn't silent either.

## Fuchsia truecolor for the shell-escape prompt

The `!`-prefixed prompt is colored with a 24-bit truecolor SGR code
(`38;2;255;0;255`), not an indexed one — indexed codes 30-37/90-97 are exactly
what a terminal color theme (e.g. Adventure Time) remaps, so no indexed
"brighter magenta" can guarantee fuchsia; truecolor bypasses the theme's
palette entirely.

## Repainting the prompt on every keystroke

`repaintPrompt()` redraws the `[n]>` bracket (and, in shell mode, the leading
`!`) to always be the same visible width before and after, so the terminal's
and readline's own cursor-column bookkeeping (arrow keys, backspace,
wrapped-line redraws) never desyncs. It has to run on *every* keystroke, not
just on the mode transition: readline's own line editing (backspace,
Ctrl-U/E, wrapped-line reflow, `clearLine()`) does a full internal
`_refreshLine()` that redraws the prompt from its stored (always cyan)
template, silently wiping the fuchsia overlay — re-asserting it every time is
the only way it survives edits within the line. Cursor save/restore
(`\x1b[s`/`\x1b[u`) makes this safe to call mid-line.

`shellPromptActive` tracks whether the bracket is currently drawn fuchsia so a
fresh prompt after a turn always starts back at the normal cyan state
regardless of the previous line.

## The `! ` prefix is protected as one unit

Once a line starts with `! ` (bang + separating space), every edit except Esc
that would strip either character (backspace, Ctrl-U, Ctrl-W landing right
after the space, Ctrl-D at column 0) puts the line back exactly as it was —
`previousLine` snapshots `r.line` from just before the current keystroke was
applied, so a keystroke that strips the leading `!` can be told apart from
Enter clearing the line to submit it. Typing the leading `!` alone
auto-inserts the separating space, so the shell command body always starts
clear of the bang.
