# `.credentials.yaml` and why GUI clients need it

`dsh-credentials-local` resolves an `apiKeyEnv` ref (e.g. `LOCAL_API_KEY` in `settings.yaml`)
through four layers, highest wins:

1. inherited process environment (`env`, read-only)
2. `$DSH_HOME/.credentials.yaml` (`file`, writable — this repo's `.credentials.yaml`)
3. `<invocation cwd>/.env` (`project-env`)
4. `$DSH_HOME/.env` (`user-env`)

CLI usage picks up layer 1 for free: `dsh-repl` (and friends in `~/git/bashrc/.bash_aliases`)
run from an interactive shell, which sources `.env` via `.bash_aliases` before `dsh` ever
starts, so `LOCAL_API_KEY` is already in the process environment.

GUI clients don't get that for free. [DeepSeek Harness
Desktop](https://github.com/dsh-tauri-desk/deepseek-harness-desktop) (macOS, `mbp-nw`) is
launched by launchd/Finder, not a shell — its process environment is launchd's minimal default
(`ps eww` on the running `--profile web` process showed `PATH=...:/usr/bin:/bin:...` and no
`LOCAL_API_KEY` at all). Layer 3 doesn't help either: the app's invocation cwd isn't
`~/git/dsh_config`, so the repo's `.env` is invisible to it. With no layer resolving, dsh treats
`local` as unconfigured and the UI's "Add an API key to get started" prompt reappears on every
launch — "Configure later" only dismisses that session's banner, it doesn't write anything, so
the check fails again on the next launch.

The fix is layer 2: write the ref into `$DSH_HOME/.credentials.yaml` (this repo's
`.credentials.yaml`, symlinked to `~/.dsh/.credentials.yaml` the same way as `settings.yaml`).
That layer beats both `.env` layers and, critically, doesn't depend on what environment the
launching process had — a value in `refs:` there is what the app's own Settings/Models page
writes to when you fill in a key through its UI (`ctx.credentials.set`). Editing the file
directly has the same effect:

```yaml
version: 1

refs:
  LOCAL_API_KEY: vllm
```

Each host's `.credentials.yaml` is real, host-specific content (gitignored, like `.env`) — `mf`
carries `vllm` (a placeholder value; vLLM's `apiKeyEnv` is schema boilerplate it doesn't
check), `mbp-nw` carries the real omlx key. `.credentials.yaml.example` is the tracked template.

Permissions matter: `dsh-credentials-local` refuses to parse the document at boot or on reload
if it carries any group/other permission bit, so the file must stay `chmod 600`.
