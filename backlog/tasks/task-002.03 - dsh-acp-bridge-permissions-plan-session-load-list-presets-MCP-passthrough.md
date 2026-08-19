---
id: TASK-002.03
title: 'dsh-acp-bridge: permissions, plan, session load/list, presets, MCP passthrough'
status: To Do
assignee: []
created_date: '2026-08-19 17:05'
updated_date: '2026-08-19 17:06'
labels: []
dependencies:
  - TASK-002.02
parent_task_id: TASK-002
type: task
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on the bridge's core session/prompt/update streaming subtask being in place.

Round out the bridge's ACP surface so the dish TUI can implement all v1 must-haves:

- **Permissions**: map dsh's tool-approval flow to ACP `session/request_permission` so the bridge asks the client (dish) before risky tool calls execute.
- **Plan**: map dsh's `todo_write` snapshots to ACP plan updates in the `session/update` stream.
- **Session compat**: implement `session/load` and `session/list` reading the shared `$DSH_HOME` jsonl session store (`~/.dsh/sessions/<project-dir>/<id>/session.jsonl.zstd`), so a session created in `dsh web` or any other dsh front-end is listable and resumable from the bridge.
- **Presets**: expose the harness's agent presets (standard/minimal/code/cordis, including this repo's English-shadowed standard/minimal — see `docs/agent-presets-shadow.md`) as ACP session modes, switchable via `session/set_mode`.
- **Slash commands**: expose the harness's slash-command registry via ACP's available-commands mechanism.
- **MCP passthrough**: ensure the four MCP servers mounted in `profiles/tui/cordis.patch.yml` (backlog, context7, serena, tinyfish) are usable by an agent driven through the bridge — confirm whether MCP tool registration is automatic via the profile mount or needs to be passed through `session/new`'s mcpServers field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pending tool call that requires approval triggers session/request_permission and blocks until the client responds
- [ ] #2 Plan/todo updates from the agent surface as ACP plan entries in session/update
- [ ] #3 session/list returns sessions previously created by other dsh front-ends (e.g. dsh web) for the current project
- [ ] #4 session/load resumes one of those sessions and subsequent session/prompt calls continue the same conversation
- [ ] #5 The standard and minimal presets (English-named) are selectable via session/set_mode and change the active tool/persona set
- [ ] #6 At least one slash command from the harness registry is invocable through the bridge
- [ ] #7 A tool call that uses an MCP-provided tool (e.g. mcp__backlog__* or mcp__context7__*) succeeds when driven through the bridge
<!-- AC:END -->
