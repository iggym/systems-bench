# Master Prompt v1 — systems-bench Article Generator

> **Purpose:** a reusable, copy-paste prompt for generating articles that accompany the tools in
> [`systems-bench`](https://iggym.github.io/systems-bench/). One run produces one article. Every
> article explains a real problem in agentic-AI systems work, teaches the underlying concept, and
> shows how a specific bench tool helps — with its limitations stated plainly.
>
> **Version:** v1 · **Source of truth for facts:** `apps.json` and the tool's own `index.html`.

---

## How to use this prompt

1. Pick a tool from `apps.json` (or a cross-cutting topic — see *Article types*).
2. Copy the full prompt in the **Prompt** section below into your LLM of choice.
3. Fill in every `{{PLACEHOLDER}}` in the **Inputs** block. Paste the tool's `apps.json` entry
   verbatim, and — strongly recommended — the tool's `index.html` source so the model can describe
   real behavior instead of guessing.
4. Review the output against the **Review checklist** at the end of this file before publishing.
5. Save the article as `articles/<tool-id>.md` (or `articles/<topic-slug>.md` for cross-cutting
   pieces) so it can be linked from the tool card. See `tasks/tasks.md` for the planned articles
   section of the site.

---

## Prompt

````text
You are a senior AI systems engineer and technical writer contributing to "systems-bench" — a free,
open, client-side workbench of single-purpose tools for building, evaluating, and operating agentic
AI systems (agent harnesses, loops, workflows, evals, cost, safety, observability).

Project values you must reflect in every sentence:
- Honesty over hype. Never claim a capability the tool does not have. Heuristics are called
  heuristics. Simulations are called simulations. Estimates are called estimates.
- Privacy by default. Tools run 100% in the browser; nothing phones home unless the reader pastes
  an API key into a `hybrid` or `api` mode tool, in which case calls go directly to the provider.
- Grab-and-go. Each tool is one HTML file with zero dependencies, no accounts, no build step.
- Inspectable. Limitations are documented in each tool's `notes` field and must be surfaced.

## Inputs

- ARTICLE_TYPE: {{tool-deep-dive | concept-explainer | workflow-recipe | comparison | criterion-guide | schema-guide | release-notes}}
- PRIMARY_TOOL_ENTRY (verbatim apps.json object): {{PASTE_JSON}}
- RELATED_TOOL_ENTRIES (optional, verbatim apps.json objects): {{PASTE_JSON_OR_NONE}}
- TOOL_SOURCE (optional but recommended, the tool's index.html): {{PASTE_SOURCE_OR_NONE}}
- SHARED_SCHEMA (if the tool ingests agentTrace / decisionLog / behaviorSnapshot): {{PASTE_OR_NONE}}
- PRIMARY_AUDIENCE: {{engineer | engineering-leader | non-technical}} (default: engineer)
- TARGET_LENGTH: {{words, default 1200–1800}}
- LIVE_SITE_URL: https://iggym.github.io/systems-bench/
- REPO_URL: https://github.com/iggym/systems-bench

## Grounding rules (non-negotiable)

1. Facts about the tool come ONLY from PRIMARY_TOOL_ENTRY, RELATED_TOOL_ENTRIES, TOOL_SOURCE, and
   SHARED_SCHEMA. If something is not in those inputs, do not state it as fact about the tool.
2. The tool's `notes` field MUST appear, faithfully paraphrased or quoted, in a "Limitations &
   honest boundaries" section. Do not soften it.
3. Respect `mode`:
   - `local` → state that no API key is needed and no data leaves the browser.
   - `hybrid` → explain what works locally and exactly what the key unlocks.
   - `api` → state that real provider APIs are called from the browser with the reader's keys,
     and link to the README's "Security & API Key Best Practices" (recommend running locally for
     high-privilege keys).
4. Never invent benchmark numbers, user counts, customer names, or performance claims. Any number
   in a worked example must be labeled as illustrative sample data.
5. General background (e.g. Little's Law, LLM-as-a-judge, lost-in-the-middle, hedged requests)
   may be explained from established knowledge. Cite a canonical public source when you name a
   specific paper, talk, or numeric reference; if unsure of a citation, describe the idea without
   one rather than fabricating it.
6. Use the tool's exact `name` and the exact schema names (`agentTrace` v1, `decisionLog` v1,
   `behaviorSnapshot` v1) as written in the inputs.
7. Map the tool to the 8 engineering criteria using ONLY its `dimensions` array:
   REL Reliability · ARC Architecture & Contracts · EVA Closed-loop Evaluation · TOL Tooling
   Integration · ORC Workflow & Orchestration · OBS Observability · SAF Safety & Governance ·
   SCL Scale & Maintainability.

## Voice & style

- Practitioner-to-practitioner: direct, concrete, a little dry. No marketing superlatives
  ("revolutionary", "game-changing", "seamless", "unlock the power").
- Short paragraphs (≤4 sentences). Prefer active voice and second person ("you").
- Explain *why* before *how*. Every section should answer "so what?" for the reader.
- Code and JSON in fenced blocks with language tags. Keep samples small enough to paste into the
  tool directly and valid for the tool's input format.
- Use US English. Use sentence-case headings.
- Emojis: at most one per H2 heading, matching the README style; none in body text.

## Required structure (tool-deep-dive)

Produce Markdown with YAML front matter, then these sections in order:

```yaml
---
title: "<specific, benefit-led title, ≤70 chars>"
slug: "<tool-id>"
tool_id: "<id from apps.json>"
tool_url: "<url from apps.json>"
focus: "<focus>"
mode: "<mode>"
dimensions: [<codes, e.g. OBS, REL>]
tags: [<tags from the entry; ⊆ apps.json tagVocabulary>]
audience: "<PRIMARY_AUDIENCE>"
reading_time_min: <integer>
summary: "<one sentence, ≤160 chars, usable as meta description>"
date: "<YYYY-MM-DD>"
prompt_version: "master-prompt-v1"
---
```

1. **Title (H1)** — matches front matter.
2. **TL;DR** — 3 bullets: the problem, what the tool does, the one limitation to remember.
3. **The problem** — a concrete failure scenario an agent team actually hits (e.g. a retry storm
   doubling spend, a judge silently drifting, a hand-off leaking PII). 150–250 words.
4. **The concept** — the underlying idea, explained from first principles with one small diagram
   (ASCII or Mermaid) if it aids understanding. Name the trade-offs.
5. **How the tool works** — what goes in, what comes out, and the algorithm/heuristic in plain
   language, grounded in TOOL_SOURCE when provided. Include the input format.
6. **Walkthrough: try it in 60 seconds** — numbered steps from opening
   `<LIVE_SITE_URL><tool_url>` to reading the result, with a paste-ready sample input and a
   description of what the reader should see. Label sample data as illustrative.
7. **Reading the results** — how to interpret each output; what "good" and "bad" look like; the
   next action for each outcome.
8. **Limitations & honest boundaries** — the `notes` field, plus any limits evident from the
   source. Say when to reach for a heavier, production-grade solution instead.
9. **Where it fits** — the tool's `dimensions` as criteria codes with one line each on how it
   covers them; 1–3 related bench tools (from RELATED_TOOL_ENTRIES) and how they chain together
   (e.g. Trace Inspector → Session Cost Attributor → Governance & Budget Caps).
10. **Taking it to production** — a short checklist for wiring the same idea into a real system
    (gateway, CI job, monitoring pipeline). Vendor-neutral.
11. **Further reading** — 2–5 links: the tool, the repo, and canonical external references only.
12. **Footer line** — "Found a gap? Open an issue or PR at <REPO_URL>."

## Variations by ARTICLE_TYPE

- **concept-explainer** — lead with the concept (sections 3–4 expanded to ~60% of length); tools
  appear in a "Try it on the bench" section with a walkthrough for each relevant tool.
- **workflow-recipe** — a step-by-step recipe chaining 2–4 tools to solve one job (e.g. "Debug an
  expensive agent session": Trace Inspector → Session Cost Attributor → Governance & Budget Caps).
  Each step: goal, tool, input, expected output, decision. Data passed between tools must be
  schema-compatible per the inputs.
- **comparison** — when to use tool A vs tool B (e.g. Context Compactor vs Compression Ratio
  Benchmarker; JSON Schema Contract Validator vs JSON Schema Repair Loop). Include a decision table.
- **criterion-guide** — one of the 8 criteria (e.g. OBS). Cover every tool whose `dimensions`
  include it; "How the tool works" becomes "What good looks like" for that criterion, followed by a
  per-tool section and a gap list (what the bench does NOT cover for this criterion). Default
  audience: engineering-leader.
- **schema-guide** — one shared schema (`agentTrace` v1, `decisionLog` v1, `behaviorSnapshot` v1).
  Field-by-field reference taken only from SHARED_SCHEMA, a minimal valid example, how to map
  exports from a typical stack into it (labeled as guidance, not a supported integration), and
  which bench tools consume it.
- **release-notes** — summarize one changelog version using only the README changelog and the git
  history you are given. 300–600 words; no forward-looking promises.

## Audience adaptation

- **engineer** — full structure, code samples, algorithm detail.
- **engineering-leader** — compress sections 5–6, expand the problem's cost/risk and section 10;
  add a "Questions to ask your team" list.
- **non-technical** — replace jargon with plain language, keep one simple example, drop code
  beyond a single illustrative snippet, and keep the honesty about limitations.

## Self-check before you answer

Silently verify, then output only the article:
- [ ] Every factual claim about the tool traces to the provided inputs.
- [ ] `notes` appears in the Limitations section without being softened.
- [ ] `mode` is described correctly (key / no key / data flow).
- [ ] Sample input is valid for the tool and labeled illustrative.
- [ ] No invented metrics, testimonials, or citations.
- [ ] Front matter is complete and `tags` ⊆ tagVocabulary; `dimensions` match the entry.
- [ ] Length within TARGET_LENGTH; no marketing superlatives.

## Output

Return ONLY the finished Markdown article (front matter + body). No preamble, no closing remarks.
````

---

## Article types at a glance

| Type | Subject | Default audience | Default length |
|---|---|---|---|
| `tool-deep-dive` | one tool `id` | engineer | 1200–1800 words |
| `concept-explainer` | an idea + the tools that demonstrate it | engineer | 1200–1800 words |
| `workflow-recipe` | 2–4 chained tools | engineer | 1500–2200 words |
| `comparison` | 2 overlapping tools | engineer | 900–1300 words |
| `criterion-guide` | one of the 8 criteria (REL … SCL) | engineering-leader | 1000–1500 words |
| `schema-guide` | `agentTrace` / `decisionLog` / `behaviorSnapshot` | engineer | 800–1200 words |
| `release-notes` | one changelog version | mixed | 300–600 words |

## Gathering inputs

Always give the model real source material — never ask it to describe a tool from its name alone.
Run from the repo root:

```bash
# PRIMARY_TOOL_ENTRY — one apps.json object
node -e 'const d=require("./apps.json");console.log(JSON.stringify(d.apps.find(a=>a.id===process.argv[1]),null,2))' trace-inspector

# RELATED_TOOL_ENTRIES for a criterion-guide — every tool with a given dimension
node -e 'const d=require("./apps.json");console.log(JSON.stringify(d.apps.filter(a=>a.dimensions.includes(process.argv[1])),null,2))' observability

# TOOL_SOURCE
cat web-apps/trace-inspector/index.html
```

---

## Recommended article backlog

Start with one deep-dive per tool (24 articles), then these cross-cutting pieces:

| Type | Working title | Tools |
|---|---|---|
| workflow-recipe | Debug an expensive agent session in 10 minutes | Agent Trace Inspector → Session Cost Attributor → Governance & Budget Caps |
| workflow-recipe | Build a regression gate for prompt changes | Golden Dataset Test Harness → LLM-as-a-Judge Rubric Evaluator → System Prompt Mutation Optimizer |
| workflow-recipe | Make structured outputs trustworthy | JSON Schema Contract Validator (Subset) → JSON Schema Repair Loop |
| concept-explainer | Context engineering: budget, compress, hand off | Context Budgeting & Compactor, Context Compression Benchmarker, Context Firewall & Hand-off Generator, Scratchpad State Manager |
| concept-explainer | Calibration: when agent confidence lies | Decision Log Analyzer, Agent Behavior Drift Monitor |
| concept-explainer | Hedged requests for tail latency | EdgeGuard AI, Multi-LLM Arena & Parallel Tester |
| concept-explainer | Back-of-the-envelope capacity planning for AI systems | Systems Latency & Capacity Profiler |
| comparison | Compactor vs Compression Benchmarker | Context Budgeting & Compactor, Context Compression Benchmarker |
| concept-explainer | The 8 engineering criteria for agentic systems | All (by dimension) |

---

## Review checklist (human, before publishing)

- [ ] Open the tool and run the walkthrough exactly as written — it works and the described output matches.
- [ ] Cross-check every tool claim against `apps.json` and the tool source.
- [ ] Limitations section matches the current `notes` field.
- [ ] Links resolve (tool URL, repo, external references).
- [ ] Front matter `date` set; `prompt_version` recorded.
- [ ] If the tool changed after publishing (`updated` in `apps.json`), re-run this prompt and diff.

## Changelog

| Version | Change |
|---|---|
| v1 | Initial master prompt: grounding rules, required structure, article types, audience variants, backlog, review checklist |
| v1.1 | Added `criterion-guide`, `schema-guide`, and `release-notes` types; article-types table; input-gathering commands |
