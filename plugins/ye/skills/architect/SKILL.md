---
name: architect
description: "Sketch types, signatures, and module structure before code, and stop at the design. Use for 'architect this', 'design this', or non-trivial work where jumping to code would lock in the wrong shape."
disable-model-invocation: true
---

# Architect

Sketch types, function signatures, class shapes, and module boundaries with `not implemented` bodies and pseudocode. Synthesize across multiple model perspectives into one design. This skill ends at the design. It does not implement.

## Start

Track the three phases as a checklist before starting.

1. Ground
2. Sketch
3. Present

## Phase A: Ground the problem

Build a real mental model of every system the new code touches. Follow `../how/SKILL.md` over the relevant subsystems. Naming a file isn't grounding. Produce the architectural explanation `how` prescribes. If the design redefines ownership or layering, also follow `../why/SKILL.md` on the existing shape so the rationale becomes a constraint, not a guess.

Skip Phase A only when the work is genuinely greenfield with no surrounding system to integrate.

## Phase B: Sketch

Follow `../arena/SKILL.md` with the design-sketch task and the Phase A grounding artifacts. Pass `references/runner-prompt.md` as each runner's prompt. Add the absolute paths of this skill, `references/rationale-template.md`, and the principles the runner prompt names: `../principle-separate-before-serializing-shared-state/SKILL.md`, `../principle-encode-lessons-in-structure/SKILL.md`, `../principle-boundary-discipline/SKILL.md`, `../principle-make-operations-idempotent/SKILL.md`, `../principle-laziness-protocol/SKILL.md`, and `../principle-minimize-reader-load/SKILL.md`. Arena's runner rules pick the runners.

Design it twice. Require at least two structurally distinct candidates before synthesis, even when the first looks sufficient. This overrides arena's dropout and convergence defaults: if a runner drops out or the candidates converge on one shape, request a replacement or an alternative before synthesizing. If the constraints allow only one shape, say so instead of claiming two. Read `../principle-exhaust-the-design-space/SKILL.md` and apply it. Whole-shape alternatives, not point fixes inside one shape.

Screen every candidate against [`references/design-red-flags.md`](references/design-red-flags.md) before synthesis. Assume the next contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. Prefer the design where a change that looks right from one file is right for the whole repo.

Compare viable candidates on interface depth. Prefer the design that hides more complexity behind a smaller, simpler public surface. A rich interface can keep call chains short by concentrating capability instead of scattering it across layers.

Arena returns one synthesized design package. Its synthesis decision fills the rationale's "Synthesis decision" section.

## Phase C: Present the design

Present the synthesized design: the sketch and the rationale. Then stop. Do not fill in bodies or write implementation code, unless a calling skill continues past this phase.

When the design needs adversarial pressure, follow `../interrogate/SKILL.md` on the synthesized sketch before you present it.

If the human pushes back on the shape, treat that as Phase A evidence. Re-ground and re-run Phase B.

## Outputs

The caller's usage is written first and the type sketch derived from it. One file with new types and signatures for small changes. Module map plus type definitions for larger work. The rationale ships alongside, shaped per `references/rationale-template.md`, including the usage sketch and the synthesis decision.
