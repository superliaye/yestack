# YeStack

YeStack packages agent skills in the `ye` plugin for Claude Code and Codex.

- Changes to `CLAUDE.md` require explicit user approval.
- Keep `AGENTS.md` as a symlink to `CLAUDE.md` so both agents read the same instructions.
- Put skills in `plugins/ye/skills/<name>/SKILL.md`. The frontmatter `name` must match the folder name.
- To reference a skill that sets `disable-model-invocation: true`, give its relative path in the referring skill's own `SKILL.md`: "Read `../<name>/SKILL.md` and apply it." The skill tool refuses such a skill, and agents often skip a bare name. A path in a `references/` file is ambiguous about which folder it resolves from, so keep these references in `SKILL.md`, unless that `SKILL.md` states the folder its sub-files' paths resolve from.
- Keep skills concise. Add workflow instructions only when they improve on the agent's existing capabilities.
- Keep all agent-read text harness-neutral: skills, references, and prompt templates. Assume a harness that runs skills and subagents, such as Claude Code or Codex. Describe the action, not one harness's tool, parameter, or config ("spawn a read-only subagent", not `Task` with `readonly: true`). Name a model tier, not a model. Only `principle-spawn-subagents` maps tiers to models; when models change, follow its `UPDATE.md`. `scripts/check.mjs` rejects harness and model names elsewhere.
- Keep skills free of organization- and environment-specific facts, such as internal bot, tool, or machine names. A skill takes those from the user's own agent instructions, and falls back to its most conservative behavior when they say nothing.
- Run `node scripts/check.mjs` after changes. For manifest changes, also run `claude plugin validate .` and `claude plugin validate plugins/ye`.
