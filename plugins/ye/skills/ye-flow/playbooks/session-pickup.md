### Session pickup

**You own the resume point. Read the prior trail, don't redo it.**

1. Locate the prior trail. A transcript in the harness's session store (narrow by session metadata such as the recorded working directory, and do not read message bodies from other projects' transcripts, because that reads private chats from unrelated projects), a remote agent's link, or a pushed branch. Read the metadata overview and last messages first, then scan back for the decision points. Parse a long transcript in a subagent and keep the reduced timeline in the main thread (`../principle-guard-the-context-window/SKILL.md`). Pick each subagent's tier per the Subagents section.
2. Reconstruct operational state. The branch and worktree, what already landed (`git log`, `git diff` against the base), the open todos, the decisions made. The prior trail is authoritative input. Resist the bias to re-derive it.
3. Diff done vs pending. Compare what shipped against what was planned, name the resume point, do not re-run the prior repro or redo completed work. A "let me verify from scratch" pass means you're treating the trail as untrustworthy when it's authoritative.
4. Route the remaining work to the matching playbook and pick the verdict: continue the execution, ship a finished recommendation, ratify or override a prior conclusion, or postmortem a failed run. The pickup playbook ends after step 5. The routed playbook owns the rest.
5. Verify the inherited claims against the original goal on the real artifact (`../principle-prove-it-works/SKILL.md`). A passing prior self-report is not the proof.

**Reply:** where the prior agent stopped, what you inherited vs redid (ideally nothing redone), the resume point, and the outcome.
