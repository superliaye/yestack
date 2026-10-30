---
name: beta-reader
description: "Read a draft with a colleague who knows the area but has not followed the specific work. They respond one part at a time with what they understand, what they need, and what distracts them. The author keeps each change true to the work."
disable-model-invocation: true
---

# Beta reader

Work with a reader from the text's intended audience. You have done the work and hold its full context. They know the area and general context, but have not followed this particular work. Read the draft together and use their reactions to find what needs explanation, evidence, or less attention. The text can end up longer or shorter. You decide what changes and keep it true to the work.

## Before you start

You need the text the user wants reviewed and the material behind it. If the text does not exist yet, write it first from that material, not from earlier summaries in the session. Keep the material available for your own accuracy checks.

Identify the intended reader, what they know of the field, and their reading purpose. From the user's request, decide what the text should enable them to understand, decide, or do. Keep the intended takeaway with you. Give the reader their role and purpose without supplying the answers the text must convey. The text's purpose sets the required depth and coverage. When the text introduces deeper material, readers should be able to stop with a coherent understanding or continue with useful context.

Give the reader pointers to background that someone in that role would know: the existing system, team priorities, earlier decisions, or related work. Let them fetch more background as needed. Naming a role does not supply its knowledge. For code, provide the base revision so they can inspect the system before the change. Keep the specific work out of that preparation, including its diff, your investigation findings, and unseen parts of the draft. Make this boundary concrete with paths, links, or revisions. If relevant background is unavailable, establish what the reader can assess and report the limitation.

Split the text into consecutive parts that each complete one thought the reader needs. Keep a claim with the explanation or example needed to understand it. Prefer paragraph boundaries and use headings as a guide. A short, single-purpose text can be one part. Each part must make sense with the preceding text. Do not split by sentence count.

## Read it together

Use the `lazy-genius` tier for the reader. Read `../principle-spawn-subagents/SKILL.md` and apply its model-tier mapping without tier adjustment.

1. Spawn one fresh, read-only subagent with no session history. Send it the reader prompt below with the role, purpose, background pointers, and specific work filled in. Let it read the background before the draft. Keep this one reader for the whole conversation. Do not give it writing-rule skills or an editing checklist.
2. Send the first part with its title and formatting. Read the reply as a colleague's reaction. Compare what they understood with the intended meaning, and judge their questions and suggestions against the work and the text's purpose. Take a suggestion, adjust it, or keep your wording. A reader who finds a part unclear is right about the reading even when their proposed fix is wrong. Find a fix that works. Do not invent evidence they ask for.
3. Discuss the feedback, send revisions, and continue with the next part. Put explanations needed by the intended audience into the draft, so understanding does not depend on your conversation. For a short text, resend the whole revised text so far. For longer text with local edits, send only the changed parts, clearly identified. Resend the revised text so far when changes to order, terminology, or the central explanation make updates hard to follow.
4. After the last part, send the complete revised text and the final-pass prompt below. Judge the reply against the text's purpose and the material. Revisit passages with consequential misunderstandings or gaps. Stop when the reader's account shows the intended understanding. Another wording preference alone does not require another round.

The reader prompt:

> You are `<role in the intended audience>`. I'm a colleague sharing a draft with you. You're reading it to `<reading purpose>`.
>
> Here is background on the area and what the team is working on: `<background pointers and base revision where relevant>`. Read enough to get familiar with the context, and look up more background whenever you need it. Tell me if you cannot find context you need.
>
> I want your first reading of this particular work, so leave `<specific diff, investigation findings, or other work material>` unopened. I'll send the draft one part at a time. Please wait for each part rather than reading ahead.
>
> Tell me what you make of each part, as you would in a conversation with a colleague. What do you think I'm trying to say? Does it make sense given what you know about the area? Tell me where you need an explanation or evidence, and what feels distracting or too minor to deserve the attention it gets. Ask when you're unsure what I mean. Distinguish something you need explained now from a question that can wait until later.
>
> Use your own judgment about what matters for your reading purpose. You do not need to find a problem in every part or rewrite it for me. When a part works, tell me what came through. If something later changes your reading of an earlier part, bring it up.

When the user wants concise or short writing, add this to the opening while keeping the intended audience's role:

> You've already had two cups of coffee. You're doing due diligence on this before getting back to your own work. You want the point and enough context to judge it without spending more time than necessary.

The final-pass prompt:

> Here's the complete revised text. What's your understanding now, and do you have what you need for `<reading purpose>`? Tell me if anything still needs explanation or evidence, repeats, or distracts from the point. Flag anything that only makes sense because of our conversation and still needs to be in the text.

## Finish

Check the revised text against the source material before handing it off. Give the user the revised text. Outside it, list substantive additions under **Added** and omissions under **Left out**, one line each. Skip wording adjustments. Name any point you and the reader did not settle.
