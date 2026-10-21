---
name: show-me-your-work
description: "Keep a reviewable decision trail for long-running or unattended work: a TSV log with one row per decision (what, why, evidence, result). Local by default; commit it when a reviewer needs the trail to trust the result. For autonomous or multi-phase runs, or work a human reviews after stepping away."
disable-model-invocation: true
---

# Show me your work

Keep one canonical log.

## The format

A single TSV file, one row per decision. Cells stay single-line. Evidence is a pointer, not prose.

Copy `references/decision-log-template.tsv` (the header row) to start a clean log. Columns:

- **ts.** ISO8601 timestamp.
- **phase.** The phase or workstream.
- **decision.** What was chosen or done, one line.
- **why.** The reason in plain words. If a principle drove it, say it plainly, not as a jargon tag.
- **evidence.** A link or path that proves it: commit SHA, PR number, `file:line`, or an artifact, trace, or screenshot path. Never a paragraph.
- **result.** The outcome or predicate state: `tests green`, `reverted`, `pixel-diff 0`, `INCONCLUSIVE`, `open`.

An example, plain-spoken so a reviewer reads it at a glance.

```
ts	phase	decision	why	evidence	result
2026-05-24T09:02:00Z	frame	counted the work first, about 100 components and roughly 75 hours	wanted to know the size before starting a long run	commit 3a9f1c2	found 5 things to sort out before starting
2026-05-24T09:40:00Z	harness	took screenshots of the old version before changing anything	so we can compare old against new and catch any visual change	scripts/snapshot.sh, baseline/	saved 120 reference screenshots
2026-05-24T11:15:00Z	widget	moved the widget styles over without changing how it looks	keep the change small and the result identical	commit 7c21e0a, pixel-diff 0	looks identical, tests pass
2026-05-24T12:30:00Z	widget	threw out a helper's work because its screenshots were blank	checked the real files instead of trusting its summary	worktree reset	reverted, tightened the instructions for next time
```

## Logging a row

Write each entry the way you'd tell a teammate what you did. Plain words, concrete actions, no AI speak or abstract jargon. Read `../principle-unslop-for-human/SKILL.md` and apply it to log text too.

Use the helper `scripts/log.sh <logfile> <phase> <decision> <why> <evidence> <result>`. It stamps `ts`, writes the header on first use, strips stray tabs/newlines, and prefixes any cell starting with `=`, `+`, `-`, or `@` with a single quote. A bare `printf` appending a row works too, but mind those same bytes if cells come from generated or user-supplied text.

Log decision points and checkpoints, not every action: a fork chosen, a unit completed with its verification result, a pivot or revert with its trigger, a blocker surfaced, a gate fixed. For loop runs, one row per iteration. Skip the trivial and self-evident.

A run is one agent conversation, including its later turns and any summary of it. A pickup, a replacement agent, or a new chat starts a new run. Several runs can write to one log, so each run marks where its rows begin:

- When a run first writes to a log that already has rows, its first row has phase `start`.
- Before a run appends rows, it reads the log's last rows. If another run wrote since this run's last row, this run writes a new `start` row first.
- A `start` row's decision names the `ts` range of the rows before it that this run did not write. Its evidence names this run, such as its agent id.
- Use phase `start` for nothing else.

## Where it lives

By default the log is a working artifact, not committed. Keep it outside the repository, in a directory this skill owns, such as `~/.show-me-your-work/<repo>/<task-slug>.tsv`, so a later run can find it. Print its absolute path in the reply.

The log outside the repository stays canonical. Copy it into the repository only when the work is ambitious enough that a reviewer needs the trail to trust the result. Copy it after the audit and the cross-model review, and refresh the copy if the log changes again.

## Rules

- Append-only. A wrong call gets a new row that supersedes it. Never edit or delete history.
- Prefer evidence produced by committed scripts over hand-made one-offs. Read `../principle-encode-lessons-in-structure/SKILL.md` and apply it.

## Audit the log against the transcript

At the end of the run, before handing back, check the log told the truth. Read this run's transcript from your harness's session store. If the session's identifier or transcript path is known, use it. Otherwise, narrow candidates by session metadata to transcripts whose recorded working directory is this project. Do not read message bodies from other projects' transcripts. That reads unrelated private chats. Walk this run's rows against what actually happened. Each stretch of them begins at one of this run's `start` rows, or at the first row if this run created the log, and ends at the next `start` row of another run:

- Check that every row maps to a real decision or action.
- Check that each row's evidence resolves and shows what the row claims.
- A fork, pivot, or abandoned approach that shaped the work but isn't logged is a gap. Add it.

The audit corrects the log by appending rows. It never edits or removes a row, even an invented one. When a row records neither a real decision nor a real action, or its claim or evidence is wrong, add a row that supersedes it with what actually happened and a pointer that resolves. This audit does not check rows outside this run's stretches. If this run's own work shows one of them is wrong, supersede it like any wrong call.

## Cross-model review of the trail

Before handing back, spawn a reviewer on a different model family from the one that did the work, at the `trusty` tier. Self-review is not a substitute. Read `../principle-spawn-subagents/SKILL.md` and apply it. The reviewer reads the audit trail and the run's transcript, then flags what the user should pay attention to. The reviewer looks for unsupported claims, gaps, and risky choices. It does not redo the work.

- Decisions logged with weak or absent evidence.
- Verification steps skipped or claimed without proof in the transcript.
- Choices that look risky in hindsight (premature, scope-creeping, papering over a symptom).
- Gaps the user would otherwise miss on a casual skim.

Every reply for a run that produced a trail ends with an "Attention" section. Lead with the reviewer's model on its own line (`reviewed by <model>`), then list each flag pointing to specific rows or moments. "No flags" is a valid value. The model name is not.

## Reviewing the trail

Read top to bottom, follow the evidence pointers, spot-check. GitHub renders a committed TSV as a table. `column -s$'\t' -t <log path>` renders it in a terminal.

## Composing this skill

Other skills route their audit trail here instead of inventing one. Reference it by path, `../show-me-your-work/SKILL.md`, and let it own the format. Don't restate the columns.
