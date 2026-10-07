---
title: Enforce policy guardrails on agent spend, actions, and outputs
slug: governance-budget-caps
tool_id: governance-budget-caps
tool_url: web-apps/governance-budget-caps/index.html
focus: operate
mode: local
dimensions: [SAF, SCL, TOL]
tags: [safety, governance, cost, hitl]
audience: engineer
reading_time_min: 13
summary: Evaluate agent actions against budget caps, forbidden-action rules, HITL triggers, and output validation to prevent overspend and risky behaviors.
date: 2026-10-07
prompt_version: master-prompt-v1
---

# Governance & Budget Caps

## TL;DR

- **The problem:** Your agent can call any tool, process any input, and spend any amount. A retry loop burns the monthly budget in an hour. A confused agent deletes the wrong database. Executives need guardrails.
- **What the tool does:** Define a policy (monthly budget, per-model caps, forbidden regex patterns for dangerous actions, HITL escalation triggers, output validators), then evaluate an action log against it. Produces ALLOW/WARN/HITL/BLOCK/BLOCK_BUDGET decisions per event, spend projections, and a violations list.
- **One limitation:** This is a policy simulator. It does not enforce anything on its own—you must wire the same logic into your real gateway or agent loop to block dangerous actions at runtime.

---

## The problem

Your production agent platform ran 1,000 sessions last week. Spend: $7,200. Budget: $5,000. Three sessions alone cost $2,100 — one entered a retry loop on a 429 error, two processed abnormally large documents.

In parallel, an agent accidentally issued refunds to the wrong customer accounts, and another executed a "test query" that dropped a production table.

You need:
1. A way to cap spend per model and per month, with warning thresholds.
2. A way to block dangerous actions before they run (e.g., SQL DROP commands, API calls to unintended targets).
3. A way to escalate high-stakes decisions to a human (e.g., refunds >$500).
4. A way to validate agent outputs (ensure they have required keys, don't leak PII).

Without guardrails, you're relying on hope and manual review. With a policy, you have deterministic, auditable decisions.

---

## The concept

A **policy** is a set of rules that define what an agent is allowed to do. Rules cover:

1. **Budget:** Monthly spend limit, warning threshold (e.g., warn at 80%), per-model caps.
2. **Forbidden actions:** Regex patterns that match dangerous commands (DROP, DELETE, rm -rf, etc.).
3. **HITL escalation:** Patterns or conditions that require human approval (refund >$50, delete_account, etc.).
4. **Output validation:** Rules that outputs must satisfy (required keys, forbidden text like "BEGIN PGP" for PII).

**Decision logic (in order):**
1. If the action matches a forbidden pattern → BLOCK.
2. Else if it matches an escalation trigger → HITL (requires human).
3. Else if it violates output validation → BLOCK.
4. Else if per-model spend cap is exceeded → BLOCK_BUDGET.
5. Else if monthly budget is exceeded → BLOCK_BUDGET.
6. Else if spend is ≥ warning threshold → WARN.
7. Else → ALLOW.

Why it matters:

- **Cost control:** A budget cap prevents a runaway retry loop from burning your month's budget in hours.
- **Action safety:** Forbidden patterns stop dangerous SQL commands, shell commands, or API calls before they reach production systems.
- **Human oversight:** HITL escalation ensures high-stakes decisions (refunds, account deletions) are reviewed by humans.
- **Output integrity:** Validation prevents PII leaks, ensures structured output compliance, or blocks nonsensical responses.

Trade-offs:

- **Regex is coarse:** A pattern like `DROP\s+(TABLE|DATABASE)` catches DROP TABLE and DROP DATABASE but may false-positive on comments containing the word "drop" (e.g., "drop that feature").
- **Heuristic thresholds:** Warn at 80% budget, HITL on refunds >$50 — these are examples, not universal laws. Your thresholds should match your risk tolerance.
- **No context awareness:** The policy decides based on the action string and cost alone. It doesn't know if the action is idempotent, reversible, or likely to fail.

---

## How the tool works

The tool ingests a **policy** and an **action log**, then evaluates each action against the policy.

**Policy structure:**

```json
{
  "name": "prod-2026-08",
  "monthly_budget_usd": 500,
  "warn_at_pct": 80,
  "billing_day_of_month": 12,
  "days_in_cycle": 30,
  "per_model_caps_usd": { "gemini-2.5-pro": 200, "groq-llama-3.3-70b": 150 },
  "forbidden_actions": [
    "DROP\\s+(TABLE|DATABASE)",
    "rm\\s+-rf",
    "DELETE\\s+FROM"
  ],
  "hitl_triggers": [
    "refund\\s*>\\s*50",
    "delete_account",
    "external_transfer"
  ],
  "output_validation": {
    "required_keys": ["status", "data"],
    "must_not_contain": ["BEGIN PGP", "secret"]
  }
}
```

**Action log structure:**

```json
[
  {
    "ts": "2026-08-01T10:00:00Z",
    "model": "gemini-2.5-flash",
    "action": "lookup_invoice(8832)",
    "cost_usd": 0.04,
    "tokens": 800,
    "output": "{\"status\":\"ok\",\"data\":{}}"
  },
  {
    "ts": "2026-08-01T10:02:00Z",
    "model": "groq-llama-3.3-70b",
    "action": "DELETE FROM users WHERE id=402",
    "cost_usd": 0.30,
    "tokens": 900,
    "output": "{\"status\":\"ok\",\"data\":{}}"
  }
]
```

**What it computes per action:**

1. **Forbidden action check:** Test the action against each regex in `forbidden_actions`. If any match → BLOCK, rule: "forbidden action: [pattern]".

2. **HITL trigger check:** Test the action against `hitl_triggers`. If any match → HITL, rule: "escalation trigger: [pattern]".

3. **Output validation (if output field is present):**
   - Check required keys: If the output doesn't contain all keys in `required_keys` → BLOCK.
   - Check forbidden text: If the output contains any text from `must_not_contain` → BLOCK.

4. **Per-model cap check:** Sum this model's spend so far (including this action). If it exceeds `per_model_caps_usd[model]` → BLOCK_BUDGET.

5. **Monthly budget check:** Sum total spend so far (including this action). If it exceeds `monthly_budget_usd` → BLOCK_BUDGET.

6. **Warning threshold:** If total spend is ≥ `warn_at_pct` of budget → WARN.

7. **Projection:** Compute daily burn rate and month-end projection. Estimate "blowout day" (when budget is exhausted).

---

## Walkthrough: try it in 60 seconds

1. Open [Governance & Budget Caps](https://iggym.github.io/systems-bench/web-apps/governance-budget-caps/index.html).

2. Leave the policy (preloaded) or paste:

```json
{
  "name": "prod-2026-08",
  "monthly_budget_usd": 500,
  "warn_at_pct": 80,
  "billing_day_of_month": 12,
  "days_in_cycle": 30,
  "per_model_caps_usd": { "gemini-2.5-pro": 200, "groq-llama-3.3-70b": 150 },
  "forbidden_actions": ["DROP\\s+(TABLE|DATABASE)", "rm\\s+-rf", "DELETE\\s+FROM"],
  "hitl_triggers": ["refund\\s*>\\s*50", "delete_account", "external_transfer"],
  "output_validation": { "required_keys": ["status", "data"], "must_not_contain": ["BEGIN PGP", "secret"] }
}
```

3. Paste the action log:

```json
[
  { "ts": "2026-08-01T10:00:00Z", "model": "gemini-2.5-flash", "action": "lookup_invoice(8832)", "cost_usd": 0.04, "tokens": 800, "output": "{\"status\":\"ok\",\"data\":{}}" },
  { "ts": "2026-08-01T10:01:00Z", "model": "gemini-2.5-pro", "action": "refund > 50 for user 402", "cost_usd": 1.20, "tokens": 2400, "output": "{\"status\":\"pending\",\"data\":{}}" },
  { "ts": "2026-08-01T10:02:00Z", "model": "groq-llama-3.3-70b", "action": "DELETE FROM users WHERE id=402", "cost_usd": 0.30, "tokens": 900, "output": "{\"status\":\"ok\",\"data\":{}}" },
  { "ts": "2026-08-02T09:00:00Z", "model": "gemini-2.5-pro", "action": "summarize annual report", "cost_usd": 3.00, "tokens": 6000, "output": "{\"status\":\"ok\",\"data\":{}}" }
]
```
(Illustrative sample data.)

4. Click **Evaluate Against Policy**.

5. You'll see:
   - **Stats:** Spend $4.54, projected month-end $112.33 (blowout day: none). Per-model: gemini-2.5-pro $4.20 (cap $200), groq-llama $0.30 (cap $150). Events: 4, blocked: 2.
   - **Log table:**
     - Row 1 (lookup_invoice): ALLOW.
     - Row 2 (refund > 50): HITL (matches escalation trigger).
     - Row 3 (DELETE FROM users): BLOCK (matches forbidden pattern "DELETE\\s+FROM").
     - Row 4 (summarize annual report): ALLOW.
   - **Detail:** Policy summary, spend projection, model caps.

**What you're reading:**

- **Row 2 (refund) is flagged HITL:** The action "refund > 50 for user 402" matches the pattern "refund\\s*>\\s*50". A human must approve.
- **Row 3 (DELETE) is blocked:** The action "DELETE FROM users WHERE id=402" matches "DELETE\\s+FROM". It never executes.
- **No budget block (yet):** Total spend $4.54 is well under budget $500. Projected month-end $112.33 means no blowout day.
- **Per-model usage:** gemini-2.5-pro has spent $4.20 / $200 cap (2.1% used). No cap violations yet.

---

## Reading the results

**Decision verdicts:**

- **ALLOW:** The action is safe, within budget, passes output validation. Execute it.
- **WARN:** The action is allowed, but spend is approaching the threshold (e.g., 80% of budget). Log it, alert ops.
- **HITL:** The action matches an escalation trigger. Halt execution and escalate to a human for approval.
- **BLOCK:** The action matches a forbidden pattern or fails output validation. Never execute; log the violation.
- **BLOCK_BUDGET:** The action would exceed a budget cap (monthly or per-model). Never execute.

**Spend projections:**

- **Burn rate ($/day):** If you've spent $X in Y days, your daily burn is $X/Y.
- **Projected month-end:** Extrapolate to the end of the billing cycle. If projected > budget, you'll blowout.
- **Blowout day:** If burn rate continues, on which day will you hit the budget cap? Use this to trigger alerts or enforce tighter caps mid-cycle.

**Per-model caps:**

- If gemini-2.5-pro is already at 90% of its cap, the next expensive gemini-2.5-pro call might exceed the cap and be blocked.
- Use this to balance model usage or trigger a switch to a cheaper model.

**Violations list:**

- Every BLOCK and HITL action is a violation. Use this list to:
  - Tune regex patterns (too many false positives → relax the pattern).
  - Educate the team (agent tried to delete users; need better guardrails).
  - Adjust thresholds (if HITL is triggered too often, raise the refund threshold).

---

## Limitations & honest boundaries

From the tool's own `notes`:

> A policy simulator — it does not enforce anything; wire the same rules into your real gateway. Regex patterns are case-insensitive.

**What this means:**

- **No real enforcement:** This tool evaluates actions *retrospectively*. It does not block anything in real time. To actually block dangerous actions, you must embed the same logic in your gateway or agent loop.
- **Regex is your responsibility:** The patterns you define are only as good as your pattern engineering. `DROP\s+TABLE` will match "DROP TABLE" but not "drop table" in uppercase only if you use the case-insensitive flag (which this tool does by default). Test patterns on sample actions before deploying.
- **No learning:** The tool doesn't adapt. If you see false positives (e.g., "droppings from a bird" being flagged by a "DROP" pattern), you must manually update the policy.
- **No async approval:** HITL escalations are *flagged* as needing approval, but the tool doesn't enforce approval workflows. Your real system must implement the approval loop (e.g., message a Slack channel, await a webhook response).

**When to reach for something heavier:**

- **Real-time enforcement:** Use an API gateway (Kong, Apigee) or a reverse proxy (Envoy) to intercept and block requests before they reach your agent system.
- **Fine-grained RBAC:** If different users or workflows have different permissions, move to a role-based access control system (Zanzibar, OPA).
- **Audit and compliance:** For regulatory requirements (SOX, HIPAA, FedRAMP), use a dedicated compliance/audit tool with logging, signing, and retention guarantees.

---

## Where it fits

**Dimensions this tool covers:**

- **SAF Safety & Governance:** The tool enforces policy guardrails to prevent unsafe actions, overspend, and PII leaks.
- **SCL Scale & Maintainability:** As you scale agent deployments, policy enforcement is a scaling concern. Centralized policy in this tool helps maintain consistency.
- **TOL Tooling Integration:** The tool simulates tool-call filtering and output validation, preparing you for production integration.

**Related bench tools:**

1. **Agent Trace Inspector** — prerequisites. Inspect your traces to understand what actions are happening. Then design a policy to govern them.

2. **Session Cost Attributor** — complementary. Use Cost Attributor to break down spend, identify high-cost workflows, then set per-model caps in Governance.

3. **Workflow Orchestration Designer** — the design phase. Design your agent workflow (which tools can it call, what are decision gates?). Then encode the same guardrails in a policy.

**Example workflow:**
1. Run agents in permissive mode (no guardrails). Export action logs.
2. Paste into Governance & Budget Caps with a draft policy.
3. Simulate the policy. See which actions would be blocked or escalated.
4. Refine the policy: relax patterns with too many false positives, tighten refund thresholds.
5. Bake the policy into your real gateway.
6. Monitor violations; iterate.

---

## Taking it to production

To apply the same idea in a real system:

1. **Define your policy explicitly:**
   - Set monthly budget based on headroom and risk tolerance.
   - List forbidden action patterns (SQL, shell, API endpoints you don't want called).
   - List HITL triggers (high-cost actions, account modifications, external transfers).
   - Define output validators (required keys, PII checks).

2. **Bake policy into your gateway:**
   - If you use an API gateway (Kong, Apigee, Envoy), add a plugin that intercepts agent action requests and evaluates them against the policy.
   - If your agent is an internal service, add a middleware layer that filters actions before they're executed.

3. **Implement HITL escalation:**
   - HITL-flagged actions should not execute immediately. Instead, they should:
     - Post to a queue (SQS, Kafka, Pub/Sub).
     - Notify a human (Slack, email, PagerDuty).
     - Await manual approval via a signed response (webhook, form submission).
     - Only after approval, execute the action.

4. **Log all decisions:**
   - Every ALLOW, WARN, HITL, BLOCK decision should be logged with timestamp, action, policy rule, and outcome.
   - Use these logs to audit compliance and refine policies.

5. **Monitor and alert:**
   - Set up alerts for:
     - Spend approaching 80% of budget.
     - More than N violations in an hour (sign of a runaway agent or bad patterns).
     - HITL queue growing (sign of legitimate high-risk actions piling up).

---

## Further reading

- **[Governance & Budget Caps](https://iggym.github.io/systems-bench/web-apps/governance-budget-caps/index.html)** — the tool itself.
- **[systems-bench repo](https://github.com/iggym/systems-bench)** — schema definitions and other tools.
- **[Building Safe AI Systems (Stuart Russell, 2020)](https://www.youtube.com/watch?v=keKhfW-DXH4)** — foundational thinking on AI safety and guardrails.
- **[Zanzibar: Google's Consistent, Global Authorization System (Polis et al.)](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)** — reference on fine-grained access control.

---

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
