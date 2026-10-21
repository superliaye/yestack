---
name: principle-spawn-subagents
description: Sets up, briefs, and reviews subagents, and maps each model tier to a model and effort. Use when a skill spawns subagents or names a tier.
disable-model-invocation: true
---

# Spawn subagents

When a skill prescribes how to set up, run, or present its subagents, follow it. A tier the skill names is a starting point that you may adjust, unless the skill fixes it. Apply this principle to every choice the skill leaves open.

## Brief

Point to files, diffs, and artifacts by path instead of pasting their content.

## Access and timing

Give each subagent the least access that still includes every tool its work needs. If a read-only mode removes a tool the work needs, such as MCP servers, spawn a normal subagent and tell it not to write.

Spawn independent subagents in one batch so they run in parallel. Run every subagent in the background.

## Workspaces

Run subagents in the current workspace by default. Give a subagent its own workspace, such as a worktree or a remote sandbox, only when the work cannot finish safely in the shared one: two subagents would write the same files, or a subagent needs a different branch or commit checked out. Workers that write to separate files or output folders share the workspace.

Remove a separate workspace as soon as its result is recorded, unless a later step needs it, such as a branch to push or a process still running. Report the path of each workspace you keep.

## Model tier

Skills name a tier, not a model. Tiers run from strongest to weakest:

| Tier | Work |
|---|---|
| `tireless-genius` | Long, hard work that must not fail. Quality matters more than cost. |
| `lazy-genius` | Judgment and design that need the highest-quality reasoning, not long or exhaustive effort. |
| `trusty` | Most day-to-day work, at quality you can trust without checking every detail. |
| `routine` | Routine work that needs little reasoning. |
| `budgeted` | Routine work on a smaller budget, where somewhat lower quality is acceptable. |
| `no-brainer` | Simple tasks such as classifying, rephrasing, translating, or defining a word. Use a smart, cheap model, not the weakest one. |

Difficulty sets the tier, not the precision of the brief. A hard change written as exact steps still needs a strong tier.

Start from the tier the skill names, or from the definitions above when it names none. Move one tier up for the hardest or subtlest work, and one tier down for routine work. In a fan-out where each worker verifies or measures a different slice or commit, every worker keeps the named tier without adjustment, so their results compare.

## Model family

Keep every subagent in the session model's family unless the work compares outputs for the same input, as in a second opinion, a review panel, or a bakeoff. For those, give at least one participant the same brief on another family's model at the same tier. Agreement across families is strong evidence. Agreement within one family is weaker, because its models share blind spots.

Some harnesses reach another family only through a saved agent definition, and some accept the model but never deliver the brief. If the harness's own subagents can't reach another family, run the other family's agent CLI non-interactively from the shell, with the brief as its prompt. Apply the same access and workspace rules to it, and say in the brief whether it may write. Check that each reply answers its brief. If no other family works, use a nearby tier whose cell names a different model, and say that the comparison stayed in one family. If every cell names the same model, say that no model diversity was available.

## Tier map

Each cell is a model and its effort level:

| Tier | Claude | GPT | Grok |
|---|---|---|---|
| `tireless-genius` | Opus 5.5 · max | GPT-6-Astra · max | Grok 4.7 · xhigh |
| `lazy-genius` | Opus 5.5 · high | GPT-6-Astra · medium | Grok 4.7 · high |
| `trusty` | Opus 5.5 · medium | GPT-6.1-Sol · high | Grok 4.7 · medium |
| `routine` | Sonnet 5.5 · medium | GPT-6.1-Sol · medium | Grok 4.7 · medium |
| `budgeted` | Sonnet 5.5 · low | GPT-6.1-Sol · low | Grok 4.7 · low |
| `no-brainer` | Haiku 5.5 · low | GPT-6-Luna · low | Grok 4.7 · low |

Use the column for the family chosen above. Pass the model and the effort through the options of whatever runs the subagent, the harness or an agent CLI. If the harness rejects the model or effort of a tier you adjusted, use the named tier unadjusted instead of trying another tier. If the harness cannot set the model or effort at all, or the cell is empty, keep the session's value. Say so either way. A model the human names overrides the tier.

## After a subagent returns

You own its work. Review its diff or evidence yourself. Unless the skill says how to present the result, write your own summary instead of passing its report through.

## Fresh or reused

Give new work to a fresh subagent with consolidated scope: the original brief, every later directive, and the prior agent's report and branch. This covers a fix round, a follow-up, a retry, and the next item in a queue. Resumes chained across interrupts silently drop directives, so fire a fresh subagent with consolidated scope instead of trusting a "done" summary.

Reuse an agent only when the new work needs state that lives in it and costs a lot to move: its checkout, its uncommitted changes, or a process it still runs, such as a dev server, a simulator, or a PR or CI watcher. A stop or hold order to a running agent is not reuse. A role such as a PR owner outlives its agent. Once that agent returns, a fresh agent takes the role's next round.
