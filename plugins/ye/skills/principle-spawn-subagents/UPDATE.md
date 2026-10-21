# Update model tiers

The tier map in [`principle-spawn-subagents`](SKILL.md) gives each tier a model and effort level for each model family. Update it when a provider releases or retires a model, or changes prices. To run it, ask an agent to follow this file.

1. **List the current models.** For each family in the table, use the provider's docs to list the generally available models and the effort levels each accepts. Drop retired models.
2. **Gather evidence.** Read at least three public benchmarks or leaderboards that no model provider runs, such as Artificial Analysis, Epoch AI, or Vals AI, and each provider's own pricing page. Price trackers and articles are not benchmarks. Compare models at the effort level you would assign, not only at their maximum. Prefer sources updated in the last three months. For each model, record these numbers with their source:
   - the price per million input and output tokens
   - coding and software-engineering scores
   - general reasoning scores, and how they changed across the family's recent releases
   - how scores and cost change with effort level, where a source measures it
3. **Assign tiers.** For each family, pick the model and effort that best fit each tier's definition. A model can appear in more than one tier at different efforts. Leave a cell as `—` when no model in the family fits.
4. **Edit the tier map only.** Change the tier definitions and the other rules only when the human asks.
5. **Check.** Run `node scripts/check.mjs`.
6. **Report.** Show the old and new tables, the scores and prices behind each changed cell, any cell that differs from an example the human gave, and each source with its URL. Put the source list in the commit message.
