---
id: TASK-002
title: 'dsh-acp-bridge: agent-side ACP implementation'
status: To Do
assignee: []
created_date: '2026-08-19 17:04'
updated_date: '2026-08-19 17:40'
labels: []
dependencies: []
references:
  - /home/lance/.claude/plans/how-feasible-would-using-greedy-perlis.md
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hand-rolled agent side of the official Agent Client Protocol (agentclientprotocol.com) for the DeepSeek harness — a Cordis plugin (`plugins/dsh-acp-bridge/`) on the first-party `@agentclientprotocol/sdk` and `@deepseek-ai/dsh-agent`/`-llm`/`-session` primitives, following the in-process pattern already proven by `plugins/dsh-repl-runner/`. Mounted via `profiles/tui/`. No dependency on openma's `@openma/deepseek-harness-acp` adapter — that stays reference-only and `profiles/acp/` remains untouched as a fallback.

This is the dsh_config half of a two-repo project. The other half — `dish`, a Go/Bubble Tea ACP *client* TUI — is a separate repo (`~/git/dish`) with its own Backlog.md project; see its `task-001` tree there for the TUI-side work (schema codegen, Bubble Tea UI, tool cards/approvals, presets/slash, stateful shell, session UI, alias repoint).

Full original design/rationale for both halves: `/home/lance/.claude/plans/how-feasible-would-using-greedy-perlis.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dsh --profile tui exposes the bridge as an ACP agent answering initialize over real stdio, with profiles/acp/ left byte-for-byte untouched as a fallback (task-002.01)
- [ ] #2 session/new, session/prompt, and streaming session/update (assistant/thought chunks, tool_call/tool_call_update) work end-to-end against a raw ACP client, verified independently of dish (task-002.02)
- [ ] #3 session/request_permission, plan updates, session/load + session/list, preset/mode switching, and MCP tool passthrough are implemented and verified the same way (task-002.03)
<!-- AC:END -->
