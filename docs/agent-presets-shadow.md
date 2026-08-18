# Shadowing the `standard`/`minimal` agent presets

The `acp` profile's "Agent" config picker shipped two of its four presets with
Chinese `name`s (`标准模式`/`极简模式` for `standard`/`minimal` —
`code`/`cordis` already render as "Code"/"Creator" via a hardcoded override in
the ACP bridge's `presetDisplayName()`, unaffected). `agent-presets/{standard,minimal}/`
holds English-named copies of those two presets' `preset.yml` +
`agent.cordis.yml` (byte-identical to the shipped `agent.cordis.yml`, so they
track vendor updates — do not edit their internal comments). `profiles/acp/cordis.patch.yml`
inserts its own `@deepseek-ai/dsh-agent-presets` instance pointed at that
directory first, then the shipped root second, so only `standard`/`minimal`
shadow; `code`/`cordis` still resolve from the shipped root.

Two non-obvious things made this work, both found by temporarily instrumenting
`@openma/deepseek-harness-acp`'s and `@deepseek-ai/dsh-agent-presets`' vendor
code (reverted after):

- **The inserted entry's id must not be `agent-presets`.** Some late,
  unconditional step in dsh's own profile composition (not visible in
  `cordis.patch.yml` or `--dump-config`) patches any entry with that exact id,
  replacing `config.roots` wholesale with just the shipped path — discarding a
  configured root entirely, silently. Naming the entry `agent-presets-shadow`
  avoids it; the Cordis *service* key consumers read (`agentPresets`) is
  unrelated to the loader id, so nothing else needs to change.
- **Insertion order alone doesn't guarantee our instance mounts first.**
  `dsh-acp-plugin` (id `acp-plugin`) only mounts its own shipped-root-only
  `agentPresets` instance if nothing has already provided that service; racing
  it by array position is unreliable. `cordis.patch.yml` adds
  `inject: [...original list, agentPresets]` to `acp-plugin`'s override,
  turning that guard into a real Cordis dependency — dropping any of the
  original entries would silently break whatever service they backed, so the
  full list has to be restated (`Entry#update` replaces `inject` wholesale,
  it doesn't merge it).
