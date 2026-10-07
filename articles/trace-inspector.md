---
title: "Find the span that paces your agent with a trace waterfall"
slug: "trace-inspector"
type: "tool-deep-dive"
tool_id: "trace-inspector"
tool_url: "web-apps/trace-inspector/index.html"
focus: "operate"
mode: "local"
dimensions: [OBS, REL]
tags: [observability, metrics, diagnostic]
audience: "engineer"
reading_time_min: 7
summary: "Paste an exported agentTrace and see a nested waterfall, the critical path, and token, cost, and error totals, all computed locally."
date: "2026-10-07"
prompt_version: "master-prompt-v1"
---

# Find the span that paces your agent with a trace waterfall

## TL;DR

- **Problem:** an agent run took six seconds and nobody can say which step was responsible, or whether a retry was involved.
- **Tool:** Agent Trace Inspector renders an exported `agentTrace` v1 trace as a nested waterfall, stars the critical path, and totals tokens, cost, errors, and timeouts.
- **Limitation to remember:** totals are plain sums over every span. If your exporter puts rolled-up child costs on parent spans, the cost total counts them twice.

## The problem

A support agent answers a question in about six seconds. Users say it's slow. The logs have one line per step, and each step looks fine on its own: the search took under a second, the summary took about a second. The slow part is between the lines. A page fetch hit a timeout, a retry ran, and the summary couldn't start until the retry came back.

Flat logs hide this because the delay comes from structure, not from any single slow call. To see it you need two things a log line doesn't give you: parent/child nesting (which step was waiting on which) and position in time (what ran in sequence and what overlapped). A trace waterfall shows both at once.

## The concept

A trace is a tree of **spans**. Each span is one unit of work: a plan step, a model call, a tool call, an eval. Each span has a parent, a duration, and optionally a start time. Distributed tracing systems use this same model. See the [OpenTelemetry traces overview](https://opentelemetry.io/docs/concepts/signals/traces/).

The **critical path** is the chain of spans that sets end-to-end latency. Speeding up a span that isn't on it doesn't make the run faster. The Trace Inspector uses a simple definition: starting at the root, follow the child whose own subtree has the largest summed duration, down to a leaf.

```
plan: answer question ★ ─────────────────────────────── 6.2s
├─ web_search            ███                             0.9s
├─ fetch_page ★              ██████████ timeout          3.1s
│  └─ fetch_page (retry) ★             ██                0.7s
└─ summarize                              ████           1.1s
```

The trade-off: this definition is about durations, not wall-clock overlap. It's exact for sequential agents, which most agent loops are. It's an approximation when siblings really run in parallel.

## How the tool works

Everything happens in the page. The tool:

1. **Parses** `{ spans: [...] }`, or a bare array of spans. Missing `id`s are auto-assigned, missing `status` defaults to `ok`, and a span `type` it doesn't recognize is shown as `other`. Recognized types are `llm`, `tool`, `loop`, `eval`, `handoff`, `plan`, and `act`.
2. **Assigns timing.** If any span has a `startedAt` (ISO-8601 or epoch ms), offsets are measured from the earliest span. A span without one is placed right after its nearest known ancestor. If no span has a start time, spans are laid out in tree order: a parent starts where its first child starts, and siblings run back to back.
3. **Computes the critical path** as described above and stars those rows.
4. **Totals** span count, wall-clock window, tokens in and out, `costUsd`, errors, timeouts, and a count per type.
5. **Renders** a waterfall. Bar position comes from start time and bar width from duration. Rows can be filtered by type, status, or a name/id search. Clicking a row shows the raw span JSON.

The input format is the shared `agentTrace` v1 schema, documented in `apps.json → schemas.agentTrace`:

```json
{ "id": "s2", "parent": "root", "type": "tool", "name": "fetch_page",
  "startedAt": "2026-10-01T09:00:01.200Z", "durationMs": 3100,
  "costUsd": 0.0001, "status": "timeout", "error": "read timeout after 3s" }
```

## Walkthrough: try it in 60 seconds

1. Open the [Agent Trace Inspector](https://iggym.github.io/systems-bench/web-apps/trace-inspector/index.html).
2. Replace the textarea contents with this trace (illustrative sample data):

```json
{
  "schemaVersion": 1,
  "session": "sess_demo_01",
  "workflow": "research-summary",
  "spans": [
    { "id": "root", "parent": null, "type": "plan", "name": "plan: answer question", "startedAt": "2026-10-01T09:00:00.000Z", "durationMs": 6200, "status": "ok" },
    { "id": "s1", "parent": "root", "type": "tool", "name": "web_search", "startedAt": "2026-10-01T09:00:00.200Z", "durationMs": 900, "costUsd": 0.0005, "status": "ok" },
    { "id": "s2", "parent": "root", "type": "tool", "name": "fetch_page", "startedAt": "2026-10-01T09:00:01.200Z", "durationMs": 3100, "costUsd": 0.0001, "status": "timeout", "error": "read timeout after 3s" },
    { "id": "s3", "parent": "s2", "type": "tool", "name": "fetch_page (retry)", "startedAt": "2026-10-01T09:00:04.300Z", "durationMs": 700, "costUsd": 0.0001, "status": "ok" },
    { "id": "s4", "parent": "root", "type": "llm", "name": "summarize", "startedAt": "2026-10-01T09:00:05.050Z", "durationMs": 1100, "model": "model-small", "tokensIn": 3200, "tokensOut": 400, "costUsd": 0.0021, "status": "ok" }
  ]
}
```

3. Click **Inspect Trace**.

You should see the badge `TRACE: 5 SPANS · 6.20S` and these stats: 5 spans, total 6.20s, 3,600 tokens (3,200 in / 400 out), cost $0.0028, 0 errors and 1 timeout, types `plan×1 tool×3 llm×1`. In the waterfall, `plan: answer question`, `fetch_page`, and `fetch_page (retry)` are starred. The timed-out fetch plus its retry make up 3.8s of the 6.2s run.

## Reading the results

- **Starred rows** are where to spend latency work. In the sample, a faster summarizer saves nothing that matters. A shorter fetch timeout, or a cached page, saves seconds.
- **Timeouts and errors on the critical path** are the costliest kind: you pay for the failure and for the retry that comes after it. If they show up off the path, they waste money but don't add latency.
- **`types` counts** show the agent's habits. Many `loop` or `tool` spans for a simple question point to a planning problem, not a speed problem.
- **Cost total:** before trusting it, check whether parent spans carry their own cost or a rollup (see below). Then hand the same trace to the Session Cost Attributor for a per-model and per-step breakdown.

## Limitations & honest boundaries

From the tool's registry notes: it runs entirely client-side on exported `agentTrace` JSON, with **no live ingestion**. Totals are **plain sums over all spans**, so parent spans that carry rolled-up child costs are double-counted. Unknown span types render as `other`.

Also visible in the source:

- The critical path is the longest **summed-duration** chain, which assumes children run one after another. For truly parallel fan-out, read it as "heaviest branch", not as exact wall-clock blame.
- Timing is only as accurate as the timestamps your exporter records. Without `startedAt`, layout is a reconstruction in tree order, not the real schedule.
- For high-volume, continuous tracing across services, use a real tracing backend. This tool is for inspecting one exported trace at a time.

## Where it fits

- **OBS — Observability:** makes a run's structure, timing, and cost visible from an export you already have.
- **REL — Reliability:** brings out timeouts, errors, and retry chains that sit on the latency-critical path.

Related tools:

- **Session Cost Attributor** reads the same `agentTrace` input and breaks spend down by session, model, span type, and step.
- **Decision Log Analyzer** covers the "why" behind the spans. It checks whether the agent's stated confidence matched the outcome.
- **Governance & Budget Caps** turns what you learn into a policy you can simulate, for example a per-model cap on the step that dominates.

## Taking it to production

- Emit spans with stable `id`/`parent` links and a `startedAt` on every span. The rest of the schema is optional.
- Decide whether parent spans carry **self cost** or **rolled-up cost**, document the choice, and keep it consistent.
- Export one trace per failed or slow session from your gateway and attach it to the incident ticket.
- In CI, replay a fixed eval set and fail the build if critical-path latency or the timeout count goes over a budget.
- When traces become continuous, send the same spans to an OpenTelemetry-compatible backend and keep this tool for one-off inspection.

## Further reading

- [Agent Trace Inspector (live)](https://iggym.github.io/systems-bench/web-apps/trace-inspector/index.html)
- [systems-bench repository](https://github.com/iggym/systems-bench)
- [OpenTelemetry: traces](https://opentelemetry.io/docs/concepts/signals/traces/)

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
