---
id: TASK-002.05
title: >-
  dsh-acp-bridge: session/load replay gaps (no user-turn replay, no turn
  boundaries, no true rollback)
status: Done
assignee: []
created_date: '2026-08-19 23:32'
updated_date: '2026-08-20 04:27'
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
Moved to ~/git/dish as TASK-004 when dsh-acp-bridge relocated there for colocation with its ACP client counterpart (2026-08-20). Closing here to avoid duplicate tracking; see dish's backlog for the live version of this work.
<!-- SECTION:NOTES:END -->
