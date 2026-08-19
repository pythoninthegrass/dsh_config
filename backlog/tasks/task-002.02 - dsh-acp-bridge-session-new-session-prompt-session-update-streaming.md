---
id: TASK-002.02
title: 'dsh-acp-bridge: session/new, session/prompt, session/update streaming'
status: Done
assignee: []
created_date: '2026-08-19 17:05'
updated_date: '2026-08-19 18:22'
labels: []
dependencies:
  - TASK-002.01
modified_files:
  - plugins/dsh-acp-bridge/index.js
  - plugins/dsh-acp-bridge/prompt-text.js
  - plugins/dsh-acp-bridge/prompt-text.test.js
  - plugins/dsh-acp-bridge/session-updates.js
  - plugins/dsh-acp-bridge/session-updates.test.js
  - plugins/dsh-acp-bridge/stop-reason.js
  - plugins/dsh-acp-bridge/stop-reason.test.js
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
- [x] #1 session/new creates a real dsh Agent+Session using the harness's own agent-creation path (agentDefaultModel + agents.create()), not a stub
- [x] #2 session/prompt drives a real turn through agent.followup()+whenIdle() and returns/streams the actual model output
- [x] #3 Assistant text streams as ACP agent_message_chunk session/update notifications in real time (not buffered until turn end)
- [x] #4 Reasoning/thinking content streams as agent_thought_chunk when present
- [x] #5 At least one tool call executed by the agent during a turn is surfaced as tool_call/tool_call_update session/update notifications
- [x] #6 A manual test using a minimal ACP client (or the official SDK's client harness) against `dsh --profile tui` shows a full initialize -> session/new -> session/prompt -> streamed session/update round trip with real dsh output
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
session/new creates a real dsh Agent+Session (agentDefaultModel.currentSelection() + agents.create(), mirroring dsh-repl-runner's createAgent()), reusing the dsh Session id directly as the ACP sessionId — one id space, no separate map to keep in sync. session/prompt drives agent.followup()+whenIdle(), then scans agent.session.events from firstSeq for the turn/end reason to compute PromptResponse.stopReason.

Streaming is one global ctx.on("session/event", ...) listener (not per-request) that filters by session.id membership in the bridgeSessions map, translates each event via the new pure session-updates.js (assistant/chunk text-delta -> agent_message_chunk, reasoning-delta -> agent_thought_chunk, tool/call -> tool_call, tool/result -> tool_call_update), and pushes via connection.client.notify("session/update", ...) using AgentConnection.client (an AgentContext live for the connection's lifetime, not the per-request context.client) so it works outside any single request handler.

Extracted three pure, unit-tested modules (prompt-text.js, session-updates.js, stop-reason.js) following the initialize.js precedent.

Verified live end-to-end via dish's Go wire spike (~/git/dish, task-001.01) against `dsh --profile tui`: initialize -> session/new -> session/prompt round-trips with real streamed agent_message_chunk/agent_thought_chunk text and a real tool_call/tool_call_update pair from an actual `bash pwd` execution.

Found and fixed a latent bug in dish's Go ACP type generator while verifying: SessionUpdate's merged struct picked the first-seen type for fields shared by incompatible variants (ContentChunk's "content": ContentBlock vs ToolCall's "content": []ToolCallContent), silently mis-typing tool_call_update. Not a bridge defect — the bridge's JSON was always correct; fixed in dish's internal/acp/gen_types.py (RAW_CONFLICT sentinel falls back to json.RawMessage on type collision).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented session/new, session/prompt, and real-time session/update streaming in dsh-acp-bridge, mirroring dsh-repl-runner's in-process Agent-driving pattern. Assistant text, reasoning, and tool calls now stream live during a prompt turn instead of being buffered until turn end. Verified against a real dsh subprocess via dish's Go wire spike (task-001.01), which also surfaced and let us fix a type-collision bug in dish's independent Go codegen.
<!-- SECTION:FINAL_SUMMARY:END -->
