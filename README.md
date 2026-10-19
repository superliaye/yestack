# yestack

Leon Ye's personal agent skills, packaged as one plugin, `ye`, for Claude Code and Codex.

Skills keep plain names. The harness groups them under the plugin name:

| Harness | Invoke | Filter the menu to this set |
|---|---|---|
| Claude Code | `/ye:<skill>` | type `/ye` |
| Codex | `$<skill>`, shown as `<skill> (ye)` | type `$ye` |

## Install

Claude Code:

```bash
claude plugin marketplace add superliaye/yestack
claude plugin install ye@yestack
```

Codex:

```bash
codex plugin marketplace add superliaye/yestack
codex plugin add ye@yestack
```

## Skills

- [principle-clarify-human-intent](plugins/ye/skills/principle-clarify-human-intent/SKILL.md): Understand the human's intent and judge whether it is clear enough for the next step. Use directly or as a dependency of another skill.
- [principle-unslop-for-human](plugins/ye/skills/principle-unslop-for-human/SKILL.md): Cut AI tells from writing. The body is copied verbatim from Lauren Tan's [pstack `unslop`](https://github.com/cursor/plugins/blob/d457567332aa6989e753ea289f30ea2bfbc80bc0/pstack/skills/unslop/SKILL.md), under the included [MIT license](plugins/ye/skills/principle-unslop-for-human/LICENSE).

## Update

The manifests carry no `version`, so every commit is a new release.

```bash
claude plugin marketplace update yestack && claude plugin update ye@yestack
codex plugin marketplace upgrade yestack && codex plugin add ye@yestack
```

## Layout

```
.claude-plugin/marketplace.json    Claude Code marketplace
.agents/plugins/marketplace.json   Codex marketplace
plugins/ye/
  .claude-plugin/plugin.json       Claude Code manifest
  .codex-plugin/plugin.json        Codex manifest
  skills/<name>/SKILL.md           one folder per skill; `name:` equals the folder name
scripts/check.mjs                  structure checks, also run in CI
```

## Develop

Load your working copy for one Claude Code session; `/reload-plugins` picks up edits:

```bash
claude --plugin-dir ./plugins/ye
```

Before you push:

```bash
node scripts/check.mjs
claude plugin validate . && claude plugin validate plugins/ye
```
