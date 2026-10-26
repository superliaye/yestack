---
name: make-a-video
description: "Make a short film about a product or a piece of work, such as a promo, demo, feature walkthrough, or explainer, from a brief of what to present. Researches first, asks the user only what research cannot settle, then directs and produces the film with full creative freedom. Use for 'make a video', 'promo video for X', 'demo video of this feature'."
disable-model-invocation: true
---

# Make a video

**You make one finished film. The user says what to present and to whom. The idea, story, length, look, method, and sound are yours. Make something the audience wants to watch and that makes the value obvious. Apply your own taste.**

This work needs the `trusty` tier or stronger from the tier map in `../principle-spawn-subagents/SKILL.md`. If this session runs a weaker model, stop and tell the user to switch. Read `../principle-spawn-subagents/SKILL.md` and apply it to every spawn.

## Steps

Run the steps in order. When a later step meets something new that you do not know, go back to research before you guess or ask.

1. **Brief.** Read `../principle-clarify-human-intent/SKILL.md` and apply it to the request. Name the subject, the audience, the takeaway, the tone, and every constraint the user stated.
2. **Research.** Find which tools this session can reach, such as data and chat connectors, CLIs, and a browser. Give one read-only investigator to each evidence source that applies, in parallel:
   - **The product.** Use it as the audience would. Walk its flows, try its features on real data, and note what surprises or delights and which states show it at its best. The film's strongest moment usually comes from here. One investigator drives the live UI, because parallel drivers fight over one browser. For a browser or desktop UI, read `../control-ui/SKILL.md` and apply it.
   - **Code.** Follow `../how/SKILL.md` for how it works, and `../why/SKILL.md` when the message rests on why it exists.
   - **Writing about it.** Docs, specs, PRs, tickets, and chat: the intent, the documented limits, and the words people already use for it.
   - **Data.** Queries that size the problem or show real use, when the session can run them.
   - **The audience.** Who they are and what they use today.

   Synthesize one brief that cites a source for each fact and labels inference as inference. Every on-screen claim comes from a cited fact.
3. **Ask.** Ask the user only what research left truly vague, or a decision that must come before you proceed, such as voice, a claim you cannot verify, or a manual step on their machine. Batch the questions, and give your recommendation with each.
4. **Material.** Before you capture a live surface, confirm it still shows real, populated data.
5. **Direction.** Render a short treatment and a few style frames from real material, and show them to the user. This is the cheapest place to change direction.
6. **Produce.** Make the film.
7. **Watch.** Judge the output, not the plan: contact sheets, full-resolution frames at key moments, duration, and loudness. Fix and render again.
8. **Deliver.** Put the film where the user can open it. Give the exact path, a beat list with timecodes, the provenance of music and assets, and the weaknesses you see.

Keep every artifact outside any repository, in one per-run directory, and print its exact path.

## Starter reference

<https://github.com/Vincentwei1021/mg-styles-15> holds 15 motion-design styles, each with its film, prompt, and full source. It also has a deterministic renderer for pages that draw any time `t`, a code-synthesized audio toolkit with CC0 instrument samples, and a review rubric. Use any part of it, or none.

## Lessons from earlier films

- The deliverable is an edited film, not a screen recording. Capture is one step. The film is what you make from it.
- Measure the capture frame rate before you commit to a capture path. A browser screencast waits one round trip per frame, so a remote browser over a slow link gives a slideshow. Capture on the machine next to the browser instead. Hand a self-contained capture script to an agent or person there, and copy the footage back.
- Capture structure along with pixels: timestamps per frame, pointer paths, click times, and element boxes read from the page. Camera moves, callouts, a drawn pointer, and sound cues then land exactly on the real UI.
- Keep one timeline for picture and sound. Export the cue times from the edit and build the soundtrack from them.
- Tell the user about personal data visible in the footage.
