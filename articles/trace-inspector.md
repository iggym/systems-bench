---
title: Trace waterfall timelines for distributed agent work
slug: trace-inspector
tool_id: trace-inspector
tool_url: web-apps/trace-inspector/index.html
focus: operate
mode: local
dimensions: [OBS, REL]
tags: [observability, metrics, diagnostic]
audience: engineer
reading_time_min: 12
summary: Visualize agent-session spans as a waterfall timeline to spot bottlenecks, critical paths, and error cascades without shipping telemetry.
date: 2026-10-07
prompt_version: master-prompt-v1
---

# Agent Trace Inspector

## TL;DR

- **The problem:** One agent session runs dozens of nested spans (LLM calls, tool invocations, evals, handoffs). Which ones block your latency? Where did cost leak? Did an error cascade?
- **What the tool does:** Renders exported traces as a nested waterfall timeline, highlights the critical path, aggregates tokens and cost, and lets you click any span to inspect its full JSON.
- **One limitation:** This is a static renderer of exported JSON traces — not a live ingestion engine. Your system must export agentTrace v1 schema first.

---

## The problem

Your agent just finished a support-triage workflow. The session took 4.2 seconds end-to-end and cost $0.008. You need to know:

1. Which span held up the entire session — the one that, if we made it faster, the session gets faster?
2. Did we retry anything? Where?
3. Which LLM model ran, and did one dominate the cost?
4. Was there an error, and did it branch into a recovery path?

Without a waterfall view, you're reading raw JSON. With a waterfall view and critical-path highlighting, you see the flow in milliseconds.

---

## The concept

A **distributed trace** is a tree of operations (spans), each with a start time, duration, and metadata (tokens, cost, status, error). In agentic systems, a session spawns a plan span at the root, which spawns children: LLM calls, tool invocations, evals, loops, and handoffs. Some are sequential; others are parallel. Only the slowest path in each branch paces your end-to-end latency—that's the **critical path**.

**Why this matters:**
- Optimizing a non-critical span saves nothing. Find the critical path first.
- Cost ≠ latency. A cheap span can slow you if it waits on others.
- Errors and retries reshape the tree. A timeout in one branch doesn't block a sibling.

**Trade-offs:**
- Static rendering (no live ingestion): You must export traces as JSON. No streaming.
- Local-only: No external dependencies, no telemetry, no secrets exposed.
- Waterfall assumes a single session. Multi-session analysis requires the Cost Attributor.

---

## How the tool works

The Trace Inspector ingests an `agentTrace` v1 JSON object — a session ID, optional workflow name, and an array of spans. Each span carries:

```json
{
  "id": "s0",
  "parent": null,
  "type": "plan|llm|tool|loop|eval|handoff|act",
  "name": "session: support triage",
  "startedAt": "2026-08-01T10:00:00.000Z",
  "durationMs": 4200,
  "model": "gemini-2.5-flash",
  "tokensIn": 2400,
  "tokensOut": 900,
  "costUsd": 0.008,
  "status": "ok|error|timeout",
  "error": "HTTP 429 (optional)",
  "input": "...",
  "output": "...",
  "attrs": { "turns": 4 }
}
```

**What it computes:**

1. **Timing:** If `startedAt` is present (ISO-8601 or epoch ms), spans are positioned by wall-clock time. If untimed, they're laid out in DFS order. Missing `startedAt` values default to after their parent's start.

2. **Critical path:** A depth-first search finds the longest root-to-leaf chain (by duration sum). Spans on this path are highlighted with a ★ star. This is the latency bottleneck.

3. **Aggregations:** Total spans, duration, tokens (in + out), cost, error/timeout counts, and type breakdown (how many LLM calls vs. tool calls?).

4. **Nesting:** Parent-child relationships are rendered as indented rows with a left margin proportional to depth.

5. **Filtering:** You can filter by span type (llm, tool, eval, etc.), status (ok, error, timeout), and text search (by name or ID).

**Input formats accepted:**
- Bare spans array: `[{id: "s0", ...}, ...]`
- Single session: `{schemaVersion: 1, session: "...", spans: [...]}`
- Multiple sessions (for cost attributor cross-session work): `{sessions: [{session: "...", spans: [...]}, ...]}`

---

## Walkthrough: try it in 60 seconds

1. Open [Agent Trace Inspector](https://iggym.github.io/systems-bench/web-apps/trace-inspector/index.html).

2. Paste the sample trace below into the left panel (it's preloaded):

```json
{
  "schemaVersion": 1,
  "session": "sess_demo_001",
  "workflow": "support-triage",
  "spans": [
    { "id": "s0", "parent": null, "type": "plan", "name": "session: support triage", "startedAt": "2026-08-01T10:00:00.000Z", "durationMs": 4200, "tokensIn": 2400, "tokensOut": 900, "costUsd": 0.008, "status": "ok", "attrs": { "turns": 4 } },
    { "id": "s1", "parent": "s0", "type": "llm", "name": "classify intent (gemini-2.5-flash)", "startedAt": "2026-08-01T10:00:00.120Z", "durationMs": 620, "model": "gemini-2.5-flash", "tokensIn": 850, "tokensOut": 40, "costUsd": 0.0004, "status": "ok", "input": "My invoice #8832 was charged twice. Help?", "output": "{\"intent\":\"billing\",\"confidence\":0.92}" },
    { "id": "s2", "parent": "s0", "type": "tool", "name": "lookup_invoice(8832)", "startedAt": "2026-08-01T10:00:01.100Z", "durationMs": 180, "costUsd": 0.0001, "status": "ok", "attrs": { "http": 200 }, "input": "{\"id\":8832}", "output": "{\"amount\":120.00,\"status\":\"paid_twice\"}" },
    { "id": "s3", "parent": "s0", "type": "llm", "name": "draft reply (gemini-2.5-flash)", "startedAt": "2026-08-01T10:00:01.900Z", "durationMs": 880, "model": "gemini-2.5-flash", "tokensIn": 1050, "tokensOut": 210, "costUsd": 0.0009, "status": "ok", "input": "invoice data: paid twice", "output": "I see the duplicate charge; issuing a refund." },
    { "id": "s4", "parent": "s0", "type": "eval", "name": "refund eligibility check", "startedAt": "2026-08-01T10:00:02.900Z", "durationMs": 410, "model": "gemini-2.5-flash", "tokensIn": 300, "tokensOut": 30, "costUsd": 0.0002, "status": "ok", "output": "{\"eligible\":true}" },
    { "id": "s5", "parent": "s0", "type": "tool", "name": "issue_refund", "startedAt": "2026-08-01T10:00:03.400Z", "durationMs": 760, "costUsd": 0.0, "status": "error", "error": "HTTP 429 rate limited", "attrs": { "retry": 1, "http": 429 } },
    { "id": "s6", "parent": "s5", "type": "tool", "name": "issue_refund (retry)", "startedAt": "2026-08-01T10:00:04.300Z", "durationMs": 140, "costUsd": 0.0, "status": "timeout" },
    { "id": "s7", "parent": "s0", "type": "handoff", "name": "escalate to human", "startedAt": "2026-08-01T10:00:04.600Z", "durationMs": 60, "costUsd": 0.0, "status": "ok" }
  ]
}
```
(This is illustrative sample data.)

3. Click **Inspect Trace**.

4. You'll see:
   - **Top right:** Aggregated stats: 8 spans, 4.2s total, 4,190 tokens, $0.0014 cost, 0 errors, 1 timeout.
   - **Waterfall table:** Rows for each span, indented by depth. The draft reply and issue_refund bars are wide; classify intent is narrow. A ★ marks the critical path.
   - **Span detail:** Click any row (e.g., s5, the failed refund). The bottom pane shows the full JSON: `status: error`, `error: "HTTP 429 rate limited"`, and `attrs.retry: 1`.

5. In the filters, select `type: tool` to show only tool calls. You'll see the two invoice operations and the refund attempts.

**What you're looking at:**

- **Width = duration.** The draft reply took 880ms; classify intent took 620ms.
- **Indentation = nesting.** The retry (s6) is a child of the failed refund (s5), so it's indented further.
- **★ = critical path.** The draft reply → issue_refund chain is the longest, so it's highlighted.
- **Errors are dashed-red.** The issue_refund error (s5) and timeout (s6) stand out.

---

## Reading the results

**Critical path (the bottleneck):**
If the ★ marks span s3 (draft reply, 880ms), then 880ms is the minimum time you *cannot* reduce without changing the logic. Everything not on the critical path is parallelizable.

**Errors and timeouts:**
- Dashed-red bars indicate `status: error`.
- Hatched bars indicate `status: timeout`.
- Click to see the error message. Check if it's transient (429, timeout) or permanent (bad input, auth).

**Token and cost breakdown:**
Hover over the stats at top (or click a span) to see per-span tokens and cost. Sum them to verify your billing export or to spot runaway usage.

**Model mix:**
The span type breakdown shows how many llm vs. tool calls happened. The per-span `model` field tells you which model ran. Use this to answer: "How much of my bill came from Claude vs. Gemini vs. Groq?"

**Dead spans:**
Spans with no children and no error, sitting off the critical path, are optimization candidates. Move them off the critical path (parallelize them) or skip them if they're not adding value.

---

## Limitations & honest boundaries

From the tool's own `notes`:

> Runs 100% client-side. Validates and displays agentTrace v1 schema spans locally without transmitting trace telemetry to any third-party server.

**What this means:**

- **No live ingestion:** You must export your session as JSON first. This is a static viewer, not a streaming sink.
- **No network calls:** Your trace never leaves your browser.
- **Local timing only:** Timing is as recorded in your JSON. The tool does not measure anything itself—it only visualizes what you give it.
- **Single-session focus:** To compare costs across sessions, use the Session Cost Attributor instead.
- **Schema validation is permissive:** Missing `startedAt` or `durationMs`? The tool fills in defaults and continues. Invalid JSON will fail with a clear error.

**When to reach for something heavier:**

- **Live tracing:** If you need continuous ingestion, export to a backend (Datadog, Honeycomb, Jaeger) and query their dashboards.
- **Multi-tenant analytics:** This tool is per-session. A production telemetry platform spans millions of sessions.
- **Alerting:** This tool shows you past traces. For real-time alerts on latency or cost overages, wire the same spans into a monitoring system.

---

## Where it fits

**Dimensions this tool covers:**

- **OBS Observability:** The tool renders traces, calculates critical paths, and aggregates metrics (tokens, duration, cost).
- **REL Reliability:** Errors and timeouts are visually marked and filterable, helping you spot failure patterns.

**Related bench tools:**

1. **Session Cost Attributor** — steps downstream. Use Trace Inspector to understand *which* spans ran; use Cost Attributor to break down spend across sessions, models, and span types in aggregate.

2. **Decision Log Analyzer** — a complementary view. While Trace Inspector shows timing and errors, Decision Log Analyzer shows agent *reasoning* (confidence vs. outcome calibration) and hotspots.

3. **Governance & Budget Caps** — the enforcement layer. Export your traces, check them with the inspector, then define policies in Governance to cap spend or block risky actions.

**Example workflow:**
1. Session finishes. Export its agentTrace v1 JSON.
2. Paste into Trace Inspector. Spot that s6 (refund retry) timed out. Click it to see the error.
3. Ask: Why did it retry? Should we have escalated to HITL instead?
4. Export 100 sessions' traces. Paste into Session Cost Attributor to see which model incurred 60% of spend.
5. Define a policy in Governance & Budget Caps to warn when spend hits 80% of monthly budget.

---

## Taking it to production

To apply the same idea in a real system:

1. **Export from your harness:** When your agent session ends, collect all span data and emit it as agentTrace v1 JSON to a file, log, or message queue.

2. **Structure your spans:** Ensure every LLM call, tool invocation, eval, and loop has:
   - Unique `id` and parent `id`
   - Accurate `startedAt` (ISO-8601) and `durationMs`
   - Token counts and cost (from API responses)
   - `status` and optional `error` message

3. **Ingest to a tracing backend (optional):** If you need live queries, stream spans to Datadog APM, Honeycomb, or Jaeger. They'll handle scale and retention.

4. **Build a viewer or dashboard:** This bench tool is a quick visual check. A production dashboard might add:
   - Histograms of latency per span type
   - Percentile breakdowns (p50, p95, p99 latency)
   - Per-model cost trend lines
   - Alerts on critical path shifts

5. **Wire in governance checks:** Once you understand your traces, encode the same rules (budget caps, forbidden actions, retry logic) into your real gateway or agent loop.

---

## Further reading

- **[Agent Trace Inspector](https://iggym.github.io/systems-bench/web-apps/trace-inspector/index.html)** — the tool itself.
- **[systems-bench repo](https://github.com/iggym/systems-bench)** — source code, schema definitions, and other tools.
- **[OpenTelemetry Trace Spec](https://opentelemetry.io/docs/specs/otel/trace/)** — if you're exporting to a production tracing backend, read this.
- **[Distributed Systems Observability (O'Reilly)](https://www.oreilly.com/library/view/distributed-systems-observability/)** — canonical reference on instrumentation and critical-path analysis.

---

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
