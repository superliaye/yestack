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

Run `/ye:ping` (Claude Code) or `$ping` (Codex) to confirm the install.

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
