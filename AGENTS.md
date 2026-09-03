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
| Web UI (loopback only, tunnel from elsewhere) | `export LOCAL_API_KEY=vllm && cd ~/git/dsh_config && dsh web` — `ssh -L 3080:127.0.0.1:3080 mf` |
| Parse a session log | `uvx --from "$HOME/git/burnkit[forensics]" burn-dsh-log <session.jsonl.zstd> {types,calls,joined,assistant,user,search,raw}` |
| Session log path | `~/.dsh/sessions/<project-dir>/<id>/session.jsonl.zstd` — see linux_setup doc's "Session logs" section for the `<project-dir>`/`<id>` encoding rules |
| Reinstall dsh / bump version | `~/.local/bin/mise exec -- npm install -g @deepseek-ai/dsh && ~/.local/bin/mise reshim` |

See also this repo's `README.md` (plugin/profile/MCP wiring, `dsh-repl-runner` internals) and
`docs/agent-presets-shadow.md` (English agent-preset shadow copies).

## Context7

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

### Libraries

- deepseek-ai/deepseek-harness
- j178/prek
- mrlesk/backlog.md
- websites/taskfile_dev

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_backlog_instructions()` to load the tool-oriented overview. Use the `instruction` selector when you need `task-creation`, `task-execution`, or `task-finalization`.

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

