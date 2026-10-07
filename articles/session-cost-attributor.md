---
title: Break down agent spend by session, model, and step type
slug: session-cost-attributor
tool_id: session-cost-attributor
tool_url: web-apps/session-cost-attributor/index.html
focus: operate
mode: local
dimensions: [OBS, SCL]
tags: [cost, observability, metrics]
audience: engineer
reading_time_min: 11
summary: Visualize cost distribution across agent sessions, models, and span types to find spend drivers and cost-optimization targets.
date: 2026-10-07
prompt_version: master-prompt-v1
---

# Session Cost Attributor

## TL;DR

- **The problem:** You ran 100 agent sessions yesterday. Total spend was $850. Which sessions cost the most? Did Gemini Pro or Groq drive the bill? Were LLM calls or tool calls more expensive?
- **What the tool does:** Ingests agentTrace v1 JSON spans, builds stacked bar charts attributing spend by session, model, and span type, calculates blended $/1M tokens, and ranks the most expensive steps.
- **One limitation:** This is local analysis of exported JSON only — it doesn't connect to billing APIs or cloud provider cost explorers, so your trace must carry cost fields from your actual invoices.

---

## The problem

Your agent platform ran 100 support-triage sessions. You have the traces (from Trace Inspector). Now you need to answer:

1. Did a few runaway sessions blow the budget, or was it distributed?
2. Which model incurred the most spend? Should we switch to a cheaper one?
3. LLM calls cost $0.50/session; tool calls cost $0.02. Which dominates?
4. Our blended rate is $0.005 per 1M tokens. Is that in line with vendor pricing?

Without attribution, you're back to raw JSON or a spreadsheet. With a visual breakdown, you spot patterns in seconds.

---

## The concept

**Cost attribution** means answering "where did my money go?" in an agent system. Costs are distributed across:

1. **Sessions:** Different workflows (triage, summary, research) have different spans.
2. **Models:** Gemini Flash is cheap; Gemini Pro or Claude is pricier. A mix of models means a mixed bill.
3. **Span types:** LLM calls, tool invocations, evals, loops, and handoffs each have different costs.
4. **Individual steps:** The top 8 most expensive steps often account for 40–60% of spend.

Why it matters:

- **Optimization ROI:** Optimizing the cheapest steps wastes effort. Focus on the top spenders.
- **Model selection:** If Gemini Flash handles 80% of your classifier calls, switching to Groq saves money.
- **Budget forecasting:** Measure $/1M tokens to extrapolate spend. If you process 1 billion tokens/month, you project your bill accurately.

Trade-offs:

- **Blended $/1M is an aggregate:** It masks inefficiencies. If you're using both Claude (expensive) and Groq (cheap), the blended rate hides the fact that you *could* use Groq more.
- **Cost fields must be accurate:** If your spans lack cost or token data, the tool's output is incomplete.
- **No cloud-provider integration:** You can't connect to AWS, GCP, or Anthropic's billing API. You must export costs from your own logs.

---

## How the tool works

The tool ingests agentTrace v1 JSON — one session, a bundle of sessions, or a bare spans array:

```json
{
  "sessions": [
    {
      "session": "sess_a",
      "workflow": "support-triage",
      "spans": [
        {
          "id": "a0",
          "parent": null,
          "type": "plan",
          "name": "triage session",
          "durationMs": 4100,
          "tokensIn": 2400,
          "tokensOut": 900,
          "costUsd": 0.0082,
          "status": "ok"
        },
        {
          "id": "a1",
          "parent": "a0",
          "type": "llm",
          "name": "classify intent",
          "model": "gemini-2.5-flash",
          "durationMs": 620,
          "tokensIn": 850,
          "tokensOut": 40,
          "costUsd": 0.0004,
          "status": "ok"
        }
      ]
    }
  ]
}
```

**What it computes:**

1. **By session:** For each session, sum its spans' costs, token counts, and error counts. Output: session name, total cost, token count, span count, error count, and blended $/1M.

2. **By model:** Aggregate all spans by their `model` field. Tool spans (which have no model) are grouped as "(no model / tool)". Output per model: total cost, span count, token count.

3. **By span type:** Aggregate all spans by `type` (llm, tool, loop, eval, handoff, plan, act). Output per type: total cost, span count.

4. **Top expensive steps:** Rank spans by name and sum their cost. Show the 8 most expensive (e.g., "classify intent" $0.18 total, "draft response" $0.30 total, etc.).

5. **Per-session detail table:** Show each session with cost, tokens, spans, errors, and blended $/1M.

6. **Blended rate:** total cost ÷ total tokens × 1e6. A blended rate of $0.003 per 1M tokens tells you: if you process 1B tokens, expect a $3k bill.

**Input formats:**

- Single session with spans: `{schemaVersion: 1, session: "...", spans: [...]}`
- Multiple sessions: `{sessions: [{session: "...", spans: [...]}, ...]}`
- Bare spans array: `[{id: "a0", ...}, ...]`

---

## Walkthrough: try it in 60 seconds

1. Open [Session Cost Attributor](https://iggym.github.io/systems-bench/web-apps/session-cost-attributor/index.html).

2. Paste the sample (preloaded) or use this:

```json
{
  "sessions": [
    {
      "session": "sess_a",
      "workflow": "support-triage",
      "spans": [
        { "id": "a0", "parent": null, "type": "plan", "name": "triage session", "durationMs": 4100, "tokensIn": 2400, "tokensOut": 900, "costUsd": 0.0082, "status": "ok" },
        { "id": "a1", "parent": "a0", "type": "llm", "name": "classify intent", "model": "gemini-2.5-flash", "durationMs": 620, "tokensIn": 850, "tokensOut": 40, "costUsd": 0.0004, "status": "ok" },
        { "id": "a2", "parent": "a0", "type": "tool", "name": "lookup_invoice(8832)", "durationMs": 180, "costUsd": 0.0001, "status": "ok" },
        { "id": "a3", "parent": "a0", "type": "llm", "name": "draft reply", "model": "gemini-2.5-pro", "durationMs": 880, "tokensIn": 1050, "tokensOut": 210, "costUsd": 0.0031, "status": "ok" },
        { "id": "a4", "parent": "a0", "type": "eval", "name": "eligibility check", "model": "gemini-2.5-flash", "durationMs": 410, "tokensIn": 300, "tokensOut": 30, "costUsd": 0.0002, "status": "ok" }
      ]
    },
    {
      "session": "sess_b",
      "workflow": "support-triage",
      "spans": [
        { "id": "b0", "parent": null, "type": "plan", "name": "triage session", "durationMs": 5200, "tokensIn": 3100, "tokensOut": 1400, "costUsd": 0.0118, "status": "ok" },
        { "id": "b1", "parent": "b0", "type": "llm", "name": "classify intent", "model": "gemini-2.5-pro", "durationMs": 750, "tokensIn": 900, "tokensOut": 55, "costUsd": 0.0015, "status": "ok" },
        { "id": "b2", "parent": "b0", "type": "tool", "name": "lookup_invoice(8832)", "durationMs": 190, "costUsd": 0.0001, "status": "ok" },
        { "id": "b3", "parent": "b0", "type": "tool", "name": "issue_refund", "durationMs": 760, "costUsd": 0.0000, "status": "error", "error": "HTTP 429" },
        { "id": "b4", "parent": "b0", "type": "llm", "name": "draft reply", "model": "groq-llama-3.3-70b", "durationMs": 510, "tokensIn": 1500, "tokensOut": 620, "costUsd": 0.0014, "status": "ok" }
      ]
    },
    {
      "session": "sess_c",
      "workflow": "research-summary",
      "spans": [
        { "id": "c0", "parent": null, "type": "plan", "name": "summary session", "durationMs": 8300, "tokensIn": 9800, "tokensOut": 2400, "costUsd": 0.0401, "status": "ok" },
        { "id": "c1", "parent": "c0", "type": "llm", "name": "ingest doc (chunk 1/3)", "model": "gemini-2.5-pro", "durationMs": 2100, "tokensIn": 5200, "tokensOut": 400, "costUsd": 0.0089, "status": "ok" },
        { "id": "c2", "parent": "c0", "type": "loop", "name": "summary loop (3 iters)", "durationMs": 3600, "tokensIn": 3800, "tokensOut": 1700, "costUsd": 0.0094, "status": "ok" },
        { "id": "c3", "parent": "c0", "type": "tool", "name": "search_index(topics)", "durationMs": 240, "costUsd": 0.0002, "status": "ok" }
      ]
    }
  ]
}
```
(Illustrative sample data: 3 sessions, 14 spans, spanning triage and research workflows.)

3. Click **Attribute Cost**.

4. You'll see:
   - **Stats:** 3 sessions, 14 spans, $0.0601 total, 18,650 tokens, blended $0.00322/1M, 0 errors.
   - **By session:** sess_a $0.0120, sess_b $0.0148, sess_c $0.0401 (research is expensive).
   - **By model:** gemini-2.5-pro $0.0148 (highest), gemini-2.5-flash $0.0006, groq-llama $0.0014, (no model / tool) $0.0004.
   - **By span type:** plan $0.0601 (the rollup), llm $0.0154, tool $0.0004, loop $0.0094, eval $0.0002.
   - **Top 8 steps by cost:** "summary session" $0.0401, "summary loop" $0.0094, "ingest doc" $0.0089, "draft reply" (b4) $0.0014, etc.
   - **Per-session table:** sess_a $0.0120 / 4,190 tokens / 5 spans, etc.

**What you're reading:**

- **sess_c is expensive:** $0.0401 (67% of total spend). Why? It's a research workflow with longer context ("ingest doc"). Optimization potential: batch documents, use a cheaper model for indexing, or cache results.
- **gemini-2.5-pro is the costliest model:** $0.0148 of $0.0601 (25% of spend). If you switched those calls to Groq, estimate 10–20× savings.
- **LLM calls are the spend driver:** plan ($0.0601, a rollup) and llm ($0.0154) dominate. Span type "tool" ($0.0004) is negligible.
- **"summary session" alone is $0.0401:** This single span (the plan root) accounts for 67% of cost. In production, you'd drill into its children to see which sub-step consumed most.

---

## Reading the results

**By session:**

- Sessions with high cost and low token count are efficient.
- Sessions with high cost and high token count are expensive. Investigate which steps consumed most tokens.
- Blended $/1M varies by session: triage might be $0.002/1M (cheap classifier + tool calls), research $0.004/1M (long context, expensive model).

**By model:**

- If one model dominates (>50% of spend), switching is high ROI.
- If you're using multiple models, measure latency and accuracy per model. You might trade accuracy for cost.

**By span type:**

- LLM calls are usually the spend driver (each call can cost $0.01+).
- Tool calls are often free or $0.0001–$0.0005 (no token costs).
- Evals and loops are hidden spend. A loop running 10 iterations of a 1000-token model call = $0.10 per session.

**Top expensive steps:**

- These 8 steps are your optimization targets. A 10% speedup or cost reduction on the top 2 saves the most.
- Expensive steps often repeat. If "classify intent" runs 450 times at $0.0004 each = $0.18 total, optimizing it (or caching) has high leverage.

---

## Limitations & honest boundaries

From the tool's own `notes`:

> Calculates spend attribution locally from agentTrace JSON logs. Does not connect to billing APIs or cloud provider cost explorers.

**What this means:**

- **Cost fields are gospel:** If your span's `costUsd` is wrong (didn't account for tokens, used stale pricing), the output is wrong.
- **Token counts must be accurate:** If spans lack `tokensIn` and `tokensOut`, the blended $/1M is incomplete.
- **No real-time billing:** This tool is retrospective. You can't use it to forecast tomorrow's spend based on today's run rate without external monitoring.
- **No cloud-provider integration:** You can't pull actual invoice data, live pricing, or reserved-instance discounts.
- **Single-view aggregation:** This tool shows totals and top-8 ranked steps. It doesn't show distributions (e.g., "90% of spans cost $0.0001–$0.0005, but 1% cost $0.01+").

**When to reach for something heavier:**

- **Production cost tracking:** Use a FinOps platform (CloudZero, Vantage, Harness) for live billing alerts and cloud-provider integrations.
- **Trend analysis:** If you need month-over-month cost trends, feed traces to BigQuery, Snowflake, or Elasticsearch and build dashboards.
- **Multi-tenant accounting:** If you bill customers per session, move this logic to a production system with tiered pricing and per-customer reports.

---

## Where it fits

**Dimensions this tool covers:**

- **OBS Observability:** Cost attribution is a form of observability—it exposes spending patterns transparently.
- **SCL Scale & Maintainability:** Cost is a scaling concern. As you scale agent sessions, cost compounds; attribution helps you predict and control it.

**Related bench tools:**

1. **Agent Trace Inspector** — a prerequisite. Use Trace Inspector to understand *which* spans ran; use Cost Attributor to see which ones cost the most.

2. **Governance & Budget Caps** — the enforcement layer. After you understand spend patterns, define policies (per-model caps, monthly budgets) and test them in Governance & Budget Caps.

3. **Systems Latency & Capacity Profiler** — complementary. While Cost Attributor answers "what did we spend?", the profiler answers "what can we scale to?" Both inform infrastructure decisions.

**Example workflow:**
1. Export 1 week of agent traces (all sessions).
2. Paste into Session Cost Attributor. Notice that research workflows cost 3× triage. Identify the top 8 expensive steps.
3. In Trace Inspector, open a research session and drill into the "ingest doc" step. See that it uses gemini-2.5-pro.
4. Switch to Gemini Flash for ingest, Pro only for summarization. Estimate 40% cost savings.
5. Re-run the workflow, export traces, re-analyze Cost Attributor. Confirm the savings.

---

## Taking it to production

To apply the same idea in a real system:

1. **Instrument every span with cost:** After an LLM call, record the actual cost from the API response (token count × pricing rate). For tools, fetch cost from your billing system or measure SLA credits.

2. **Batch traces:** Collect spans from all sessions into a single file or message. Append to a data warehouse (BigQuery, Snowflake, Athena).

3. **Build cost dashboards:** Query your warehouse to compute:
   - Cost by session, model, span type, actor (agent vs. tool).
   - Percentile breakdowns (p50, p95, p99 cost per session).
   - Trend lines (daily/weekly cost over time).

4. **Set budgets and alerts:** Define per-model caps and monthly budgets. Alert when a session exceeds a threshold (e.g., session costs >$1 or workflow costs >$10/day).

5. **Tie to governance:** Feed cost signals into your gateway. If a session exceeds budget, enforce rate limits or escalate to HITL.

---

## Further reading

- **[Session Cost Attributor](https://iggym.github.io/systems-bench/web-apps/session-cost-attributor/index.html)** — the tool itself.
- **[systems-bench repo](https://github.com/iggym/systems-bench)** — schema definitions and other tools.
- **[OpenTelemetry Metrics](https://opentelemetry.io/docs/specs/otel/metrics/)** — if you're exporting metrics to a backend, read this.
- **[Cost Modeling for Generative AI (A16Z)](https://a16zcrypto.com/posts/article/cost-modeling-for-generative-ai-services/)** — strategic reference on AI cost structures.

---

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
