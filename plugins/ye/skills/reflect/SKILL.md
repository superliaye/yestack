---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's transcript in your harness's session store. If the session's identifier or transcript path is known, use it. Otherwise, narrow candidates by session metadata first: keep only the newest transcripts whose recorded working directory is this project, including any subagent transcripts the harness stores beside the main one. Do not read message bodies from other projects' transcripts. That crosses workspace boundaries and reads private chats from unrelated projects.

For each candidate, read its first user message. Take the file whose first user message contains the conversation's opening user prompt. If none matches, or the project's transcripts cannot be told apart, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references.

The reviewers use the `trusty` tier, fixed. The synthesizer starts at the `lazy-genius` tier. Read `../principle-spawn-subagents/SKILL.md` and apply it to every spawn. Keep all four subagents in the session's model family. Each lens gets a different brief, so this is not comparison work.

| Lens | Tier | Prompt template |
|---|---|---|
| Judgment | `trusty` | `references/judgment-reviewer.md` |
| Tooling | `trusty` | `references/tooling-reviewer.md` |
| Divergent | `trusty` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in their final reply.

## 3. Synthesize

Spawn one synthesizer at the `lazy-genius` tier, with the same MCP access as the reviewers. It spot-verifies citations through MCP. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. Read `../principle-encode-lessons-in-structure/SKILL.md` and apply it.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before acting on any item. The user picks the subset and may redirect routings. Do not auto-apply.

Act on each approved item the way the user asks, such as editing the skill in place or opening a pull request.

The **authoring skill** below is the session's skill-authoring skill, if one is available. If none is, make the edit directly under the repo's skill-writing rules.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the authoring skill and run its draft / test / iterate loop, if it has one.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to the authoring skill and run its description-optimization loop, if it has one. Otherwise rewrite the description so it names the missed trigger.
- `new skill: <kebab-name>`: hand creation to the authoring skill. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog: one line per item, with what the user chose to do about it.
- Dropped: one line per rejected finding + reason from the synthesizer.
