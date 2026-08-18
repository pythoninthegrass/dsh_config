# dsh_config

Version-controlled home for a [`dsh`](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek
Harness) setup: custom [Cordis](https://github.com/deepseek-ai/deepseek-harness) plugins, profile
configs, provider settings, and MCP server wiring — following the same config-repo pattern as
`~/git/{claude_config,opencode_config,pi_config}`. `$DSH_HOME` (`~/.dsh`) holds symlinks back into
this repo; nothing dsh reads lives only under `~/.dsh`.

## Layout

- `plugins/dsh-repl-runner/` — custom Cordis plugin (below).
- `profiles/{repl,headless,web}/` — tracked profile configs (`cordis.yml`, `cordis.patch.yml`,
  `package.json`, `pnpm-workspace.yaml`), symlinked file-by-file into `~/.dsh/profiles/<name>/`.
- `settings.yaml` — the durable `$DSH_HOME/settings.yaml` (provider/model wiring), symlinked to
  `~/.dsh/settings.yaml`. dsh also persists UI-only state into this file (theme, onboarding
  version) through the same symlink — expect small UI-only diffs; don't commit those.
- `.mcp.json` — source-of-truth MCP server manifest (Claude-Code-style), mirrored by hand into
  each profile's `cordis.patch.yml` (see below). dsh has no native `.mcp.json` reader.
- `.env` (gitignored) / `.env.example` — secrets/vars for the `# dsh` block in
  `~/git/bashrc/.bash_aliases`. No servers here need secrets yet, so nothing is templated
  (`*.tpl` + `envsubst`) — add that only when one does, matching `pi_config`'s pattern.
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

## Testing

```bash
cd plugins/dsh-repl-runner
~/.local/bin/mise exec -- node --test
```
