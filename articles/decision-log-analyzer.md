---
title: Spot where your agent's confidence is misaligned with reality
slug: decision-log-analyzer
tool_id: decision-log-analyzor
tool_url: web-apps/decision-log-analyzor/index.html
focus: evaluate
mode: local
dimensions: [OBS, EVA]
tags: [observability, evaluations, metrics]
audience: engineer
reading_time_min: 11
summary: Analyze agent decision logs for calibration drift (high confidence, low success) and failure hotspots to surface reasoning risks.
date: 2026-10-07
prompt_version: master-prompt-v1
---

# Decision Log Analyzer

## TL;DR

- **The problem:** Your agent reports high confidence in its decisions but fails anyway. A classifier thinks "95% sure it's billing"—then misroutes the ticket. Which decisions are overconfident? Which repeat most? Where does the agent leak money?
- **What the tool does:** Parses a decisionLog v1 JSON, buckets decisions by confidence level (0–0.5, 0.5–0.7, 0.7–0.9, 0.9–1.0), counts failures per bucket, flags calibration risks (high confidence + >20% failure rate), and ranks decisions by frequency and cost.
- **One limitation:** Calibration accuracy depends entirely on completeness of your decision-log export. If your system doesn't log every decision or omits rationale, the tool can only see what you recorded.

---

## The problem

Your agent ran 1,000 customer-support sessions yesterday. In 120 of them, the agent escalated to human review — too many. You want to know:

1. Did the agent doubt itself before each escalation? (low confidence = expected)
2. Or was the agent shocked when things failed? (high confidence = a calibration problem)
3. Which *types* of decisions (classify intent, lookup invoice, issue refund) failed most often?
4. How much did each decision type cost, on average?

Without a decision log, you have no answers. With a structured log, you can build a **calibration matrix:** for each confidence bucket, measure the failure rate. A bucket like (0.9–1.0 confidence, 30% failure rate) is a red flag — the agent's self-reported certainty is decoupled from reality.

---

## The concept

An agent makes **decisions** — a step in a workflow where it chooses between options (e.g., "classify this ticket as billing or account?" → "billing"). Each decision has:

- **Self-reported confidence:** 0–1, the agent's own estimate of success.
- **Observed outcome:** success, failure, or partial.
- **Rationale:** why the agent chose this option.
- **Cost & latency:** what it took.

**Calibration** is the alignment between confidence and outcome. A well-calibrated agent's 90% confidence decisions succeed ~90% of the time. An *overconfident* agent's 90% confidence decisions might only succeed 60% of the time.

Why it matters:

- An overconfident agent will retry failed tasks instead of escalating to humans.
- It will burn budget on doomed paths (e.g., retrying a refund when the system is down).
- Humans don't see the doubt signals and assume the agent is reliable.

Trade-offs:

- **Shallow bucket logic:** The tool uses fixed confidence ranges (0–0.5, etc.). A single low-confidence success and a single low-confidence failure both count. Real calibration curves are smoother.
- **Heuristic thresholds:** "Calibration risk" is flagged when a bucket has ≥3 decisions, >20% failure rate, and confidence ≥0.7. These are plausible thresholds, not universal laws.
- **Requires complete logging:** If your agent doesn't log every decision, the picture is incomplete.

---

## How the tool works

The tool ingests a `decisionLog` v1 JSON object — a session ID, workflow name, and an array of decisions:

```json
{
  "schemaVersion": 1,
  "session": "sess_8832_07",
  "workflow": "support-triage",
  "decisions": [
    {
      "step": 1,
      "actor": "agent",
      "decision": "classify intent as billing",
      "optionsConsidered": ["billing", "account", "sales"],
      "rationale": "invoice + charged twice keywords",
      "confidence": 0.93,
      "outcome": "success",
      "latencyMs": 620,
      "costUsd": 0.0004
    },
    {
      "step": 2,
      "actor": "agent",
      "decision": "call lookup_invoice",
      "confidence": 0.97,
      "outcome": "success",
      "latencyMs": 180,
      "costUsd": 0.0001
    }
  ]
}
```

**What it computes:**

1. **Calibration buckets:** Groups decisions by confidence range. For each bucket:
   - Count total decisions.
   - Count failures.
   - Calculate fail rate (failures / total).
   - Flag as a "calibration risk" if: n ≥ 3 AND fail rate > 20% AND confidence ≥ 0.7.

2. **Decision frequency:** Ranks decisions by how often they appear. "Classify intent" might run 450 times; "close ticket" 200 times. Repeat decisions are good candidates for optimization.

3. **Failure hotspots:** Lists decisions that failed at least once, ranked by failure count. "Issue refund" might have 12 failures; "lookup invoice" 2 failures.

4. **Cost & latency by decision:** Aggregates total cost and average latency per decision type. "Classify intent" runs 450 times at $0.0004 each = $0.18 total. "Draft response" runs 380 times at $0.0008 each = $0.30 total. The expensive decisions are tuning targets.

5. **Stats:** Total decisions, failure count and %, average confidence, actor breakdown (how many calls from the agent vs. tools), total cost.

**Input formats:**
- Bare decisions array: `[{step: 1, decision: "...", ...}, ...]`
- Wrapped: `{schemaVersion: 1, decisions: [...]}`

---

## Walkthrough: try it in 60 seconds

1. Open [Decision Log Analyzer](https://iggym.github.io/systems-bench/web-apps/decision-log-analyzor/index.html).

2. Paste the sample decision log (preloaded):

```json
{
  "schemaVersion": 1,
  "session": "sess_8832_07",
  "workflow": "support-triage",
  "decisions": [
    { "step": 1, "actor": "agent", "decision": "classify intent as billing", "optionsConsidered": ["billing", "account", "sales"], "rationale": "invoice + charged twice keywords", "confidence": 0.93, "outcome": "success", "latencyMs": 620, "costUsd": 0.0004 },
    { "step": 2, "actor": "agent", "decision": "call lookup_invoice", "optionsConsidered": ["lookup_invoice", "query_billing_db"], "rationale": "need invoice record", "confidence": 0.97, "outcome": "success", "latencyMs": 180, "costUsd": 0.0001 },
    { "step": 3, "actor": "tool", "decision": "issue_refund", "optionsConsidered": ["issue_refund", "escalate"], "rationale": "eligible per policy", "confidence": 0.95, "outcome": "failure", "latencyMs": 760, "costUsd": 0.0000, "error": "HTTP 429" },
    { "step": 4, "actor": "agent", "decision": "retry issue_refund", "optionsConsidered": ["retry", "escalate"], "rationale": "transient 429", "confidence": 0.62, "outcome": "failure", "latencyMs": 140, "costUsd": 0.0000, "error": "timeout" },
    { "step": 5, "actor": "agent", "decision": "escalate to human", "optionsConsidered": ["escalate", "retry again"], "rationale": "two failures", "confidence": 0.88, "outcome": "success", "latencyMs": 60, "costUsd": 0.0000 },
    { "step": 6, "actor": "agent", "decision": "classify intent as billing", "optionsConsidered": ["billing", "account"], "rationale": "same keywords", "confidence": 0.91, "outcome": "success", "latencyMs": 590, "costUsd": 0.0004 },
    { "step": 7, "actor": "agent", "decision": "call lookup_invoice", "optionsConsidered": ["lookup_invoice", "query_billing_db"], "rationale": "need invoice record", "confidence": 0.96, "outcome": "success", "latencyMs": 170, "costUsd": 0.0001 },
    { "step": 8, "actor": "agent", "decision": "issue_refund", "optionsConsidered": ["issue_refund", "escalate"], "rationale": "eligible per policy", "confidence": 0.94, "outcome": "success", "latencyMs": 150, "costUsd": 0.0000 },
    { "step": 9, "actor": "agent", "decision": "close ticket", "optionsConsidered": ["close", "ask more"], "rationale": "resolved", "confidence": 0.89, "outcome": "success", "latencyMs": 45, "costUsd": 0.0000 }
  ]
}
```
(Illustrative sample data.)

3. Click **Analyze Decisions**.

4. You'll see:
   - **Top stats:** 9 decisions, 2 failures (22%), avg confidence 0.90, 1 tool actor + 8 agent, $0.0010 total cost.
   - **Confidence calibration table:**
     - 0–0.5: 0 decisions.
     - 0.5–0.7: 1 decision, 1 failure, 100% fail rate (the retry at step 4, confidence 0.62).
     - 0.7–0.9: 3 decisions, 1 failure, 33% fail rate.
     - 0.9–1.0: 5 decisions, 0 failures, 0% fail rate.
   - **Decision frequency:** "Classify intent" 2×, "call lookup_invoice" 2×, "issue_refund" 2×, "escalate" 1×, etc.
   - **Failure hotspots:** "issue_refund" 1 failure, "retry issue_refund" 1 failure.
   - **Cost/latency by decision:** "Classify intent" $0.0008 (2 calls), "call lookup_invoice" $0.0002 (2 calls), etc.

**What you're reading:**

- **Calibration risk flag (⚠):** The 0.7–0.9 bucket has 33% failures but only 3 samples. The tool flags it if confidence ≥ 0.7, n ≥ 3, and fail rate > 20%. In this case, 33% > 20% and confidence is 0.7–0.9, so it may be flagged depending on exact thresholds.
- **The 0.5–0.7 retry is expected to fail.** Confidence 0.62 means the agent doubts itself. A timeout failure is unsurprising.
- **The 0.9–1.0 bucket (5 decisions, 0 failures) is well-calibrated.** The agent's high confidence matches reality.

---

## Reading the results

**Calibration buckets:**

Each row is a confidence range. Look for:
- **High-confidence buckets (0.9–1.0) with low fail rates (0–5%):** Healthy. The agent knows when it's right.
- **High-confidence buckets with high fail rates (>20%):** Red flag. The agent is overconfident. Investigate why.
- **Low-confidence buckets (0–0.5) with high fail rates:** Expected. The agent doubts itself, and it's right to.

**Decision frequency:**

Decisions that repeat 100+ times are automation candidates. A decision that runs 500 times saves time if you optimize it once.

**Failure hotspots:**

Decisions with 5+ failures are risk vectors. "Issue refund" failing 5 times means:
- The refund system is flaky (transient, needs retry logic or fallback).
- The agent's preconditions are wrong (checking eligibility but misunderstanding the policy).
- The decision is a natural choke point (hard problems fail more often).

**Cost by decision:**

Decisions that cost $0.01+ per call are expensive. Consider:
- Caching results (if decisions are idempotent).
- Replacing with a cheaper model (Groq or Gemini Flash instead of Claude).
- Batching (make fewer decisions via smarter prompting).

---

## Limitations & honest boundaries

From the tool's own `notes`:

> Client-side analysis of decisionLog JSON exports. Calibration accuracy and cost calculations depend entirely on the completeness of exported decision logs.

**What this means:**

- **Garbage in, garbage out:** If your system logs only 50% of decisions, the calibration picture is distorted.
- **No ground truth:** The tool trusts the `outcome` field. If your system mis-labels outcomes (calling a partial success "success"), the metrics are wrong.
- **Heuristic thresholds:** The "calibration risk" flag (fail rate > 20% in high-confidence buckets) is a rule of thumb, not a proven risk boundary. Use it to surface hypotheses, then investigate manually.
- **No time-series trends:** This tool bins all decisions together. If your agent's calibration drifts over time (better in the morning, worse at night), this view won't show it.
- **No per-actor breakdown:** While the tool counts calls by actor (agent, tool, etc.), it doesn't separate calibration buckets by actor. If tools have different calibration than the main agent, you won't see it here.

**When to reach for something heavier:**

- **Production decision logs:** If you're processing millions of decisions, move this logic to a data warehouse (BigQuery, Snowflake) and build trend dashboards.
- **Real-time alerts:** This tool is retrospective (you analyze after the fact). For live alerting on calibration drift, stream decision logs to a monitoring system.
- **Causal analysis:** If "classify intent" fails 10% of the time, is it the classifier model, the input data, or the labeling criteria? This tool flags the symptom; diagnosis requires digging into the data.

---

## Where it fits

**Dimensions this tool covers:**

- **OBS Observability:** Decision logs are a form of observability—they expose agent reasoning transparently.
- **EVA Closed-loop Evaluation:** Calibration is a feedback loop; outcomes inform confidence estimates.

**Related bench tools:**

1. **Agent Trace Inspector** — a complementary view. While Decision Log Analyzer shows *reasoning* (confidence, calibration), Trace Inspector shows *timing* and *cost* per span.

2. **Session Cost Attributor** — steps downstream. Decision logs often include cost per decision; use this tool to understand which decisions drove spend, then feed that into cost attribution.

3. **Agent Behavior Drift Monitor** — if you want to track calibration *over time*, the drift monitor ingests daily behavioral snapshots and flags divergence from baseline.

**Example workflow:**
1. Export a week's decision logs.
2. Paste into Decision Log Analyzer. Notice that "classify intent" has 94% success (well-calibrated) but "estimate refund amount" has only 72% success in the 0.85–0.95 confidence range.
3. Dig deeper: Read the failing cases manually. Is the classifier seeing new edge cases? Is the refund policy unclear?
4. Retrain or adjust the classifier. Re-export logs and re-analyze to verify the fix.

---

## Taking it to production

To apply the same idea in a real system:

1. **Log every decision:** In your agent loop, after each decision point, record:
   - What was decided and why (rationale, options considered).
   - The agent's self-reported confidence.
   - The outcome (success, failure, partial) — typically observed minutes to hours later.
   - Cost and latency.

2. **Use a structured schema:** Export as `decisionLog` v1 JSON or your own format, but make it consistent. Tools will thank you.

3. **Ingest to a decision log store:** Append logs to a file, database, or message queue. Don't lose them; they're your best signal for improvement.

4. **Build calibration monitoring:** Weekly or daily, re-analyze logs. Track calibration curves over time. Alert if a bucket's fail rate spikes.

5. **Tie to retraining:** When you find a poorly-calibrated decision (high confidence, high failure), it's a cue to fine-tune the model, adjust the prompt, or gather more examples for few-shot learning.

---

## Further reading

- **[Decision Log Analyzer](https://iggym.github.io/systems-bench/web-apps/decision-log-analyzor/index.html)** — the tool itself.
- **[systems-bench repo](https://github.com/iggym/systems-bench)** — schema definitions and other tools.
- **["On Calibration of Modern Neural Networks" (Guo et al., 2017)](https://arxiv.org/abs/1706.04599)** — canonical reference on confidence calibration in ML models.
- **[Conformal Prediction](https://en.wikipedia.org/wiki/Conformal_prediction)** — a framework for building provably calibrated confidence scores.

---

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
