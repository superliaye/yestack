---
name: principle-choose-model-tier
description: Maps model tiers to a model and effort per model family. Use when a skill names a tier for a subagent.
disable-model-invocation: true
---

# Choose model tier

Skills name a tier, not a model. Pick the tier by what the work needs:

| Tier | Work |
|---|---|
| `tireless-genius` | Long, hard work that must not fail. Quality matters more than cost. |
| `lazy-genius` | Judgment and design that need the highest-quality reasoning, not long or exhaustive effort. |
| `trusty` | Most day-to-day work, at quality you can trust without checking every detail. |
| `routine` | Routine work that needs little reasoning. |
| `budgeted` | Routine work on a smaller budget, where somewhat lower quality is acceptable. |
| `no-brainer` | Simple tasks such as classifying, rephrasing, translating, or defining a word. Use a smart, cheap model, not the weakest one. |

Each cell is a model and its effort level:

| Tier | Claude | GPT | Grok |
|---|---|---|---|
| `tireless-genius` | Opus 5.5 · max | GPT-6-Astra · max | Grok 4.7 · xhigh |
| `lazy-genius` | Opus 5.5 · high | GPT-6-Astra · medium | Grok 4.7 · high |
| `trusty` | Opus 5.5 · medium | GPT-6.1-Sol · high | Grok 4.7 · medium |
| `routine` | Sonnet 5.5 · medium | GPT-6.1-Sol · medium | Grok 4.7 · medium |
| `budgeted` | Sonnet 5.5 · low | GPT-6.1-Sol · low | Grok 4.7 · low |
| `no-brainer` | Haiku 5.5 · low | GPT-6-Luna · low | Grok 4.7 · low |

Use the column for your session model's family. Pass the model and the effort through your harness's subagent options. If the harness cannot set one of them, or the cell is empty, keep the session's value and say so. A model the human names overrides the tier.
