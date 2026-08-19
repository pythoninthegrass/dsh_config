---
id: TASK-002.04
title: 'dsh-acp-bridge: emit ACP kind + diff content for edit tool calls'
status: Done
assignee: []
created_date: '2026-08-19 21:14'
updated_date: '2026-08-19 21:25'
labels: []
dependencies:
  - TASK-002.03
parent_task_id: TASK-002
type: task
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from dish's TASK-001.03 live verification: the bridge's session-updates.js hardcodes kind: "other" on every tool_call and only ever emits content-type text blocks on tool_call_update, so a file-edit tool call never reaches an ACP client as kind: "edit" with Diff-shaped content. dish's diff renderer (internal/tui/model.go) is spec-compliant and unit-tested but has never fired against a real bridge because of this gap.

Root cause is architectural, not a typo: the durable tool/call session event only carries {callId, name, arguments} (dsh-agent-loop/lib/index.js appendToolCall) — no card/kind. The presentation layer that DOES know a tool call is a diff lives in each tool's own presentCall/presentResult (ToolDefinition, see dsh-tools/README.md's "Tool-owned UI presentation"). dsh-host-apiproxy/lib/index.js's viewFor() is the reference implementation: it calls ctx.tools.get(name, scope)?.presentCall?.(JSON.parse(rawArgs)) for tool/call, and ?.presentResult?.(args, {content, isError}) for tool/result, and switches on the returned view.card ("diff" | "terminal" | "generic" | "search" | "read" | "web"). dsh-tool-str-replace-editor's presentCall already returns {card: "diff", diffs: [{path, oldText, newText}]} for create/str_replace — the data the bridge needs already exists, it is just never consulted.

Plugins/dsh-acp-bridge/session-updates.js's toSessionUpdate(event) is currently a pure function with no ctx access. It needs either a ctx/scope argument (mirroring viewFor's signature) or to be called from index.js with a precomputed view, so toolCallStartUpdate/toolCallContent can derive kind and content from the tool's own presentCall/presentResult instead of hardcoding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A tool_call resolves its presenter view via ctx.tools.get(name, scope)?.presentCall?.(JSON.parse(arguments)), mirroring dsh-host-apiproxy's viewFor
- [x] #2 A str_replace_editor create/str_replace call's tool_call carries kind: "edit" (not "other")
- [x] #3 That SAME tool_call carries content: [{type: "diff", path, oldText, newText}] built from the presenter's diffs — on the initial tool_call, not tool_call_update, since str_replace_editor's diff comes from presentCall (call-time proposed diff) and it defines no presentResult at all
- [x] #4 The toolCall embedded in session/request_permission (permission.js's toPermissionRequest) also carries this kind+content, resolved by backscanning the agent's session events for req.callId's tool/call event (arguments aren't on the approval/request event itself) — this is the path dish's permission modal actually reads before the edit executes
- [x] #5 A non-edit tool call (e.g. bash) is unaffected: kind stays whatever its own presenter implies (or "other" when presentCall returns undefined), no content added
- [x] #6 Presenter failures (JSON.parse throw, missing tool, missing presentCall) soft-fall to the current kind: "other" / no-content behavior, per viewFor's own try/catch contract, and do not crash the bridge
- [x] #7 Live-verified end-to-end: dish's permission modal (internal/tui/model.go renderPermissionModal/renderDiff) renders real +/- lines for a str_replace_editor edit driven through dsh --profile tui, closing the AC2 gap noted in dish TASK-001.03
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
TDD in plugins/dsh-acp-bridge/ (node --test). session-updates.js: toolCallStartUpdate(event, view) takes an optional presenter view and derives kind via a shared kindFromView(view) (diff->edit, terminal->execute, read->read, generic/search/web kind passthrough, default other) plus content: diffContent(view) when view.card === "diff". permission.js: toPermissionRequest(sessionId, req, view) takes the same optional view and attaches kind/content to the embedded toolCall. index.js: add "tools" to inject; in both the ctx.on("approval/request", ...) handler and the ctx.on("session/event", ...) tool/call branch, resolve the view via a small resolveCallView(agent, name, rawArgs) helper (tools.get(name, agents.get(agent.session.id))?.presentCall?.(JSON.parse(rawArgs)), try/catch -> undefined) — approval/request has no arguments field, so it must backscan agent.session.events for the tool/call event matching req.callId first (appendToolCall commits to the log before the approval gate runs, so it is always already present). Verify live via herdr against dsh --profile tui + real lemonade: drive a str_replace_editor edit on a scratch file and confirm the permission modal shows a real diff, then approve and confirm dish's tool card also shows it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented and live-verified. session-updates.js: toSessionUpdate(event, view) + exported kindFromView/diffContent, both pure and TDD'd (12 tests). permission.js: toPermissionRequest(sessionId, req, view) attaches the same kind/content to the embedded toolCall (8 tests). Both functions make view optional and are byte-identical to old behavior when omitted, so index.js's call sites kept working through the change. New plugins/dsh-acp-bridge/tool-view.js holds the two ctx-touching pieces as pure, independently-testable functions (10 tests): resolveCallView(tools, scope, name, rawArgs) mirrors dsh-host-apiproxy's viewFor (soft-falls to undefined on missing registry/tool/presentCall or a JSON.parse throw) and backscanToolCall(events, callId) finds a tool/call event by callId for the approval path, which carries no arguments of its own. index.js: added tools to inject/required-services; wired resolveCallView+backscanToolCall into the approval/request handler, the session/event tool/call branch, and session/load's history-replay loop (added for consistency so a resumed session's past edits also render as diff cards, not just live ones). Confirmed ctx.tools is a real cordis service via dsh-tools' ToolRuntime (super(ctx, "tools")), not a guess. All 49 tests across the plugin directory pass. Live-verified via herdr against a real dsh --profile tui + lemonade session: drove a str_replace_editor create on an out-of-workspace scratch file. The initial sandboxed attempt's tool card already showed kind: edit (not the old other) before it even reached approval, confirming the session/event wiring. The escalation retry produced a session/request_permission modal reading 'Tool call: write / /home/lance/dish-diff-test.txt / + hello from dish' — a real diff line via the backscanned presentCall view, not a raw JSON blob, closing dish TASK-001.03's AC2 caveat. Approved it; the post-execution tool card showed kind: edit again and the file was created with the exact content. No regressions: a plain bash tool call in the same session rendered unaffected. No commit made per standing instruction (commit only on explicit request).
<!-- SECTION:NOTES:END -->
