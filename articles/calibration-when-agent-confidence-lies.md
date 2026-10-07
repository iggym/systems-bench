---
title: "Calibration: when agent confidence lies"
slug: "calibration-when-agent-confidence-lies"
type: "concept-explainer"
tool_id: "decision-log-analyzor"
tool_url: "web-apps/decision-log-analyzor/index.html"
related_tools: [behavior-drift-monitor]
focus: "evaluate"
mode: "local"
dimensions: [OBS, EVA, REL]
tags: [observability, evaluations, metrics, diagnostic]
audience: "engineer"
reading_time_min: 8
summary: "Why an agent's self-reported confidence can't be trusted by default, and how to check it with decision logs and drift monitoring."
date: "2026-10-07"
prompt_version: "master-prompt-v1"
---

# Calibration: when agent confidence lies

## TL;DR

- **Problem:** agents gate actions on their own confidence ("act if ≥ 0.9, else ask"), but nobody checks whether 0.9 means anything.
- **Tools:** the Decision Log Analyzer buckets self-reported confidence against real outcomes and flags high-confidence failure clusters. The Agent Behavior Drift Monitor catches the slower version, where behavior shifts over days.
- **Limitation to remember:** both tools are heuristics on the data you export. The thresholds are starting points for investigation, not statistical tests.

## The problem

A billing agent applies discount codes on its own whenever it reports confidence of 0.9 or higher. That seemed safe: the agent "knows when it isn't sure". Then refunds and complaints start to rise. The decision log shows the agent was 0.91–0.94 confident every time it applied a code, including the times the code was expired, didn't exist, or went on the wrong line item.

The threshold wasn't the problem. The problem was assuming that a stated confidence of 0.9 meant the agent would be right about nine times in ten. That is an empirical claim, and nobody had measured it.

## The concept

A system is **calibrated** when its stated confidence matches its observed accuracy. Among all decisions made at about 0.9 confidence, about 90% should succeed. Modern neural networks are known to be poorly calibrated out of the box. See Guo et al., [*On Calibration of Modern Neural Networks*](https://arxiv.org/abs/1706.04599) (2017). LLM agents add another layer, because their "confidence" is often just a number the model *writes*, not a probability anyone has measured.

To check calibration, **bucket** decisions by confidence and compare each bucket's failure rate with what the confidence implies:

```
confidence bucket   decisions   failures   fail rate   implied max fail
0.9 – 1.0               7           3          43%          ~10%    ⚠
0.7 – 0.9               1           0           0%          ~30%
0.5 – 0.7               1           0           0%          ~50%
```

The bucket that matters most is **high confidence, high failure**. Those are the cases where the agent skips the safety net because it believes it's right. Low-confidence failures are less dangerous: they are usually the ones a confidence gate already sends to a human.

Calibration also **drifts**. A model update, a prompt change, or new kinds of input can shift behavior gradually. A one-off audit misses that, so you also need a baseline-versus-recent comparison over time.

## How the tools work

**Decision Log Analyzer** reads `decisionLog` v1: `decisions[]` with `decision`, `confidence` (0–1), and `outcome`. It:

- Treats every outcome other than `success` as a failure, so `partial` counts as a failure.
- Buckets confidence into 0–0.5, 0.5–0.7, 0.7–0.9, and 0.9–1.0.
- Flags **CALIBRATION RISK** when a bucket at or above 0.7 has at least 3 decisions and a failure rate above 20%.
- Lists failure hotspots and cost per decision, grouped by the exact `decision` string.

**Agent Behavior Drift Monitor** reads `behaviorSnapshot` v1: daily `{date, metrics}` points. It:

- Splits the series in half: the first half is the baseline, the second half is recent.
- Compares the mean of each metric and flags it when the relative change exceeds a threshold (default 15%).
- Gives a drift score equal to the share of metrics flagged, with keyword-based hints such as "error-rate shift — reliability event…".

## Try it on the bench

### Decision Log Analyzer

Open the [Decision Log Analyzer](https://iggym.github.io/systems-bench/web-apps/decision-log-analyzor/index.html), paste this log (illustrative), and click **Analyze Decisions**:

```json
{
  "schemaVersion": 1,
  "session": "sess_calib_demo",
  "decisions": [
    { "step": 1, "actor": "agent", "decision": "route to billing", "confidence": 0.95, "outcome": "success", "costUsd": 0.0004 },
    { "step": 2, "actor": "agent", "decision": "apply discount code", "confidence": 0.93, "outcome": "failure", "error": "code expired", "costUsd": 0.0002 },
    { "step": 3, "actor": "agent", "decision": "route to billing", "confidence": 0.96, "outcome": "success", "costUsd": 0.0004 },
    { "step": 4, "actor": "agent", "decision": "apply discount code", "confidence": 0.91, "outcome": "failure", "error": "code not found", "costUsd": 0.0002 },
    { "step": 5, "actor": "agent", "decision": "ask clarifying question", "confidence": 0.62, "outcome": "success", "costUsd": 0.0003 },
    { "step": 6, "actor": "agent", "decision": "apply discount code", "confidence": 0.94, "outcome": "success", "costUsd": 0.0002 },
    { "step": 7, "actor": "agent", "decision": "route to billing", "confidence": 0.97, "outcome": "success", "costUsd": 0.0004 },
    { "step": 8, "actor": "agent", "decision": "escalate to human", "confidence": 0.81, "outcome": "success", "costUsd": 0.0001 },
    { "step": 9, "actor": "agent", "decision": "apply discount code", "confidence": 0.92, "outcome": "partial", "error": "applied to wrong line item", "costUsd": 0.0002 }
  ]
}
```

You should see the badge **CALIBRATION RISK — HIGH-CONFIDENCE FAILURES**, with 9 decisions, 3 failures (33%), and average confidence 0.89. The 0.9–1.0 bucket has 7 decisions, 3 failures, a 43% fail rate, and is flagged. The single failure hotspot is `apply discount code`: 3 failures out of 4, a 75% fail rate.

So the agent's confidence is fine for routing and badly inflated for discount codes. A single global threshold can't handle both.

### Agent Behavior Drift Monitor

Open the [Agent Behavior Drift Monitor](https://iggym.github.io/systems-bench/web-apps/behavior-drift-monitor/index.html) and click **Detect Drift** on the built-in 8-day sample. It reports **CRITICAL · 86/100**, with 6 of 7 metrics flagged. `errorRate` went up 157% (0.012 → 0.03), `refusalRate` up 107%, and `costUsd` up 51%. `flashShare` fell 14%, which is below the 15% threshold, so it isn't flagged.

Read that alongside a calibration audit. If error rates rise while the agent's reported confidence stays flat, calibration is degrading. Re-run the decision-log analysis on the recent window.

## Reading the results

- **A flagged high-confidence bucket:** don't gate that action on self-reported confidence. Add an external check, such as code validity or a policy lookup, or send it to a human.
- **A hotspot concentrated in one decision type:** set confidence thresholds per action, not one threshold for the whole agent.
- **Rising drift score with stable confidence:** the model's self-assessment is lagging reality. Recalibrate, or tighten gates until you have.
- **Small buckets:** a bucket with fewer than 3 decisions is never flagged. Collect more data before drawing conclusions.

## Limitations & honest boundaries

- **Decision Log Analyzer:** it runs client-side on `decisionLog` JSON exports. Calibration accuracy and cost calculations depend entirely on how complete the exported logs are. The buckets and the ">20% with n ≥ 3" rule are heuristics, so treat flags as hypotheses and then read the cases. Grouping uses the exact `decision` string, so "apply code" and "apply discount code" count as different decisions.
- **Agent Behavior Drift Monitor:** it runs locally on `behaviorSnapshot` series and computes mean drift. It doesn't connect to live monitoring backends. The half-split ignores seasonality, a step change inside the window can split oddly, and the interpretation hints are keyword matches on metric names.
- Neither tool measures calibration with a proper scoring rule (for example, expected calibration error over many bins). For rigorous measurement, compute those offline on a large, labeled set.

## Where it fits

- **OBS — Observability:** puts the agent's own reasoning signals on the record.
- **EVA — Closed-loop Evaluation:** turns outcome labels into a feedback signal on confidence.
- **REL — Reliability:** finds the overconfident actions that bypass safety gates.

Related tools:

- **Agent Trace Inspector** shows where a failed decision sits in the run.
- **Governance & Budget Caps** lets you rehearse a HITL trigger for the overconfident action, for example `apply discount code`.
- **LLM-as-a-Judge Rubric Evaluator** can label outcomes when success isn't directly observable.

## Taking it to production

- Log `confidence` and a ground-truth `outcome` for every gated decision. Without outcome labels you can't measure calibration.
- Compute per-action calibration weekly, and set per-action gates from observed accuracy, not stated confidence.
- Export daily behavior aggregates and alert on drift in error and refusal rates.
- After any model or prompt change, re-run the calibration audit before relaxing a gate.

## Further reading

- [Decision Log Analyzer (live)](https://iggym.github.io/systems-bench/web-apps/decision-log-analyzor/index.html) · [Agent Behavior Drift Monitor (live)](https://iggym.github.io/systems-bench/web-apps/behavior-drift-monitor/index.html)
- Guo, Pleiss, Sun, Weinberger — [On Calibration of Modern Neural Networks](https://arxiv.org/abs/1706.04599)
- [systems-bench repository](https://github.com/iggym/systems-bench)

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
