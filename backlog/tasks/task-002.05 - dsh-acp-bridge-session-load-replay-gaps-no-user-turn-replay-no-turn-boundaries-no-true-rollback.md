---
id: TASK-002.05
title: >-
  dsh-acp-bridge: session/load replay gaps (no user-turn replay, no turn
  boundaries, no true rollback)
status: To Do
assignee: []
created_date: '2026-08-19 23:32'
updated_date: '2026-08-19 23:32'
labels:
  - dsh-acp-bridge
  - session-replay
dependencies:
  - TASK-002.03
parent_task_id: TASK-002
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Live-testing dish's session/load feature (dish task-001.06: session picker, load, visual rollback) against the real dsh-acp-bridge surfaced three replay-fidelity gaps in this bridge's session/load path, plus one related error-message clarity issue. All are out of scope for dish itself — dish's task-001.06 documents them as known, accepted client-side limitations — but they should be fixed bridge-side so ACP clients get a faithful replay and a real rollback primitive instead of workarounds.

Cross-reference: dish repo (~/git/dish), task-001.06.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Loading a session whose history includes a user prompt replays that prompt's text in the session/update stream (not just the assistant's response) via a user-message mapping added to session-updates.js's event-to-session/update switch (e.g. a user_message_chunk update kind) covering the event currently unhandled there
- [ ] #2 Replayed history distinguishes consecutive turns from one another (e.g. via an explicit turn-start/turn-end marker or by using the new user-message update from AC #1 as the natural boundary) so a client rendering the replay does not merge multiple prior turns into one undifferentiated block
- [ ] #3 An ACP-level rollback primitive exists (e.g. a session/rollback extension method) with a bridge onRequest handler wired to dsh's SessionStore.fork(source, boundary) that actually rewinds the agent's own context server-side, not just the client's local view
- [ ] #4 Calling session/load for a session that is still live/mounted in the same dsh-acp-bridge process returns a clear, specific error (e.g. identifying that the session is already active) rather than an opaque rpc error -32603 Internal error; loading a genuinely separate/ended session is unaffected and continues to work
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reported from live dish testing on 2026-08-19. Item 4 (self-resume-of-live-session error clarity) is a secondary observation bundled with the same investigation, not a core replay gap — worth a quick look at agents.resume()'s conflict/lock path in dsh core to see whether the existing intentional guard (see task-002.03's implementation notes: 'cannot prepare session ... while it is live') can surface through the RPC layer as that clear message instead of a generic Internal error, even though rejecting the resume itself is correct behavior.
<!-- SECTION:NOTES:END -->
