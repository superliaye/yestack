---
name: get-to-the-point
description: "Clear, concise writing with the core idea, necessary reasoning, and material caveats intact, plus a short record of what was cut and deliberately kept."
disable-model-invocation: true
---

# Get to the point

Give the reader the point and enough context to judge it and act.

## Steps

1. **Establish the audience.** Default to experienced peers in the field unless the user or context indicates otherwise. Establish what the text should let them understand, decide, or do.

2. **Read the material.** Read the material behind the text and keep it available for accuracy checks. Preserve any existing version so the author can restore cuts.

3. **Write the first version yourself.** Write or rewrite the text before review. Privately state the core idea in a few sentences, the evidence or reasoning needed to support it, and any decision or action the reader needs to take.

   Build the shortest complete argument from that outline. For each section or logical block, ask what the reader would lose if it disappeared. Remove, combine, or shrink blocks accordingly; routine execution may need only its outcome. Keep the links in the reasoning that make the conclusion follow.

   Read every sentence. Cut what the audience can infer or does not need: method footnotes, empty hedges and disclaimers, lines describing the text itself, repeats of a nearby table or sentence, and definitions of familiar terms. Keep a caveat when it changes how a reader weighs a result, its scope, or their next action.

4. **Spawn the expert reviewer.** Use one fresh, read-only subagent with no session history at the `lazy-genius` tier. Read `../principle-spawn-subagents/SKILL.md` and apply its model-tier mapping without tier adjustment.

   Give them the audience, reading purpose, and concrete pointers to relevant background: the existing system, priorities, earlier decisions, or related work. For code, use the base revision. Let them read enough to become context-rich and fetch more background as needed. Keep the specific work's diff, investigation notes, source artifacts, earlier drafts, and your intended takeaway out of that preparation. State the allowed background and excluded material with paths, links, or revisions. If needed background is unavailable, report the limit on the review. After preparation, send the complete current text with the reviewer brief below.

5. **Incorporate feedback.** Compare the reviewer's core idea with the intended meaning. A misread core idea is a red flag: check the wording, structure, and missing context, then fix the text so it carries the intended meaning. Apply useful cuts, starting with whole blocks, and check the result against the source material. You own accuracy: keep any detail whose removal would distort the claim, weaken necessary reasoning, or hide a material limit, even if the reviewer would cut it.

   If the core idea was misread or the central argument changes, have the reviewer read the complete revision again. Stop when the core idea is clear and the remaining material serves the reading purpose; another wording preference does not require another round.

6. **Hand off the result.** Give the user the finished text. Outside it, report **Cut by kind** and **Kept on purpose**, with brief reasons. Include locatable quotes or section references for substantive cuts so the author can restore them, including cuts from the first rewrite. Name any unresolved issue that affects the meaning. Keep this report short.

## Reviewer brief

> You are `<audience role>`, reading to `<reading purpose>`. An experienced teammate wrote this. You are busy, have already had two cups of coffee, and want to get back to your own work. You trust them to handle straightforward execution. Spend your attention on the idea, its consequences, and what you need to judge it.
>
> Judge what the stated audience needs. If they know less than you, keep the context they need.
>
> Read the whole draft and give me:
>
> - **Core idea:** In a few sentences, what is this telling you? Infer it from the draft.
> - **Big cuts:** Which whole sections or lines of argument deserve less space, can be combined, or can go? Name the passage and the smaller point, if any, that needs to survive.
> - **Sentences I don't need:** Quote sentences where your reaction is “I trust you to handle this,” “I don't need to know how,” “That's straightforward,” or “You already told me.” Briefly say why each does not earn its place for your reading purpose.
> - **Needed to judge it:** Flag missing reasoning or evidence that affects your understanding or decision, and caveats that must survive the cuts. Leave minor corners and wording preferences alone.
>
> Use your judgment. Do not manufacture cuts or questions to fill a category. Keep the work's supporting artifacts unopened; the draft must carry its own explanation.
