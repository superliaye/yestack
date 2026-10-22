---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Track the phases (Frame, Fan out, Cross-judge, Pick, Graft, Verify) as a checklist before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners. They start at the `trusty` tier. Read `../principle-spawn-subagents/SKILL.md` and apply it to every spawn. Every runner gets the same prompt, so this is comparison work: put at least one runner on another model family. Spawn more runners when the arena covers multiple design directions. Use the same model several times when the work is generation-bound rather than judgment-sensitive.
4. Give each candidate its own output location: its own folder under a per-run temporary directory, or its own workspace when candidates must edit the same repository files. Read `../principle-separate-before-serializing-shared-state/SKILL.md` and apply it.

## Phase B: Fan out

Spawn the N candidates, each with the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, spawn one read-only judge at the `lazy-genius` tier, on a different model family from the parent's when one is available. It sees the rubric and the candidates by path label, scores each criterion, and recommends a base with rationale. It runs in parallel with your reading in Phase D. Don't spawn it while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API. Read `../principle-laziness-protocol/SKILL.md` and apply it.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, so the result stays coherent under one mental model. Read `../principle-redesign-from-first-principles/SKILL.md` and apply it. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output. Read `../principle-prove-it-works/SKILL.md` and apply it. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.
