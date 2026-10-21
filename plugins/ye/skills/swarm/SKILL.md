---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report: coverage across slices, races between workers on identical briefs, or exploration."
disable-model-invocation: true
---

# Swarm

## Start

Track the four phases as a checklist before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare the selection rule before spawning:
   - `first pass`: the first arm that reports `PASS` wins.
   - `rank all`: every arm finishes, and you rank them by criteria you name now.
   - `best-of`: every arm finishes, and you pick one winner by criteria you name now and say why each other arm lost.
3. Workers start at the `trusty` tier. Read `../principle-spawn-subagents/SKILL.md` and apply it to every spawn. For a model race, name each arm's model up front.
4. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn the N workers. When a worker gets its own workspace, it starts from the branch or commit its brief names.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report: a table with one row per slice or arm (its verdict, evidence, and any gap), one line per issue, any dropouts, and the selection rule when used.
