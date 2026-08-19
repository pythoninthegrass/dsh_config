---
id: TASK-002.01
title: 'dsh-acp-bridge: plugin + profiles/tui skeleton'
status: Done
assignee:
  - claude
created_date: '2026-08-19 17:04'
updated_date: '2026-08-19 17:24'
labels: []
dependencies: []
modified_files:
  - README.md
  - plugins/dsh-acp-bridge/package.json
  - plugins/dsh-acp-bridge/index.js
  - plugins/dsh-acp-bridge/initialize.js
  - plugins/dsh-acp-bridge/initialize.test.js
  - profiles/tui/package.json
  - profiles/tui/cordis.yml
  - profiles/tui/cordis.patch.yml
  - profiles/tui/pnpm-workspace.yaml
parent_task_id: TASK-002
type: task
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scaffold the new Cordis plugin `plugins/dsh-acp-bridge/` (ESM, `node --test`, mirroring `plugins/dsh-repl-runner/` layout) that will implement the agent side of the official Agent Client Protocol using the official `@agentclientprotocol/sdk` npm package (confirmed to exist, current major v1.x). Wire it into a brand-new `profiles/tui/` profile (package.json bundles `@deepseek-ai/dsh-base` + the bridge, empty `cordis.yml`, `cordis.patch.yml` for config/inserts) mirroring `profiles/acp/`'s structure — including the agent-preset shadow insert and the four MCP server mounts (backlog, context7, serena, tinyfish) copied from `profiles/acp/cordis.patch.yml`. The existing `profiles/acp/` (openma-backed) must be left untouched as a fallback.

The plugin should declare `inject: ["agentDefaultModel", "agents", "sessions"]` like `plugins/dsh-repl-runner/index.js:22-24`, and expose the agent over stdio via the SDK's agent-side stdio connection bound to `process.stdin`/`process.stdout`. At this stage it only needs to respond to `initialize` — no session/agent logic yet (that's the next subtask).

The bridge's Cordis config in `profiles/tui/cordis.patch.yml` must pin its provider to `local` (copy the pattern from `profiles/acp/cordis.patch.yml`'s `acp-plugin` id/inject/config block), otherwise `session/new` will fall back to `deepseek-official` and hit `auth_required`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 plugins/dsh-acp-bridge/ exists with package.json (ESM, node --test, @agentclientprotocol/sdk dependency, peerDependencies on @deepseek-ai/dsh-agent/-llm/-session matching dsh-repl-runner's pattern)
- [x] #2 profiles/tui/ exists with package.json, cordis.yml, cordis.patch.yml, pnpm-workspace.yaml mirroring profiles/acp/'s structure, including the agent-preset shadow and all four MCP server mounts
- [x] #3 profiles/acp/ is unmodified
- [x] #4 `dsh --profile tui` starts without crashing and the plugin responds to an ACP `initialize` request over stdio
- [x] #5 The provider is pinned to `local` in profiles/tui/cordis.patch.yml
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verified the real official ACP TS SDK agent-side API before writing code: fetched `@agentclientprotocol/sdk`'s actual example source (agentclientprotocol/typescript-sdk, src/examples/agent.ts) rather than trusting inferred names. Confirmed the fluent `acp.agent({name}).onRequest(method, handler).connect(stream)` API (built from `acp.ndJsonStream(Writable.toWeb(stdout), Readable.toWeb(stdin))`) is current — the class-based `AgentSideConnection` is deprecated upstream.
2. Scaffolded `plugins/dsh-acp-bridge/` mirroring `dsh-repl-runner`'s plugin shape exactly (name/inject/Config/apply, `inject: ["agentDefaultModel","agents","sessions"]`, `ctx.get("appExit")` guard). TDD: wrote `initialize.test.js` first, then `initialize.js` (the one piece of real logic this phase needs), then wired it into `index.js`, which only handles `initialize` — session/new + prompt land in task-002.02.
3. Scaffolded `profiles/tui/` mirroring `profiles/acp/`'s file structure (package.json/cordis.yml/cordis.patch.yml/pnpm-workspace.yaml), inserting the bridge + the agent-preset shadow + all four MCP mounts (backlog/context7/serena/tinyfish, matching `.mcp.json`). Pinned `provider: local` directly on the bridge's own insert entry.
4. Renamed the plugin's Cordis id from the originally-planned `acp-bridge` to `dsh-acp-bridge` after discovering `acp-bridge` is already openma's internal stdio-transport sub-id inside `profiles/acp/` (README "Running a profile") — kept distinct to avoid confusing the two in docs/dump-config output.
5. Handled the `node_modules` resolution problem: this is the first plugin with a genuine third-party dependency (`@agentclientprotocol/sdk` + its `zod` peer), so `dsh-repl-runner`'s whole-directory symlink-to-shared-store convention doesn't work. Built a hybrid: real `pnpm install --config.auto-install-peers=false` for the SDK+zod, then replaced the pnpm-hoisted `@deepseek-ai` scope with a symlink into `$DSH_HOME/profiles/node_modules/@deepseek-ai` so `dsh-agent`/`dsh-llm`/`dsh-session`/`schemastery` resolve to the exact same instances dsh's core uses (not a second, possibly-divergent copy). Documented this in README's "node_modules symlink" section.
6. Wired the local machine: symlinked `profiles/tui/`'s four files + `plugins/dsh-acp-bridge` into `~/.dsh/profiles/tui/`, ran `pnpm install` there to link the workspace package, then verified: `dsh --profile tui --dump-config` (composed tree correct, provider pin present, profiles/acp untouched) and a live spawn of `dsh --profile tui` sent a real JSON-RPC `initialize` request over stdin and got the correct response back over stdout.
7. Extended README (Layout, new "### dsh-acp-bridge" plugin section, node_modules-symlink caveat, new "### tui" profile section, Testing section) since this deviates from the repl-runner pattern in a way future contributors need to know about.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed via live fetch of agentclientprotocol/typescript-sdk's src/examples/agent.ts that AgentSideConnection is deprecated in favor of the fluent agent()/onRequest()/connect() API — the plan's original assumption (based on the Go SDK's shape) was outdated; used the verified real API instead.

id collision caught during --dump-config review: openma's ACP bundle already registers an internal id literally named acp-bridge (the stdio transport, distinct from acp-plugin) inside profiles/acp/. Renamed our plugin's own id to dsh-acp-bridge everywhere (module name export, cordis.patch.yml insert id, error message) to avoid the ambiguity, even though the two profiles never compose together.

dsh-acp-bridge is the first in-repo plugin with a real third-party npm dependency. The existing whole-node_modules-symlink convention (used by dsh-repl-runner, which has zero real deps of its own) breaks down for that case — worked out and documented a hybrid real-install + scoped-symlink approach instead of forcing the old convention.

@deepseek-ai/dsh-base and other @deepseek-ai/* bundle names in dsh.profile.bundles resolve through dsh's own internal bundle registry, not through npm/node_modules at all — confirmed empirically (no profile's node_modules ever contains dsh-base). Only third-party bundles (openma) or workspace-local plugins need real package.json dependency entries.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scaffolded the first-party, hand-rolled ACP bridge and its profile, with no dependency on openma.

**plugins/dsh-acp-bridge/** — a Cordis plugin (ESM, `node --test`) mirroring `dsh-repl-runner`'s shape. Implements the agent side of the official Agent Client Protocol on the real `@agentclientprotocol/sdk` fluent API (verified against the SDK's own example source, not inferred). This phase answers `initialize` only (`session/new`/`session/prompt`/streaming land in task-002.02); the response is a pure, tested function (`initialize.js` + `initialize.test.js`, TDD).

**profiles/tui/** — a new profile (package.json/cordis.yml/cordis.patch.yml/pnpm-workspace.yaml) mirroring `profiles/acp/`'s structure: inserts the bridge (id `dsh-acp-bridge`, renamed from the planned `acp-bridge` after finding that id already used internally by openma's bundle in `profiles/acp/`), the English agent-preset shadow, and all four MCP mounts (backlog/context7/serena/tinyfish). `config.provider: local` is pinned directly on the bridge's insert entry. `profiles/acp/` is untouched (verified via `git diff`/`git status`).

**node_modules wrinkle**: this is the first plugin with a real third-party dependency (`@agentclientprotocol/sdk` + its `zod` peer), so `dsh-repl-runner`'s whole-directory-symlink convention doesn't apply. Used a hybrid: a real `pnpm install --config.auto-install-peers=false` for the SDK+zod, with the `@deepseek-ai` scope replaced by a symlink into dsh's shared store so the dsh peer packages resolve to the same instances dsh's core uses. Documented in README.

**Tests run:**
- `node --test` in `plugins/dsh-acp-bridge/`: 2/2 pass.
- `dsh --profile tui --dump-config`: composed tree correct (bridge + preset shadow + 4 MCP mounts, provider pin present); `profiles/acp/` confirmed unmodified.
- Live smoke test: spawned real `dsh --profile tui`, wrote a JSON-RPC `initialize` request to stdin, got back `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":false}}}` on stdout with empty stderr.

**Docs**: extended README (Layout, new dsh-acp-bridge plugin section, node_modules-symlink caveat, new tui profile section, Testing section).

**Follow-up**: task-002.02 (session/new, session/prompt, streaming session/update).
<!-- SECTION:FINAL_SUMMARY:END -->
