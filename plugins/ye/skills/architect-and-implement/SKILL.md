---
name: architect-and-implement
description: "Design with architect, then implement against the chosen sketch, and scrap the sketch when implementation friction shows the shape is wrong. Use when you want the code, not only the design."
disable-model-invocation: true
---

# Architect and implement

Design the change with architect, then fill in code against the chosen sketch.

## Start

Track the phases as a checklist before starting.

1. Design
2. Checkpoint (opt-in)
3. Implement
4. Scrap

## Phase A: Design

Read `../architect/SKILL.md` and follow it through its Phase C. Its sketch and rationale are the input to the phases below.

## Phase B: Checkpoint (opt-in)

Default: proceed directly to implementation with the synthesized design. No human checkpoint.

Opt in to a checkpoint when the invoker explicitly asks: "with checkpoint," "stop and show me before implementing," or similar. Then surface the synthesized design and pause for sign-off.

The synthesis can ship as its own commit either way, as the "scaffold first" mode of `../principle-foundational-thinking/SKILL.md`. Planned and scoped breakage during fill-in is fine. Read `../principle-outcome-oriented-execution/SKILL.md` and apply it.

If the human pushes back on the shape (in a checkpoint or after the fact), return to this skill's Phase A and carry the feedback into architect's grounding. Then repeat this phase. If a checkpoint was requested, get sign-off on each replacement design before implementing it.

## Phase C: Implement against the sketch

Replace `not implemented` bodies with code, pseudocode with logic. The synthesized sketch is the contract. Deviations from it are signal to surface, not friction to absorb silently. If a function needs a parameter the sketch didn't anticipate, ask whether the sketch was wrong, the requirement was missed, or the implementation is overreaching.

## Phase D: Scrap when the architecture is wrong

If implementation keeps producing friction the sketch can't absorb, throw the sketch out. Don't bolt fixes onto a wrong design. Read `../principle-redesign-from-first-principles/SKILL.md` and `../principle-fix-root-causes/SKILL.md` and apply them.

The signal is a *pattern*, not single instances. Tells:

- The same shape of workaround appearing repeatedly across unrelated code.
- Multiple unrelated edge cases that all need special-case branches.
- Types that need escape hatches (`any`, casts, optional fields always set in practice) to compile.
- The "we need a lock" reflex when the sketch said the state wasn't shared.
- Callers having to know the abstraction's internal rules to use it.
- Two or more independent Phase C deviations of the same shape across the implementation.

Use judgment. A few edge cases don't condemn an architecture. Some problems are legitimately complex. Complexity in the data is not complexity in the design.

When you scrap, return to this skill's Phase A with the implementation evidence and the new constraints, so architect's grounding covers what has been built. Tell architect to:

- Treat the new constraints as day-one assumptions, per redesign-from-first-principles.
- Subtract before adding. Read `../principle-subtract-before-you-add/SKILL.md` and apply it. The new sketch should be smaller than the old one before it grows.

Then continue through this skill's Phase B (Checkpoint) and Phase C (Implement).

## Outputs

The implemented change, plus architect's sketch and rationale. Note each deviation from the sketch and why, and whether the sketch was scrapped and re-run.
