---
title: "Rehearse agent guardrails before they touch production"
slug: "governance-budget-caps"
type: "tool-deep-dive"
tool_id: "governance-budget-caps"
tool_url: "web-apps/governance-budget-caps/index.html"
focus: "operate"
mode: "local"
dimensions: [SAF, SCL, TOL]
tags: [safety, governance, cost]
audience: "engineer"
reading_time_min: 7
summary: "Replay an agent's action log against a budget, per-model caps, forbidden actions, HITL triggers, and output rules to see each verdict."
date: "2026-10-07"
prompt_version: "master-prompt-v1"
---

# Rehearse agent guardrails before they touch production

## TL;DR

- **Problem:** guardrail policies are usually written as prose and enforced in code nobody has tested against real traffic.
- **Tool:** Governance & Budget Caps replays a usage log against a JSON policy and gives every event a verdict (ALLOW, WARN, HITL, BLOCK, BLOCK_BUDGET), plus a month-end spend projection.
- **Limitation to remember:** it is a simulator. It doesn't enforce anything. You still have to wire the same rules into your real gateway.

## The problem

A team agrees on rules for its support agent: stay under $50 a month, never let the expensive model spend more than $20, get a human to approve refunds over $100, and never let a reply contain an API key. Two weeks later the bill is on pace to nearly triple. The rules existed, but nobody had checked the order they ran in, which events would have tripped them, or how early the overrun was visible.

Rules that interact (budget vs. per-model cap, HITL vs. block) behave in ways that are hard to reason about on paper. The cheap way to find out is to replay a real log through them before turning enforcement on.

## The concept

Agent governance usually combines four kinds of control:

- **Hard blocks** on actions that must never happen, like destructive SQL or `rm -rf`.
- **Human-in-the-loop (HITL) escalation** for actions that are allowed but risky.
- **Spend limits**, both a total budget and caps per model.
- **Output validation**, meaning shape and content checks on what the agent returns.

What makes a policy usable is the **precedence order**: when one event matches several rules, which one wins? This tool fixes the order and shows it, so you can see whether a dangerous action could ever slip through as a budget warning.

## How the tool works

You provide a policy and an event log. Both are JSON. For each event, in order:

1. If `action` matches any `forbidden_actions` regex: **BLOCK**.
2. Otherwise, if it matches a `hitl_triggers` regex: **HITL**.
3. Otherwise, if `output` is present and fails `output_validation`: **BLOCK**. The check fails when a `required_keys` string is missing from the output, or a `must_not_contain` string is present.
4. Otherwise, if this event pushes the model past its `per_model_caps_usd` entry, or pushes total spend past `monthly_budget_usd`: **BLOCK_BUDGET**.
5. Otherwise, if spend goes past `warn_at_pct` of the budget: **WARN**.
6. Otherwise: **ALLOW**.

All regexes are case-insensitive. Every event's `cost_usd` is added to the running totals whatever its verdict. The log is treated as a record of spend that already happened.

The projection treats `billing_day_of_month` as "days elapsed in this cycle". Burn rate is spend ÷ days elapsed, projected month-end is burn × `days_in_cycle`, and the blowout day is ⌈budget ÷ burn⌉.

## Walkthrough: try it in 60 seconds

1. Open [Governance & Budget Caps](https://iggym.github.io/systems-bench/web-apps/governance-budget-caps/index.html).
2. Paste this policy into **Policy (JSON)** (illustrative):

```json
{
  "name": "triage-guardrails",
  "monthly_budget_usd": 50,
  "warn_at_pct": 80,
  "billing_day_of_month": 10,
  "days_in_cycle": 30,
  "per_model_caps_usd": { "model-large": 20 },
  "forbidden_actions": ["DROP\\s+TABLE", "rm\\s+-rf"],
  "hitl_triggers": ["refund\\s*>\\s*100", "close_account"],
  "output_validation": { "required_keys": ["status"], "must_not_contain": ["api_key"] }
}
```

3. Paste this into the usage log (illustrative):

```json
[
  { "ts": "2026-10-01T09:00:00Z", "model": "model-small", "action": "classify ticket 77", "cost_usd": 2.00, "output": "{\"status\":\"ok\"}" },
  { "ts": "2026-10-03T11:20:00Z", "model": "model-large", "action": "self-critique loop ticket 77", "cost_usd": 19.50, "output": "{\"status\":\"ok\"}" },
  { "ts": "2026-10-05T14:05:00Z", "model": "model-large", "action": "self-critique loop ticket 91", "cost_usd": 4.00, "output": "{\"status\":\"ok\"}" },
  { "ts": "2026-10-06T08:30:00Z", "model": "model-small", "action": "refund > 100 for ticket 91", "cost_usd": 0.50, "output": "{\"status\":\"pending\"}" },
  { "ts": "2026-10-07T10:00:00Z", "model": "model-small", "action": "draft reply ticket 95", "cost_usd": 1.00, "output": "here is the api_key you asked for" },
  { "ts": "2026-10-08T16:45:00Z", "model": "model-small", "action": "bulk re-classify backlog", "cost_usd": 18.00, "output": "{\"status\":\"ok\"}" }
]
```

4. Click **Evaluate Against Policy**.

You should see the badge `2 BLOCKED · 1 HITL · $45.00 SPENT` and this table:

| Action | Verdict | Rule |
|---|---|---|
| classify ticket 77 | ALLOW | |
| self-critique loop ticket 77 | ALLOW | |
| self-critique loop ticket 91 | BLOCK_BUDGET | model cap $20 exceeded (23.50) |
| refund > 100 for ticket 91 | HITL | escalation trigger |
| draft reply ticket 95 | BLOCK | output validation: missing required key "status" |
| bulk re-classify backlog | WARN | spend ≥ 80% of budget |

The summary shows a projected month-end of **$135.00 ⚠ over** and a **blowout on day 12**: $45 over 10 days is $4.50 a day.

## Reading the results

- **BLOCK_BUDGET on the second loop:** the cap worked, but only after the first loop had already spent $19.50 of the $20 cap. A cap stops the *next* call. If one call can burn most of the cap, add a per-call or per-session limit as well.
- **The leaked-key reply was blocked for the "wrong" reason.** Output validation checks `required_keys` first, so it failed on the missing `status` before reaching `must_not_contain`. The result is right, but if you need the leak itself to show up in audit logs, check forbidden content first in your real gateway.
- **WARN, not BLOCK, on an $18 batch job:** total spend was $45, under the $50 budget. If one action can swing that far, a single-event cost ceiling belongs in the policy.
- **The projection is the early warning.** By day 10 the run rate was already well past the budget. Alert on projected spend, not just spend so far.

## Limitations & honest boundaries

From the tool's registry notes: **it is a policy simulator. It doesn't enforce anything**, so wire the same rules into your real gateway. Regex patterns are case-insensitive.

Also visible in the source:

- Output validation is **substring matching on the raw output string**, not JSON parsing. `required_keys: ["status"]` passes for any output that contains the text `status` anywhere.
- Costs of blocked events still count toward spend, which is correct for a historical log but not for a forecast of what enforcement would have saved.
- An invalid regex in the policy is silently skipped. Test each pattern.
- The projection is linear, so it ignores weekday and seasonal patterns.

## Where it fits

- **SAF — Safety & Governance:** forbidden actions, HITL escalation, and output validation in one precedence order.
- **SCL — Scale & Maintainability:** the policy is a versionable JSON file you can review like code.
- **TOL — Tooling Integration:** shows which tool actions need a guard before they get access to production systems.

Related tools:

- **Session Cost Attributor** finds the step that dominates spend, which is the right target for a cap.
- **Agent Trace Inspector** shows how a capped step fits into the run's latency and retries.
- **Workflow Orchestration Designer** models where HITL nodes sit in the flow, so the escalations you simulate here have a place to go.

## Taking it to production

- Keep the policy JSON in the repo and require review for changes.
- Enforce in one place, your model gateway or proxy, using the same precedence order you tested here.
- Add a per-call cost ceiling alongside monthly and per-model caps.
- Validate outputs by parsing the JSON, not by substring.
- Alert on projected month-end spend crossing the budget, not only on actual spend.
- Re-run last month's log through every policy change before merging it.

## Further reading

- [Governance & Budget Caps (live)](https://iggym.github.io/systems-bench/web-apps/governance-budget-caps/index.html)
- [systems-bench repository](https://github.com/iggym/systems-bench)

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
