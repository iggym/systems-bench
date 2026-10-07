---
title: Debug an expensive agent session in 10 minutes
slug: debug-expensive-session
tool_id: workflow-recipe
tool_url: "#"
focus: operate
mode: local
dimensions: [OBS, SAF]
tags: [cost, observability, diagnostic, safety]
audience: engineer
reading_time_min: 14
summary: Chain Trace Inspector → Session Cost Attributor → Governance Caps to find why a session overran budget and define guardrails.
date: 2026-10-07
prompt_version: master-prompt-v1
---

# Debug an Expensive Agent Session in 10 Minutes

## TL;DR

- **The scenario:** One customer support session cost $8—15× your average ($0.50). You need to find out why and prevent it happening again.
- **The workflow:** Export the trace → Inspect it for bottlenecks → Attribute cost to models and steps → Define a policy to cap future spend.
- **Tools chained:** Agent Trace Inspector → Session Cost Attributor → Governance & Budget Caps.
- **Outcome:** You'll know which span caused the overrun, design a cost cap to prevent recurrence, and have an audit trail.

---

## The problem

Your production agent ran 200 support-triage sessions today. Spend: $110. Budget: $100. One session alone was $8; the others averaged $0.50. That $8 session processed a 50,000-word legal document. Now you need to answer:

1. **Where did the $8 go?** Which spans consumed the most cost?
2. **Which model was expensive?** Gemini Pro (pricey) or Gemini Flash (cheap)?
3. **Should we have escalated instead?** Is $8 acceptable for a complex case, or should humans handle documents that large?
4. **How do we prevent it?** Should we cap cost per session, or set a per-model limit?

Without a workflow, you'll get lost in JSON and spreadsheets. With this 3-tool recipe, you'll debug in 10 minutes.

---

## Step 1: Export and inspect the trace

**Goal:** Understand the session structure. Spot which spans took time and cost money.

1. **Export the session's agentTrace v1 JSON.** Your agent harness should emit this when the session ends. It includes:
   - Session ID and workflow name.
   - Spans for every LLM call, tool invocation, eval, and handoff.
   - `startedAt`, `durationMs`, `tokensIn`, `tokensOut`, `costUsd`, `status`, `error` for each span.

   Example (small; your real trace will be larger):
   ```json
   {
     "schemaVersion": 1,
     "session": "sess_big_doc_001",
     "workflow": "support-triage",
     "spans": [
       { "id": "s0", "parent": null, "type": "plan", "name": "handle large document", "durationMs": 45000, "tokensIn": 18000, "tokensOut": 2100, "costUsd": 8.15, "status": "ok" },
       { "id": "s1", "parent": "s0", "type": "llm", "name": "ingest and summarize (gemini-2.5-pro)", "model": "gemini-2.5-pro", "durationMs": 42000, "tokensIn": 18000, "tokensOut": 2000, "costUsd": 8.10, "status": "ok" },
       { "id": "s2", "parent": "s0", "type": "tool", "name": "lookup_customer", "durationMs": 200, "costUsd": 0.0001, "status": "ok" }
     ]
   }
   ```

2. **Open [Agent Trace Inspector](https://iggym.github.io/systems-bench/web-apps/trace-inspector/index.html).**

3. **Paste the trace into the left panel.**

4. **Click Inspect Trace.**

5. **Read the output:**
   - **Span count:** How many spans (LLM calls, tool invocations)?
   - **Total duration:** Was it slow (timeout hanging around?) or fast (just expensive)?
   - **Token count:** How many tokens were processed? (The signal for cost.)
   - **Cost:** Confirmed. Where does that total come from?
   - **Critical path (★):** Which spans are on the latency bottleneck? (This is different from the cost bottleneck—a cheap tool might slow you down if it's critical path.)
   - **Errors/timeouts:** Did anything fail and retry, inflating cost?

**In the example above, you'd see:**
- 3 spans; 45s total; 20,100 tokens; $8.15 cost.
- The ingest-and-summarize span (s1) is 42s (93% of total time) and $8.10 (99% of cost).
- Model: gemini-2.5-pro (expensive).
- 18,000 tokens in + 2,000 out = 20,000 tokens for Gemini Pro. At Gemini pricing, that's ~$0.0004/1K tokens = ~$8.

**Decision:** The overrun is driven by the large document context (18,000 tokens) and expensive model choice (Gemini Pro). Next step: attribute cost more granularly.

---

## Step 2: Attribute cost to models and step types

**Goal:** Understand which model and step type (LLM, tool, eval) caused the cost. Use this to design optimization levers.

1. **Copy the trace JSON (or keep it open).**

2. **Open [Session Cost Attributor](https://iggym.github.io/systems-bench/web-apps/session-cost-attributor/index.html).**

3. **Paste the trace.**

4. **Click Attribute Cost.**

5. **Read the breakdowns:**
   - **By model:** If Gemini Pro was 95%+ of cost, switching to Gemini Flash could save 10–15×.
   - **By span type:** If LLM calls are 90%+ of cost but tool calls are <1%, the optimization is in the LLM layer, not tool selection.
   - **Top 8 steps:** Which named steps consumed the most? ("ingest doc" vs. "final check"?)
   - **Tokens:** 20,000 tokens explains the cost. A typical support case is 1,000–2,000 tokens; this was 10× larger.

**In the example, you'd see:**
- By model: gemini-2.5-pro $8.10 (99%).
- By span type: llm $8.10 (99%).
- Top steps: "ingest and summarize" $8.10.
- Tokens: 20,100 total.

**Decision:** The large document (50,000 words raw; 18,000 tokens after chunking) is the root cause. Cost-optimization levers:
- **Lever 1:** Use a cheaper model (Gemini Flash) for ingestion if accuracy is acceptable. Estimate 5–8× savings.
- **Lever 2:** Compress the document (extract key sections, summarize first) to reduce input tokens. Estimate 3–5× savings.
- **Lever 3:** Escalate documents >10,000 tokens to humans. Estimate 100% savings for those cases (cost → human labor).

---

## Step 3: Define and test a policy

**Goal:** Encode guardrails to prevent future $8+ sessions. Test the policy against this session and others.

1. **Open [Governance & Budget Caps](https://iggym.github.io/systems-bench/web-apps/governance-budget-caps/index.html).**

2. **Define a policy.** Example:

```json
{
  "name": "support-triage-safety-2026",
  "monthly_budget_usd": 5000,
  "warn_at_pct": 80,
  "billing_day_of_month": 1,
  "days_in_cycle": 30,
  "per_model_caps_usd": {
    "gemini-2.5-pro": 200,
    "gemini-2.5-flash": 1000,
    "groq-llama-3.3-70b": 500
  },
  "forbidden_actions": ["DELETE\\s+FROM", "DROP\\s+(TABLE|DATABASE)"],
  "hitl_triggers": [
    "escalate_to_human",
    "refund\\s*>\\s*100",
    "large_context_(?:ingest|summarize)"
  ],
  "output_validation": {
    "required_keys": ["status", "decision", "summary"],
    "must_not_contain": ["ERROR", "UNABLE_TO_PROCESS"]
  }
}
```

**Rationale:**
- **Per-model caps:** Gemini Pro capped at $200/month (40 expensive sessions like this one). Gemini Flash (cheap) at $1000. Groq at $500.
- **HITL on large context:** If the agent decides to "large_context_ingest", escalate to a human first. This catches the 50,000-word document case.
- **Forbidden actions:** Prevent accidental SQL drops or deletes.
- **Output validators:** Ensure outputs have required fields; reject error strings that suggest the agent got confused.

3. **Create an action log representing your session's actions.** Example:

```json
[
  { "ts": "2026-10-01T09:00:00Z", "model": "gemini-2.5-pro", "action": "large_context_ingest legal document (50k words)", "cost_usd": 8.10, "tokens": 18000, "output": "{\"status\":\"ok\",\"decision\":\"SUMMARY_READY\",\"summary\":\"Legal doc about...\"}" }
]
```

4. **Paste the policy and action log into Governance & Budget Caps.**

5. **Click Evaluate Against Policy.**

6. **Read the result:**
   - **Row decision:** HITL (matches `large_context_ingest` trigger). The action would escalate to human, preventing an $8 charge without review.
   - **Status badge:** "1 HITL · $8.10 spent".
   - **Projected month-end:** If one such session per day, month-end = $243 (well within the $5k budget, but requiring 30 human escalations).

**Decision:** The policy successfully caught the expensive case. Next steps:
- **Deploy the policy** into your real gateway. When an agent tries to ingest a large document, it escalates to HITL instead of auto-processing.
- **Monitor escalations.** If humans approve 95% of large-document cases, adjust the policy (e.g., use Gemini Flash instead of Pro, or allow auto-process but log it).
- **Iterate.** As you see patterns, refine model selection, token budgets, and escalation triggers.

---

## Walkthrough: the full workflow in 10 minutes

Assume you have the exported session JSON ready:

**Minutes 0–2: Inspect the trace**
- Open Trace Inspector, paste the trace, click Inspect Trace. Spot that s1 (ingest-summarize) is $8.10 and uses Gemini Pro.

**Minutes 2–4: Attribute cost**
- Open Cost Attributor, paste the trace, click Attribute Cost. Confirm Gemini Pro is 99% of cost; ingest-summarize is the top-1 expensive step.

**Minutes 4–10: Define and test policy**
- Open Governance, define a policy with per-model caps and HITL triggers for large contexts. Test against an action log. Verify the policy flags the expensive action as HITL or BLOCK.

**Outcome:** You've identified the root cause (large document + expensive model), designed a policy to prevent recurrence, and have a repeatable workflow for future debugging.

---

## Extending the workflow

**Scenario 1: Escalating to a real team.**

After detecting the $8 session and defining a policy, you'd:
1. Alert ops: "Session $8 overrun detected. Policy now escalates large documents to HITL. Implement in gateway?"
2. Ops implements the policy in the real gateway (Kong, Envoy, custom middleware).
3. QA tests the policy against a sample of production traces.
4. Deploy to production.

**Scenario 2: Tuning the policy iteratively.**

Week 1: You HITL-gate large documents. Humans approve 95%, reject 5%.
→ Week 2: Adjust. Allow auto-process for documents <10k tokens (cheap), HITL for 10–50k (expensive), BLOCK for >50k (very expensive).
→ Week 3: Monitor again; refine thresholds.

**Scenario 3: Root-causing multiple expensive sessions.**

If 5 sessions were expensive, export all 5 traces, paste into Cost Attributor as a `sessions` bundle:
```json
{ "sessions": [{ "session": "sess_a", "spans": [...] }, { "session": "sess_b", "spans": [...] }, ...] }
```
You'll see which sessions and models are expensive. Then tailor the policy.

---

## Data flow and schema compatibility

**Trace Inspector → Cost Attributor:**
- Input: agentTrace v1 JSON (session, spans array).
- Output: breakdown by session, model, span type, top steps.
- **Data flow:** Same spans; no transformation. Cost Attributor uses the `costUsd` field from each span.

**Cost Attributor → Governance:**
- Input: Per-model and per-step cost breakdowns.
- Used to: Inform per-model caps in the policy.
- **Data flow:** No direct output handoff. You manually read the cost attribution and set caps in the policy.

**Governance evaluation:**
- Input: Policy + action log.
- Output: ALLOW/WARN/HITL/BLOCK decisions; spend projections.
- **Data flow:** No connection back to traces. Governance operates on the abstraction of "actions" (agent-facing intent), not low-level spans.

---

## Common pitfalls

1. **Forgetting to export cost fields:** If your spans lack `costUsd` or `tokensIn/Out`, Cost Attributor shows incomplete data. Ensure your agent harness calculates and attaches cost from actual API responses.

2. **Regex false positives:** A pattern like `ingest` might match "ingestion" but also "reingest"—overly broad. Test patterns on a sample of real action strings first.

3. **Setting caps too low:** If you cap Gemini Pro at $50/month but your baseline usage is $200, you'll block legitimate work. Start with caps at 1.5–2× your current usage, then tighten.

4. **Ignoring token counts:** Cost is driven by tokens, not duration. A fast 10k-token call costs more than a slow 1k-token call. Use token counts to forecast spend.

5. **Testing policy on *exported* traces, not real runtime:** This tool simulates. Before deploying a policy, wire it into your real gateway and test on a small cohort.

---

## Deployment checklist

Before deploying a policy to production:

- [ ] **Define thresholds:** per-model caps, monthly budget, warning thresholds. Ground them in historical data.
- [ ] **Test on sample traces:** Use Governance & Budget Caps to simulate the policy on 10–20 representative traces.
- [ ] **Classify violations:** Which HITL and BLOCK decisions are expected (high-risk but legitimate), and which are bugs (false positives)?
- [ ] **Plan HITL workflow:** How will HITL escalations be routed, approved, and logged? (Slack channel, form, webhook?)
- [ ] **Instrument logging:** Every policy decision (ALLOW, WARN, HITL, BLOCK) must be logged with timestamp, action, rule, and outcome.
- [ ] **Wire into gateway:** Implement the policy in your real API gateway or agent middleware.
- [ ] **Monitor violations:** Set up alerts for spike in BLOCKs or HITLs; these are symptoms.
- [ ] **Iterate:** After 1 week, review violation logs and refine the policy.

---

## Related tools and deeper dives

- **[Agent Trace Inspector](../articles/trace-inspector.md)** — deep dive on reading traces, critical paths, and timing analysis.
- **[Session Cost Attributor](../articles/session-cost-attributor.md)** — deep dive on cost breakdown, blended rates, and model selection.
- **[Governance & Budget Caps](../articles/governance-budget-caps.md)** — deep dive on policy design, enforcement rules, and HITL workflows.
- **[Workflow Orchestration Designer](../articles/workflow-orchestration-designer.md)** — design your agent's workflow and decision gates *before* running it, so you know what guardrails to apply.

---

## Further reading

- **[systems-bench](https://iggym.github.io/systems-bench/)** — the full workbench of tools.
- **[OpenTelemetry Traces](https://opentelemetry.io/docs/specs/otel/trace/)** — if you want to export traces to a production backend (Datadog, Honeycomb, Jaeger).
- **["Auditing Black-Box Models" (Doshi-Velez & Kim, 2017)](https://arxiv.org/abs/1702.04690)** — foundational paper on interpretability and debugging AI systems.

---

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
