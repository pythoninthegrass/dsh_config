---
id: TASK-002.02
title: 'dsh-acp-bridge: session/new, session/prompt, session/update streaming'
status: To Do
assignee: []
created_date: '2026-08-19 17:05'
updated_date: '2026-08-19 17:06'
labels: []
dependencies:
  - TASK-002.01
parent_task_id: TASK-002
type: task
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on task-002.01 (bridge skeleton + profiles/tui) existing and responding to `initialize`.

Implement the core ACP agent methods in `plugins/dsh-acp-bridge/`:

- `session/new`: create a dsh Agent+Session with `meta.cwd` from the request, mirroring `createAgent()` in `plugins/dsh-repl-runner/index.js:45-59` (reads `agentDefaultModel.currentSelection()`, calls `agents.create()` with a fresh `SessionId`, waits `whenIdle()`).
- `session/prompt`: send the prompt via `agent.followup(createUserMessage(...))` and await `agent.whenIdle()`, mirroring `runTurn` in `plugins/dsh-repl-runner/index.js:170-188`.
- Streaming: subscribe to dsh's `ctx.on("session/event", ...)` (as `plugins/dsh-repl-runner/index.js:80-97` does) and translate each event into an ACP `session/update` notification: assistant text-delta chunks → `agent_message_chunk`, reasoning-delta → `agent_thought_chunk`, tool-call events → `tool_call`/`tool_call_update`.

This is the minimum slice needed for the dish TUI's wire spike to prove a real round trip: a prompt in, streamed assistant text and at least one tool call out.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 session/new creates a real dsh Agent+Session using the harness's own agent-creation path (agentDefaultModel + agents.create()), not a stub
- [ ] #2 session/prompt drives a real turn through agent.followup()+whenIdle() and returns/streams the actual model output
- [ ] #3 Assistant text streams as ACP agent_message_chunk session/update notifications in real time (not buffered until turn end)
- [ ] #4 Reasoning/thinking content streams as agent_thought_chunk when present
- [ ] #5 At least one tool call executed by the agent during a turn is surfaced as tool_call/tool_call_update session/update notifications
- [ ] #6 A manual test using a minimal ACP client (or the official SDK's client harness) against `dsh --profile tui` shows a full initialize -> session/new -> session/prompt -> streamed session/update round trip with real dsh output
<!-- AC:END -->
