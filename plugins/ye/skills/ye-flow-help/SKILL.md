---
name: ye-flow-help
description: Guides users through YeStack setup, /ye-flow, and picking the skill, playbook, or principle for a task. Type /ye-flow-help with a question.
disable-model-invocation: true
---

# ye-flow help

Answer the user's question about YeStack, hand them a prompt they can send, and link the file the answer came from. For a help question, don't start the work. The user asked how, and a ye-flow run spends real tokens, so let them send the prompt.

A message that asks for work, such as "use ye-flow to fix this bug", is not a help question. Read `../ye-flow/SKILL.md` and do the work under it.

This file maps questions to the skills that hold the answers. Those files own the details. Read the file you route to before you quote it, and trust it when it disagrees with this map. Every path in this skill and its references resolves from this skill's folder, `plugins/ye/skills/ye-flow-help/` in the repository. The links here point into the installed plugin, which the user may not be able to open, so give the user the file's public copy: resolve the path to a repository-relative one and append it to `https://github.com/superliaye/yestack/blob/main/`.

The `/name` commands in this skill and its references are shorthand. Before you hand the user a prompt, write each command the way their harness invokes plugin skills, per the table at the top of the [README](../../../../README.md).

## Find out what they need

Infer the need from the message and the conversation. A named situation, such as "which skill reviews a PR?", goes straight to its section. If the need is still unclear, ask one multiple-choice question with these options, then answer only the section they pick:

- Get set up
- Start a task with `/ye-flow`
- Pick a skill for a situation
- Fix a run that went wrong
- Make YeStack my own

Check the state that changes the answer, and mention it only when it does:

- No `verify-*` skill or other app harness in the project means agents have no scripted way to drive the app. Mention `/create-verification-skill` when the question is about proving a change works.
- No formal verification skill in the project means no property is checked past what tests reach. Mention `/create-formal-verification-skill` when the question is about a race, an invariant, or another case tests rarely hit. When one exists and the code it covers changed after the commit it records as last in sync, mention `/maintain-formal-verification-skill` if the question touches that code.

## Get set up

1. Install the `ye` plugin with the commands in the [README](../../../../README.md) for the user's harness.
2. Put facts about the user's organization and machines in their own agent instructions, not in the skills: which bots review PRs, which checks wait on a human, how many subagents the machine runs, and which other machines may take work. The skills read those facts and fall back to conservative defaults without them.
3. Start a real task with `/ye-flow`, a goal, and a check that can pass or fail.

Installing changes nothing until the user invokes a skill. Every YeStack skill is hidden from the model, so it loads only when the user types it or another skill names it by path. Offer to word their first prompt with them, per [`references/prompting.md`](references/prompting.md).

If cost is the worry, say where the tokens go and how to spend fewer. YeStack spends extra tokens on subagents and review panels. Each skill names a model tier for its subagents, and `../principle-spawn-subagents/SKILL.md` maps each tier to a model. A shorter panel list runs fewer subagents, one for each entry. Save `/ye-flow` for work that needs rigor.

## Start a task with `/ye-flow`

`/ye-flow` matches the task to a playbook, copies the playbook's steps into the todo list, and runs the other skills as the steps need them. A step it skips stays in the list as `skip: <reason>`. A good prompt states the goal and how to tell it's done. It doesn't list skills, because a hand-written sequence tends to drop or reorder steps the playbook would keep. Read [`references/prompting.md`](references/prompting.md) before you help word one.

`/ye-flow` attaches to the message that invokes it, and it can fade as a long chat moves on. Start each new task with `/ye-flow`. Mid-chat, "new task" makes it match a fresh playbook. Subagents that its playbook steps spawn get its path in their brief, so they follow it too.

## Pick a skill

The default answer is `/ye-flow`, which runs most of the others when its steps need them. Name a skill directly when the user wants more or less of something than the playbook gives. Read the skill before you recommend it, and give one example prompt.

| The user wants to | Skill |
|---|---|
| Do any non-trivial task with rigor | [`/ye-flow`](../ye-flow/SKILL.md) |
| Check that the agent understood their goal and the problem before it starts | [`/in-your-own-words`](../in-your-own-words/SKILL.md) |
| Aim a task higher before starting: more expert, more outcome-focused, not overspecified | [`/sharpen`](../sharpen/SKILL.md) |
| Know how code works now, or where new code should live | [`/how`](../how/SKILL.md) |
| Know why code is shaped this way, or where a number came from | [`/why`](../why/SKILL.md) |
| Understand a change or subsystem, explained plainly | [`/teach`](../teach/SKILL.md) |
| Catch up on their own recent work on a topic | [`/recall`](../recall/SKILL.md) |
| Catch up on what changed in this chat since their last message, in plain words and small visuals, with every item waiting on them listed and decidable from the reply alone | [`/ketchup`](../ketchup/SKILL.md) |
| Know what a small diff could break outside itself | [`/blast-radius`](../blast-radius/SKILL.md) |
| Settle types and module shape before code that crosses a function boundary, and stop at the design | [`/architect`](../architect/SKILL.md) |
| Settle the design, then implement it | [`/architect-and-implement`](../architect-and-implement/SKILL.md) |
| Get several attempts at one brief, merged into the best one | [`/arena`](../arena/SKILL.md) |
| Run parallel checks over slices, or race workers | [`/swarm`](../swarm/SKILL.md) |
| Have different models review a diff and try to break it | [`/interrogate`](../interrogate/SKILL.md) |
| Fix a bug test-first when a cheap local test exists | [`/tdd-bug-fix`](../tdd-bug-fix/SKILL.md) |
| Apply TypeScript rules to `.ts` or `.tsx` work | [`/typescript-best-practices`](../typescript-best-practices/SKILL.md) |
| Remove AI-generated code slop from the branch diff | [`/deslop`](../deslop/SKILL.md) |
| Strip comments before review, using a reviewer that didn't write them | [`/no-comments`](../no-comments/SKILL.md) |
| Clean AI tells out of prose | [`/principle-unslop-for-human`](../principle-unslop-for-human/SKILL.md) |
| Write docs, an RFC, a README, a PR description, or a commit message to a standard | [`/technical-writing`](../technical-writing/SKILL.md) |
| Hear the last reply again in plain words | [`/bro`](../bro/SKILL.md) |
| Drive a browser, Electron, or web UI to verify or reproduce something | [`/control-ui`](../control-ui/SKILL.md) |
| Drive an interactive CLI or TUI to verify or reproduce something | [`/control-cli`](../control-cli/SKILL.md) |
| Give agents a scripted way to drive the app and prove behavior | [`/create-verification-skill`](../create-verification-skill/SKILL.md) |
| Bring a verification skill and its feature map back in line with the app | [`/maintain-verification-skill`](../maintain-verification-skill/SKILL.md) |
| Formally verify a race, invariant, or other property that tests rarely reach | [`/create-formal-verification-skill`](../create-formal-verification-skill/SKILL.md) |
| Bring a formal verification back in line after the code it covers changed, and learn whether a failure is drift or a bug | [`/maintain-formal-verification-skill`](../maintain-formal-verification-skill/SKILL.md) |
| Vet a performance number before reporting or acting on it | [`/benchmark-checklist`](../benchmark-checklist/SKILL.md) |
| Run a large or cross-cutting change, or one to review after stepping away | [`/figure-it-out`](../figure-it-out/SKILL.md) |
| Keep a decision log during a run, and review it afterward | [`/show-me-your-work`](../show-me-your-work/SKILL.md) |
| Turn their own working habits into a personal mode skill | [`/automate-me`](../automate-me/SKILL.md) |
| Turn what a finished task taught into skill edits | [`/reflect`](../reflect/SKILL.md) |
| Stop agents from repeating the same mistakes in this repo | [`/correct`](../correct/SKILL.md) |
| Find their way around YeStack | `/ye-flow-help` |

If a skill directory next to this one is missing from the table, read its frontmatter and route by its description. The `principle-*` directories are covered under principles below.

Close calls:

- `/how` explains what the code does. `/why` explains the reasons. `/teach` runs one or both and explains the result plainly.
- `/arena` gives every worker the same brief and merges the best parts. `/swarm` splits work into slices or a race and returns one report.
- `/architect` stops at the design. `/architect-and-implement` writes the code after the design is settled. Add "with checkpoint" to review the design before it writes code.
- `/interrogate` reviews the diff. `/blast-radius` looks for breakage outside the diff and proves the one fact that makes the change safe.
- `/recall` rebuilds context across recent chats. `/ketchup` covers only this chat since the user's last message. Resuming one specific chat or branch is the Session pickup playbook.
- `/figure-it-out` designs one rigorous run. The Orchestrate playbook runs a program that spans days and many PRs. The Autonomous run playbook drives one task to a finish condition.

Not in YeStack:

- A loop or recurring-run command and skill-authoring help belong to the harness, if it has them.
- YeStack has no `/orchestrate` skill. Orchestrate is a `/ye-flow` playbook. If the slash menu shows `/orchestrate`, another plugin provides it.

## Playbooks and principles

Playbooks are step lists inside `/ye-flow`, not skills, so they have no slash command. Inside `/ye-flow`, describing the task picks one, and these phrases name one directly:

- "babysit this pr" runs Babysit in `drive` mode. It runs the repo's local checks, marks a draft ready for review, fixes CI and review-bot threads, and stops at merge-ready. It never adds reviewers, and it doesn't merge unless the user asks to merge, land, or ship. "check on pr 123" runs one status pass and a report, and changes nothing.
- "land the stack" runs Shipping.
- "take over this branch" runs Session pickup.
- "pause safely" runs Pause safely.
- "full autopilot on this queue" runs Autopilot-full. "stack them, don't ship" runs Autopilot-stack. Both run only on an explicit request, and Autopilot-full also needs merge authority.
- "run the eval playbook" runs Eval.

Without `/ye-flow`, a phrase such as "babysit this pr" can start another skill for the same job instead. The Playbooks section of `../ye-flow/SKILL.md` lists every playbook and when it applies.

YeStack has no planning skill. The harness's plan mode, if it has one, works alongside it. For work that spans phases or stacked PRs, asking `/ye-flow` for a plan runs the Multi-phase plan playbook (`../ye-flow/playbooks/multi-phase-plan.md`), which writes the plan and doesn't implement it. For a design question, the Prototype playbook or `/architect` settles it in code first.

Principles are one-rule skills that `/ye-flow` reads and cites in its replies. The user rarely invokes one. They steer with the names instead, as in "apply prove it works. show me the real output." Typing `/principle-<name>` still loads one on demand. The Principles section of `../ye-flow/SKILL.md` lists them and when each applies.

## Fix a run that went wrong

| Symptom | Fix |
|---|---|
| The mode stopped applying after a few turns | Start each task with `/ye-flow`, or say "new task" with it. |
| A question got treated as the next step of the last task | Say "new task", or say the turn doesn't need the mode. |
| Runs cost more than expected | See the cost paragraph under Get set up. |
| A skill didn't load on its own | Every YeStack skill is hidden from the model. It loads when the user types it or when a skill names it by path, and `/ye-flow` doesn't run every skill. |
| A skill got an organization fact wrong, such as a review bot or a human approval check | Add the fact to the user's own agent instructions. Skills read it from there. |
| Parallel agents overwrote each other | Give each agent its own worktree, per the Workspaces section of `../principle-spawn-subagents/SKILL.md`. |
| An overnight run moved but finished nothing | The loop needs a check that can pass or fail, not a duration. |
| The reply claims success from a green build | Ask for the real command, flow, stored value, or profile. That's the prove-it-works principle. |

For a run that drifts, [`references/prompting.md`](references/prompting.md) has one-line steers, and [`references/recipes.md`](references/recipes.md) has prompts worth copying.

## Make YeStack my own

- [`/automate-me`](../automate-me/SKILL.md) drafts a personal mode skill from the user's own history, to use alongside `/ye-flow`.
- [`/reflect`](../reflect/SKILL.md) after a session turns its lessons into skill edits the user approves.
- `/ye-flow write a skill for <workflow>` runs the authoring playbook. The eval playbook tests a skill change blind.
- Organization and machine facts go in the user's own agent instructions, not in a skill.
- Fix a misbehaving skill in its own PR, not inside the feature work where it went wrong.

## Reply

Lead with the answer. Give at most one example prompt in a code block, adapted from [`references/recipes.md`](references/recipes.md) when one fits, then the link to that file. Keep it short unless the user asked for the whole map.
