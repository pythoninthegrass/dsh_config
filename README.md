# dsh_config

Version-controlled home for a [`dsh`](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek
Harness) setup: custom [Cordis](https://github.com/deepseek-ai/deepseek-harness) plugins, profile
configs, provider settings, and MCP server wiring — following the same config-repo pattern as
`~/git/{claude_config,opencode_config,pi_config}`. `$DSH_HOME` (`~/.dsh`) holds symlinks back into
this repo; nothing dsh reads lives only under `~/.dsh`.

## Layout

- `plugins/{dsh-repl-runner,dsh-acp-bridge}/` — custom Cordis plugins (below).
- `profiles/{repl,headless,web,acp,tui}/` — tracked profile configs (`cordis.yml`, `cordis.patch.yml`,
  `package.json`, `pnpm-workspace.yaml`), symlinked file-by-file into `~/.dsh/profiles/<name>/`.
- `settings.yaml` — the durable `$DSH_HOME/settings.yaml` (provider/model wiring), symlinked to
  `~/.dsh/settings.yaml`. dsh also persists UI-only state into this file (theme, onboarding
  version) through the same symlink — expect small UI-only diffs; don't commit those.
- `.mcp.json` — source-of-truth MCP server manifest (Claude-Code-style), mirrored by hand into
  each profile's `cordis.patch.yml` (see below). dsh has no native `.mcp.json` reader.
- `.env` (gitignored) / `.env.example` — secrets/vars for the `# dsh` block in
  `~/git/bashrc/.bash_aliases`. `TINYFISH_API_KEY` is the first one a server needs; still
  nothing is templated (`*.tpl` + `envsubst`) — add that if managing these by hand gets painful,
  matching `pi_config`'s pattern.
- `backlog/`, `AGENTS.md`, `.claude/` — this repo is itself a Backlog.md project, used as the MCP
  test target (see below).

## Plugins

### dsh-repl-runner

An interactive, multi-turn direct Agent driver — a stdin/stdout REPL that keeps one Agent/Session
alive across turns, unlike the official `@deepseek-ai/dsh-headless` bundle (one-shot, exits after a
single task). Built on the same primitives `dsh-headless` uses (`ctx.get("agents")`,
`ctx.get("agentDefaultModel")`, `ctx.get("sessions")`), just driven in a loop instead of once.

- `index.js` — the Cordis plugin (readline loop, turn serialization, session lifecycle).
- `summarize-turn.js` — pure function that reduces a session's event log to the last assistant
  text + turn-end reason for one turn; covered by `summarize-turn.test.js` (`node --test`).

### dsh-acp-bridge

The agent side of the official [Agent Client Protocol](https://agentclientprotocol.com), hand-rolled
on the first-party `@agentclientprotocol/sdk` — no dependency on `@openma/deepseek-harness-acp`
(that adapter stays reference-only; see `profiles/acp/`). Mounted by `profiles/tui/`, meant to be
driven by `dish` (Go/Bubble Tea), a separate `~/git/dish` repo not yet created (own
language/toolchain — see backlog task-002 and its subtasks). Talks JSON-RPC over stdio via the SDK's fluent
`acp.agent(...).onRequest(...).connect(acp.ndJsonStream(...))` API — the class-based
`AgentSideConnection` is deprecated upstream.

- `index.js` — the Cordis plugin. Currently answers `initialize` only;
  `session/new`/`session/prompt`/streaming `session/update` land in task-002.02, the rest of the
  ACP surface (permissions, plan, `session/load`/`list`, presets, MCP passthrough) in task-002.03.
- `initialize.js` — pure function building the `initialize` response; covered by
  `initialize.test.js` (`node --test`).

## Using a plugin in a dsh profile

dsh profiles (`$DSH_HOME/profiles/<name>/`) are pnpm workspaces. To wire a plugin in:

1. Symlink (or `git clone`) the plugin directory into the profile's `plugins/` directory, e.g.:
   ```bash
   ln -s ~/git/dsh_config/plugins/dsh-repl-runner ~/.dsh/profiles/<name>/plugins/dsh-repl-runner
   ```
2. Add `plugins/*` to the profile's `pnpm-workspace.yaml` `packages` list, and declare the plugin
   as a `workspace:*` dependency in the profile's `package.json`.
3. Insert it into the profile's `cordis.patch.yml`:
   ```yaml
   - insert:
       - id: code-runtime
         name: '@deepseek-ai/dsh-code-runtime-worker-thread'
       - id: repl-runner
         name: 'dsh-repl-runner'
   ```

### The `node_modules` symlink

Each plugin directory here contains a `node_modules` symlink pointing at
`$DSH_HOME/profiles/node_modules` — the shared store dsh itself maintains one level above
individual profile directories, linking back into the globally-installed `@deepseek-ai/dsh`
package's own bundled dependencies (`dsh-agent`, `dsh-llm`, `dsh-session`, `schemastery`, etc.).

This is required because Node resolves symlinked modules to their real path before walking up for
`node_modules` — so a plugin whose real files live outside `$DSH_HOME` (here, under `~/git/`)
needs its *own* `node_modules` pointer into dsh's shared store; it can't rely on the profile's
local pnpm-hoisted `node_modules` the way a plugin physically nested inside the profile would.
The symlink is host-specific and gitignored — recreate it after cloning onto a new machine:

```bash
ln -s "$DSH_HOME/profiles/node_modules" plugins/dsh-repl-runner/node_modules
```

`dsh-acp-bridge` needs the same fix but also has a *real* third-party dependency
(`@agentclientprotocol/sdk`, plus its own `zod` peer) that isn't part of dsh's shared store, so a
single whole-directory symlink won't do — it needs its own real `node_modules` for those, and only
the `@deepseek-ai/*` scope symlinked in (so it resolves the exact same `dsh-agent`/`dsh-llm`/
`dsh-session`/`schemastery` instances dsh's core uses, not a second copy):

```bash
cd plugins/dsh-acp-bridge
pnpm install --config.auto-install-peers=false   # installs @agentclientprotocol/sdk + zod for real
rm -rf node_modules/@deepseek-ai
ln -s "$DSH_HOME/profiles/node_modules/@deepseek-ai" node_modules/@deepseek-ai
```

## Running a profile

The `dsh-repl` function in `~/git/bashrc/.bash_aliases` (`cd ~/git/dsh_config && command dsh "$@"`)
covers the `repl` profile by default — named `dsh-repl` rather than `dsh` so it doesn't shadow the
real `dsh` binary on PATH:

```bash
dsh-repl
```

The `web` and `acp` profiles aren't wired into that function's default and must be started
manually, with the local API key exported first:

```bash
export LOCAL_API_KEY=lemonade
cd ~/git/dsh_config && dsh web
```

`acp` bundles [`@openma/deepseek-harness-acp`](https://github.com/openma-ai/deepseek-harness-acp)
so an ACP client (`dsh-tui`, Zed) can drive this composition instead of DeepSeek-official cloud.
Its `cordis.patch.yml` pins `id: acp-plugin`'s `config.provider` to `local` — that id (not
`acp-bridge`, the stdio transport, which has no `provider` field) is what
`defaultProvider()`/`requireCredential()` actually read, so this is the override that has to land
on `acp-plugin` or every `session/new` falls back to `deepseek-official` and hits `auth_required`:

```bash
export LOCAL_API_KEY=lemonade
cd ~/git/dsh_config && dsh-tui --agent dsh --agent-arg --profile --agent-arg acp
```

### English agent-preset names

The `acp` profile's "Agent" config picker shipped `standard`/`minimal` with Chinese `name`s.
`agent-presets/{standard,minimal}/` holds English-named shadow copies, wired in by
`profiles/acp/cordis.patch.yml`. See `docs/agent-presets-shadow.md` for the two non-obvious
findings that made the shadow approach actually work.

### tui

`tui` bundles `dsh-acp-bridge` — the first-party, hand-rolled replacement for `acp`'s openma
dependency, meant for `dish` (see backlog task-002) rather than a third-party ACP client. Its
`cordis.patch.yml` pins `id: dsh-acp-bridge`'s `config.provider` to `local` the same
way `acp` pins `acp-plugin`. Not wired into any alias yet (`dish` doesn't exist as a client yet);
start it manually the same way as `acp`:

```bash
export LOCAL_API_KEY=lemonade
cd ~/git/dsh_config && dsh --profile tui
```

## Profiles & MCP

Each profile's `cordis.patch.yml` mounts one `@deepseek-ai/dsh-mcp-client` plugin instance per MCP
server — dsh's first-party MCP client bridge, bundled with the dsh install (no custom adapter
needed). It connects over stdio or streamable-http and registers each server's tools **globally**
on `ctx.tools` as `mcp__<serverName>__<rawName>` — the same server-qualified shape Claude Code
uses — so every agent in the profile (including `dsh-repl-runner`'s) picks them up automatically.

The three servers wired in (`repl`, `headless`, `web` — mirroring `.mcp.json`):

| Server | Command |
|---|---|
| `backlog` | `backlog mcp start` |
| `context7` | `npx -y @upstash/context7-mcp` |
| `serena` | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide --project-from-cwd` |

Keep `.mcp.json` and the three `cordis.patch.yml` files in agreement by hand when servers change —
a `.mcp.json`-reading loader plugin was considered and declined (YAGNI) for three servers.

Caveats:

- **Spawn PATH**: `backlog`/`npx`/`uvx` must be on the PATH dsh inherits (env is scrubbed but PATH
  is preserved). Launch dsh from a shell with mise shims on PATH; if a command isn't found, add
  `env: { PATH: !!js process.env.PATH }` to that server's config or use an absolute `command`.
- **cwd-relative servers**: `backlog mcp start` resolves its project root from cwd and `serena`
  uses `--project-from-cwd` — launch dsh from a project directory. This repo is itself a Backlog
  project (`backlog/config.yml`), making `~/git/dsh_config` the natural test cwd.
- **Silent-by-default failures**: `dsh-mcp-client`'s `failOnStartupError` defaults to `false`, so
  an unreachable server just registers no tools rather than failing loudly. Set it to `true`
  temporarily when bringing up a new server, or watch for `mcp-client(<serverName>)` log lines.
- **web profile exposure**: `dsh web` is loopback-only by design (no auth in front of tool
  execution — see `linux_setup/docs/deepseek-harness.md`); MCP tools run there too, so keep it
  loopback.
- **stderr spam**: `context7`/`serena` are wrapped in `bash -c '... 2>>log'` because
  `StdioClientTransport` defaults child stderr to `inherit` and `dsh-mcp-client`'s config schema
  has no field to override it; logs land in `~/.dsh/logs/` instead.

## Testing

```bash
cd plugins/dsh-repl-runner
~/.local/bin/mise exec -- node --test
```

```bash
cd plugins/dsh-acp-bridge
~/.local/bin/mise exec -- node --test
```
