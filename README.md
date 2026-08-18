# dsh_plugins

Custom [Cordis](https://github.com/deepseek-ai/deepseek-harness) plugins for
[`dsh`](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek Harness), built from dsh's own
official core services rather than third-party packages.

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
   ln -s ~/git/dsh_plugins/dsh-repl-runner ~/.dsh/profiles/<name>/plugins/dsh-repl-runner
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
ln -s "$DSH_HOME/profiles/node_modules" dsh-repl-runner/node_modules
```

## Testing

```bash
cd dsh-repl-runner
~/.local/bin/mise exec -- node --test
```
