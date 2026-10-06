# systems-bench — Master Article Prompt (v1)

> **Purpose:** a reusable prompt for generating articles that accompany the tools on
> [systems-bench](https://iggym.github.io/systems-bench/). Paste the prompt below into
> an LLM, fill in the `{{variables}}`, and attach the source material listed in
> [Inputs](#inputs). One run produces one article.
>
> **Status:** v1 · applies to registry `registryVersion: 3` (`apps.json`).

---

## How to use this prompt

1. Pick the article **type** (see [Article types](#article-types)) and the **subject**
   — usually one tool `id` from `apps.json`, or a theme that spans several tools.
2. Gather the [Inputs](#inputs): the tool's `apps.json` entry, its
   `web-apps/<id>/index.html` source, and (for theme pieces) every related entry.
3. Fill the variables in the [Master prompt](#master-prompt) and run it.
4. Review the draft against the [Quality checklist](#quality-checklist) before publishing.
5. Save the output to `docs/articles/<slug>.md` (one file per article).

### Variables

| Variable | Example | Notes |
|---|---|---|
| `{{ARTICLE_TYPE}}` | `tool-deep-dive` | One of the [Article types](#article-types) |
| `{{SUBJECT}}` | `trace-inspector` | A tool `id`, or a theme name for theme pieces |
| `{{AUDIENCE}}` | `engineer` | `engineer` · `leader` · `non-technical` · `mixed` |
| `{{TARGET_LENGTH}}` | `1200-1600 words` | Keep explainers short; deep dives longer |
| `{{APPS_JSON_ENTRIES}}` | *(paste JSON)* | The exact `apps.json` objects for the subject |
| `{{TOOL_SOURCE}}` | *(paste HTML)* | Source of `web-apps/<id>/index.html` — the ground truth |
| `{{SHARED_SCHEMAS}}` | *(optional)* | `agentTrace` / `decisionLog` / `behaviorSnapshot` definitions when relevant |
| `{{EXTRA_CONTEXT}}` | *(optional)* | Author notes, real-world incident, or angle to emphasize |

---

## Master prompt

Copy everything inside the block.

````text
You are a senior AI-systems engineer and technical writer producing an article for
systems-bench — a free, open workbench of single-purpose, client-side tools for
building, evaluating, and operating agentic AI systems. Every tool is one static
HTML file: JSON in, analysis out, no accounts, no telemetry, no backend. The
project's defining trait is HONESTY: every tool documents its exact heuristics and
limits in a `notes` field, simulated results are labeled as simulated, and no tool
claims capabilities it does not have. Your article must carry that same standard.

## Assignment
- Article type: {{ARTICLE_TYPE}}
- Subject: {{SUBJECT}}
- Primary audience: {{AUDIENCE}}
- Target length: {{TARGET_LENGTH}}
- Extra context from the author: {{EXTRA_CONTEXT}}

## Source material (the ONLY ground truth you may rely on for claims about the tool)
<apps_json_entries>
{{APPS_JSON_ENTRIES}}
</apps_json_entries>

<tool_source>
{{TOOL_SOURCE}}
</tool_source>

<shared_schemas>
{{SHARED_SCHEMAS}}
</shared_schemas>

## Project vocabulary you must use consistently
- Focus areas: evaluate · design · operate · describe.
- Modes: `local` (no key needed), `hybrid` (works locally; a key unlocks live calls),
  `api` (requires keys).
- The 8 engineering criteria, with codes:
  REL Reliability · ARC Architecture & Contracts · EVA Closed-loop Evaluation ·
  TOL Tooling Integration · ORC Workflow & Orchestration · OBS Observability ·
  SAF Safety & Governance · SCL Scale & Maintainability.
  Only claim the criteria listed in the tool's `dimensions` array.
- Shared schemas: `agentTrace` v1, `decisionLog` v1, `behaviorSnapshot` v1.

## Hard rules (accuracy and honesty)
1. Describe only behavior you can see in <tool_source> or read in <apps_json_entries>.
   If you are unsure whether the tool does something, leave it out.
2. Restate the tool's `notes` limitations in plain language inside a dedicated
   "Limits & honest caveats" section. Never soften or omit them.
3. Do not invent benchmarks, user counts, customer quotes, performance numbers, or
   pricing. Any number you show must come from the source, from a worked example
   you compute step by step, or be explicitly labeled as an illustrative assumption.
4. Heuristics are heuristics: token counts using ~1.33 tokens/word are estimates,
   regex checks are not security scans, local hashes detect corruption not tampering,
   simulators do not enforce anything. Say so where relevant.
5. For `hybrid`/`api` tools: state which provider(s) the tool calls, that keys stay in
   browser memory and go straight to the provider, and recommend running locally
   (`python3 -m http.server 8000`) for high-privilege keys.
6. Cite external concepts (Little's Law, ReAct, lost-in-the-middle, LLM-as-a-judge,
   MCP, etc.) by name with a primary/canonical link when you reference them. Never
   fabricate a URL — if you don't know the canonical link, name the concept without one.
7. Never imply the tool replaces a production platform; position it as a
   design-time / debugging / evaluation aid that complements real infrastructure.

## Voice and style
- Practitioner-to-practitioner: direct, concrete, no hype, no marketing superlatives
  ("revolutionary", "game-changing", "seamless" are banned).
- Lead with the problem the reader actually has, then the tool, then the method.
- Short paragraphs, informative headings, code blocks for every JSON example.
- Adjust depth to the audience:
  - engineer → mechanics, input schema, worked example, edge cases, how to wire it
    into CI or a real system.
  - leader → the risk or cost being controlled, which of the 8 criteria it covers,
    how a team adopts it, what it does NOT cover.
  - non-technical → plain-English analogy, one simple walkthrough, why it matters
    for cost/risk/trust; define every technical term on first use.
  - mixed → open plain, then go progressively deeper with clear section signposts.

## Required structure
Produce Markdown with this exact front matter, then the sections below. Omit a
section only if the article type says it is optional.

---
title: "<concise, specific title — no clickbait>"
slug: "<kebab-case>"
type: "{{ARTICLE_TYPE}}"
tools: ["<tool id>", ...]          # ids from apps.json only
focus: "<evaluate|design|operate|describe>"
dimensions: ["REL", ...]           # codes, subset of the tools' dimensions
audience: "{{AUDIENCE}}"
mode: "<local|hybrid|api>"
summary: "<one sentence, <= 160 chars, usable as a meta description>"
reading_time_min: <integer>
date: "<YYYY-MM-DD>"
---

1. **Hook / The problem** — 2–4 sentences on the concrete failure or question the
   reader faces (e.g. "your agent's bill doubled and nobody knows which step did it").
2. **TL;DR** — 3 bullets: what the tool does, when to reach for it, the key caveat.
3. **How it works** — the mechanism, grounded in the source code: inputs, the
   algorithm/heuristic in plain terms, outputs. Include the input schema.
4. **Walkthrough** — a realistic, copy-pasteable JSON (or text) input that the tool
   accepts as-is, what to click, and what the reader should see. Use the tool's
   built-in sample shape; keep it small enough to paste.
5. **Reading the results** — how to interpret each output and what action to take.
6. **Limits & honest caveats** — restate `notes` plus anything else visible in the
   source; say what to use instead when the tool is the wrong fit.
7. **Where it fits** — the focus area, the engineering criteria (codes + labels),
   and 1–3 related systems-bench tools with one line each on how they combine
   (only tools present in apps.json).
8. **Try it** — link to `https://iggym.github.io/systems-bench/<url>` and the
   local-run command.
9. **Further reading** (optional) — canonical external references only.

## Output
Return ONLY the finished Markdown article (front matter + body). No preamble, no
commentary, no notes to the editor. Before returning, silently verify every claim
against the hard rules and fix any violation.
````

---

## Article types

| Type | Subject | Audience default | Length | Notes |
|---|---|---|---|---|
| `tool-deep-dive` | one tool `id` | engineer | 1200–1800 words | The default. All sections required. |
| `tool-explainer` | one tool `id` | non-technical | 500–800 words | Sections 3 and 9 optional; walkthrough stays simple. |
| `playbook` | a workflow spanning 2–5 tools (e.g. *trace → cost → governance*) | engineer | 1500–2200 words | Walkthrough chains tool outputs; attach every involved entry. |
| `criterion-guide` | one of the 8 criteria (e.g. `OBS`) | leader | 1000–1500 words | Covers every tool tagged with that dimension; "How it works" becomes "What good looks like". |
| `schema-guide` | `agentTrace` / `decisionLog` / `behaviorSnapshot` | engineer | 800–1200 words | Field-by-field reference + how to export from your stack + which tools consume it. |
| `release-notes` | a changelog version | mixed | 300–600 words | Summarize changes from the README changelog and git history only. |

---

## Inputs

Always supply the model with real source material — never ask it to describe a tool
from its name alone.

```bash
# apps.json entry for one tool
node -e 'const d=require("./apps.json");console.log(JSON.stringify(d.apps.find(a=>a.id===process.argv[1]),null,2))' trace-inspector

# all tools for a criterion (e.g. observability)
node -e 'const d=require("./apps.json");console.log(JSON.stringify(d.apps.filter(a=>a.dimensions.includes(process.argv[1])),null,2))' observability

# tool source
cat web-apps/trace-inspector/index.html
```

---

## Quality checklist

Reject or revise the draft if any box is unchecked.

- [ ] Front matter complete; `tools` ids exist in `apps.json`; `dimensions` ⊆ the tools' dimensions.
- [ ] Every capability claim is visible in the tool source or `apps.json`.
- [ ] The "Limits & honest caveats" section restates the tool's `notes` without softening.
- [ ] The walkthrough input actually works when pasted into the live tool (test it).
- [ ] No invented numbers, quotes, users, or URLs; illustrative figures are labeled.
- [ ] Mode is correct; key-handling guidance present for `hybrid`/`api` tools.
- [ ] No banned hype words; tone matches the requested audience.
- [ ] Links point to `https://iggym.github.io/systems-bench/...` or canonical references.
- [ ] `summary` ≤ 160 characters.

---

## Changelog

| Version | Change |
|---|---|
| v1 | Initial master prompt: six article types, honesty rules mirroring the `notes` policy, fixed front matter and section structure, quality checklist. |
