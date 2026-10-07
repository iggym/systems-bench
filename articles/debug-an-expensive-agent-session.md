---
title: "Debug an expensive agent session in 10 minutes"
slug: "debug-an-expensive-agent-session"
type: "workflow-recipe"
tool_id: "session-cost-attributor"
tool_url: "web-apps/session-cost-attributor/index.html"
related_tools: [trace-inspector, governance-budget-caps]
focus: "operate"
mode: "local"
dimensions: [OBS, SCL, SAF]
tags: [cost, observability, governance]
audience: "engineer"
reading_time_min: 8
summary: "A three-tool recipe: attribute spend across sessions, find the costly span in a waterfall, then rehearse a cap that would have stopped it."
date: "2026-10-07"
prompt_version: "master-prompt-v1"
---

# Debug an expensive agent session in 10 minutes

## TL;DR

- **Problem:** two sessions of the same workflow cost wildly different amounts, and the bill doesn't say why.
- **Recipe:** Session Cost Attributor (which session, model, and step?) → Agent Trace Inspector (where in the run, and did it pace latency?) → Governance & Budget Caps (what policy would have stopped it?).
- **Limitation to remember:** all three tools work only on the costs your logs contain. Missing `costUsd` counts as zero, and nothing is checked against real billing.

## The problem

A ticket-triage agent usually costs about a tenth of a cent per ticket. One ticket cost over 12 cents, more than a hundred times as much. Multiply that by a backlog and the monthly budget is gone. The provider bill shows total tokens per model, which tells you *that* the large model was busy but not *which step* in *which session* called it, or whether anything was guarding it.

## The concept

Cost debugging has the same shape as latency debugging: **attribute, localize, prevent.**

```
sessions bundle ──▶ Session Cost Attributor ──▶ "sess_spike, model-large, self-critique loop"
                                                     │
single session  ──▶ Agent Trace Inspector    ──▶ "7.4s of 9.8s, on the critical path"
                                                     │
usage log       ──▶ Governance & Budget Caps ──▶ "a $20 model cap blocks the 2nd loop"
```

The first two tools read the same `agentTrace` v1 input, so you export once and use it twice.

## Step 1: Attribute the spend

**Goal:** find which session, model, span type, and step dominate cost.

Open the [Session Cost Attributor](https://iggym.github.io/systems-bench/web-apps/session-cost-attributor/index.html), paste this bundle (illustrative), and click **Attribute Cost**:

```json
{
  "sessions": [
    { "session": "sess_ok", "workflow": "ticket-triage", "spans": [
      { "id": "a0", "parent": null, "type": "plan", "name": "triage", "durationMs": 2100, "status": "ok" },
      { "id": "a1", "parent": "a0", "type": "llm", "name": "classify", "model": "model-small", "durationMs": 500, "tokensIn": 900, "tokensOut": 30, "costUsd": 0.0003, "status": "ok" },
      { "id": "a2", "parent": "a0", "type": "llm", "name": "draft reply", "model": "model-small", "durationMs": 900, "tokensIn": 1200, "tokensOut": 250, "costUsd": 0.0006, "status": "ok" }
    ]},
    { "session": "sess_spike", "workflow": "ticket-triage", "spans": [
      { "id": "b0", "parent": null, "type": "plan", "name": "triage", "durationMs": 9800, "status": "ok" },
      { "id": "b1", "parent": "b0", "type": "llm", "name": "classify", "model": "model-small", "durationMs": 520, "tokensIn": 950, "tokensOut": 30, "costUsd": 0.0003, "status": "ok" },
      { "id": "b2", "parent": "b0", "type": "loop", "name": "self-critique loop (6 iters)", "model": "model-large", "durationMs": 7400, "tokensIn": 18000, "tokensOut": 4200, "costUsd": 0.1110, "status": "ok" },
      { "id": "b3", "parent": "b0", "type": "llm", "name": "draft reply", "model": "model-large", "durationMs": 1600, "tokensIn": 2600, "tokensOut": 380, "costUsd": 0.0140, "status": "ok" }
    ]}
  ]
}
```

**Expected output:** the badge reads `ATTRIBUTED $0.1262 · TOP MODEL 99%`. Per session: `sess_ok` $0.0009 (blended $0.3782/1M tokens) vs `sess_spike` $0.1253 (blended $4.7898/1M). By span type, `loop` alone is $0.1110. The top step is `self-critique loop (6 iters)` at $0.1110.

**Decision:** the blended $/1M figure tells you the spike came from both **more tokens** (26,160 vs 2,380) and a **pricier model mix**. The loop is the target.

## Step 2: Localize it in the run

**Goal:** see where the loop sits and whether it also hurts latency.

Open the [Agent Trace Inspector](https://iggym.github.io/systems-bench/web-apps/trace-inspector/index.html) and paste just the `sess_spike` object, `{ "session": "sess_spike", ..., "spans": [...] }`. These spans have no `startedAt`, so the tool lays them out in tree order. Click **Inspect Trace**.

**Expected output:** the badge reads `TRACE: 4 SPANS · 9.80S`, with cost $0.1253 and tokens 26,160 (21,550 in / 4,610 out). The critical path stars `triage` → `self-critique loop (6 iters)`, which is 7.40s of the 9.80s run.

**Decision:** the loop is both the cost spike and the latency spike, so capping it helps both. Also notice `draft reply` ran on `model-large` in this session but `model-small` in `sess_ok`. Check the routing rule that picked it.

## Step 3: Rehearse the guardrail

**Goal:** check that a policy would have caught this, and see when.

Open [Governance & Budget Caps](https://iggym.github.io/systems-bench/web-apps/governance-budget-caps/index.html). Put a per-model cap in the policy, for example `"per_model_caps_usd": { "model-large": 20 }`, and replay a month-to-date usage log made of `{ts, model, action, cost_usd}` events. The [Governance & Budget Caps article](governance-budget-caps.md) has a complete paste-ready example. In it, the second `self-critique loop` event gets `BLOCK_BUDGET — model cap $20 exceeded (23.50)`, and the projection flags a blowout on day 12.

**Decision:** a monthly model cap stops the *next* runaway loop, not the first one. Add a **per-session iteration or cost ceiling** for loops. That is the control that would have kept `sess_spike` near `sess_ok`'s cost.

## Reading the results together

| Question | Tool | Answer in this example |
|---|---|---|
| Which session and step cost the most? | Session Cost Attributor | `sess_spike`, `self-critique loop`, $0.1110 |
| Was it model mix or volume? | Session Cost Attributor (blended $/1M) | Both: 11× tokens, about 13× $/1M |
| Did it also drive latency? | Agent Trace Inspector | Yes: 7.4s of 9.8s, on the critical path |
| Would policy have stopped it? | Governance & Budget Caps | A model cap catches the repeat; a per-session loop limit catches the first |

## Limitations & honest boundaries

- **Session Cost Attributor:** spend attribution is calculated locally from `agentTrace` JSON logs. It doesn't connect to billing APIs or cloud cost explorers, and missing cost counts as $0.
- **Agent Trace Inspector:** totals are plain sums, so parent spans that carry rolled-up child costs are double-counted. The same applies in the Cost Attributor, where a parent span with a rolled-up cost and no `model` ends up in the `(no model / tool)` bucket. The traces above keep cost on leaf spans for this reason. The critical path assumes children run in sequence.
- **Governance & Budget Caps:** it is a policy simulator and doesn't enforce anything. Output checks are substring matches.
- All costs here are whatever your logger wrote. Reconcile against the provider invoice before making budget decisions.

## Where it fits

- **OBS — Observability:** attribution and waterfall views from one export.
- **SCL — Scale & Maintainability:** catches cost behaviors that grow with volume before they reach the bill.
- **SAF — Safety & Governance:** turns the finding into a policy you can test.

## Taking it to production

- Log `costUsd` and `model` on every leaf span, and keep parent spans at self cost only.
- Export a weekly bundle of the top-N most expensive sessions and run Step 1 on it.
- Enforce per-session loop limits (iterations or dollars) in the agent runtime, not just monthly caps.
- Alert when a session's blended $/1M rises above the workflow's normal range.
- Keep the policy JSON under version control and replay last month's log on every change.

## Further reading

- [Session Cost Attributor (live)](https://iggym.github.io/systems-bench/web-apps/session-cost-attributor/index.html)
- [Agent Trace Inspector article](trace-inspector.md) · [Governance & Budget Caps article](governance-budget-caps.md)
- [systems-bench repository](https://github.com/iggym/systems-bench)

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
