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
- [principle-subtract-before-you-add](plugins/ye/skills/principle-subtract-before-you-add/SKILL.md): Remove dead weight first, then build on the simpler base. The body is copied verbatim from Lauren Tan's [pstack `principle-subtract-before-you-add`](https://github.com/cursor/plugins/blob/d457567332aa6989e753ea289f30ea2bfbc80bc0/pstack/skills/principle-subtract-before-you-add/SKILL.md), under the included [MIT license](plugins/ye/skills/principle-subtract-before-you-add/LICENSE).
- [principle-laziness-protocol](plugins/ye/skills/principle-laziness-protocol/SKILL.md): Bias toward deletion and the smallest change that solves the problem. The body is copied verbatim from Lauren Tan's [pstack `principle-laziness-protocol`](https://github.com/cursor/plugins/blob/d457567332aa6989e753ea289f30ea2bfbc80bc0/pstack/skills/principle-laziness-protocol/SKILL.md), under the included [MIT license](plugins/ye/skills/principle-laziness-protocol/LICENSE).
- [principle-choose-model-tier](plugins/ye/skills/principle-choose-model-tier/SKILL.md): Map the six tiers that skills name, from `tireless-genius` to `no-brainer`, to a model and effort for Claude, GPT, and Grok. To refresh it, ask an agent to follow [its update steps](plugins/ye/skills/principle-choose-model-tier/UPDATE.md).
- [how](plugins/ye/skills/how/SKILL.md): Explain how a subsystem works, or where code should live, with parallel read-only explorers and one explainer. Adapted from Lauren Tan's [pstack `how`](https://github.com/cursor/plugins/tree/d457567332aa6989e753ea289f30ea2bfbc80bc0/pstack/skills/how) to run in any harness, under the included [MIT license](plugins/ye/skills/how/LICENSE).

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
  skills/principle-choose-model-tier/UPDATE.md   how to refresh the model tier table
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
