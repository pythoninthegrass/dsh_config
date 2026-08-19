# AGENTS.md

## dsh Quick Reference

Full setup, gotchas, and the session-log parsing script live in the sibling `linux_setup` repo:
[`../linux_setup/docs/deepseek-harness.md`](../linux_setup/docs/deepseek-harness.md). This section
is a terse in-repo pointer for agents working in `dsh_config` — keep both files in sync when either
changes.

| Task | Command |
|---|---|
| Interactive TUI (ACP, default `dsh` alias) | `dsh` |
| Lightweight multi-turn REPL | `dsh-repl` |
| Web UI (loopback only, tunnel from elsewhere) | `export LOCAL_API_KEY=lemonade && cd ~/git/dsh_config && dsh web` — `ssh -L 3080:127.0.0.1:3080 mf` |
| Parse a session log | `~/git/linux_setup/scripts/read_dsh_log.py <session.jsonl.zstd> {types,calls,joined,assistant,user,search,raw}` |
| Session log path | `~/.dsh/sessions/<project-dir>/<id>/session.jsonl.zstd` — see linux_setup doc's "Session logs" section for the `<project-dir>`/`<id>` encoding rules |
| Reinstall dsh / bump version | `~/.local/bin/mise exec -- npm install -g @deepseek-ai/dsh && ~/.local/bin/mise reshim` |

See also this repo's `README.md` (plugin/profile/MCP wiring, `dsh-repl-runner` internals) and
`docs/agent-presets-shadow.md` (English agent-preset shadow copies).

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
