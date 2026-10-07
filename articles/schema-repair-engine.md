---
title: "Repair LLM JSON without silently inventing data"
slug: "schema-repair-engine"
type: "tool-deep-dive"
tool_id: "schema-repair-engine"
tool_url: "web-apps/schema-repair-engine/index.html"
focus: "evaluate"
mode: "local"
dimensions: [ARC, EVA, REL]
tags: [harnesses, validation]
audience: "engineer"
reading_time_min: 7
summary: "Validate model output against a JSON Schema subset, auto-repair only the safe cases, and get a log of every change and every refusal."
date: "2026-10-07"
prompt_version: "master-prompt-v1"
---

# Repair LLM JSON without silently inventing data

## TL;DR

- **Problem:** models return JSON that is almost right. Retrying the whole call is slow and costly, but "fixing it up" in code can quietly corrupt data.
- **Tool:** JSON Schema Repair Loop validates a payload, applies only conservative repairs, re-validates for up to N passes, and logs every change, including the ones it refused to make.
- **Limitation to remember:** pattern, length, and const violations are never auto-fixed, and only a JSON Schema subset is supported (no `$ref`, `oneOf`, `anyOf`, or `allOf`).

## The problem

Your agent produces a ticket for a downstream system. The schema wants `priority` to be one of `low`, `medium`, `high`, `due_in_days` to be an integer from 1 to 30, and no extra fields. The model returns `"priority": "Hgh"`, `"due_in_days": "45"`, a string `"true"` for a boolean, an extra `reasoning` field, and an assignee in the wrong format.

Some of these are typos with exactly one sensible fix. Others, like the assignee format, have no fix that doesn't involve guessing. A repair layer that treats both kinds the same will send made-up values downstream, and nobody will notice until a ticket lands with the wrong person.

## The concept

A **validate → repair → re-validate loop** treats structured output as a contract:

```
payload ──▶ validate ──▶ violations? ──no──▶ done (converged)
               ▲              │yes
               │              ▼
               └──── apply only safe repairs ──▶ none possible? ──▶ stop, report unresolved
```

The key design choice is the boundary between **safe** and **unsafe** repairs. A safe repair has one obvious intended value: `"45"` → `45`, `"Hgh"` → `"high"`. An unsafe repair would need information the payload doesn't contain. The loop should log those and stop, not guess. A bounded number of passes stops repairs that interact from cycling forever.

## How the tool works

Validation covers `type`, `required`, `enum`, `const`, `pattern`, `minLength`/`maxLength`, `minimum`/`maximum`, nested `properties`, `items`, and `additionalProperties: false`. Each violation gets a code and a JSONPath. Repairs by code:

| Violation | Repair |
|---|---|
| `TYPE` | Coerce a string to number/integer/boolean when it parses cleanly, or a number/boolean to string; otherwise unresolved |
| `ENUM` | Case-insensitive nearest match if within a small edit distance (≤ ⌊length/3⌋, minimum 1); else the schema `default`; else unresolved |
| `MISSING` | Insert the property's `default`; if there is none, leave it out and report it as unresolved |
| `EXTRA` | Strip the property (only when `additionalProperties: false`) |
| `MIN` / `MAX` | Clamp to the bound |
| `PATTERN`, `MIN_LENGTH`, `MAX_LENGTH`, `CONST` | Never repaired; the value is left untouched and reported as unresolved |

The loop runs until the payload validates (**CONVERGED**), only unresolved violations remain (**STOPPED — UNRESOLVED**), or the pass limit is reached (**MAX PASSES**). The input payload is never mutated; repairs apply to a copy.

## Walkthrough: try it in 60 seconds

1. Open the [JSON Schema Repair Loop](https://iggym.github.io/systems-bench/web-apps/schema-repair-engine/index.html).
2. Paste this schema (illustrative):

```json
{
  "type": "object",
  "required": ["priority", "assignee", "due_in_days"],
  "additionalProperties": false,
  "properties": {
    "priority": { "type": "string", "enum": ["low", "medium", "high"], "default": "medium" },
    "assignee": { "type": "string", "pattern": "^[a-z]+\\.[a-z]+$" },
    "due_in_days": { "type": "integer", "minimum": 1, "maximum": 30 },
    "notify": { "type": "boolean" }
  }
}
```

3. Paste this payload (illustrative model output):

```json
{
  "priority": "Hgh",
  "assignee": "Jane Doe",
  "due_in_days": "45",
  "notify": "true",
  "reasoning": "user sounded upset"
}
```

4. Click **Run Repair Loop** with max passes = 3.

You should see the badge **STOPPED — UNRESOLVED** with 3 passes, 5 repairs, and 1 residual violation, and this log:

| Pass | Path | Rule | Before → After |
|---|---|---|---|
| 1 | `$.priority` | enum nearest-match → "high" (distance 1) | "Hgh" → "high" |
| 1 | `$.assignee` | no safe repair (PATTERN, UNRESOLVED) | "Jane Doe" → (unchanged) |
| 1 | `$.due_in_days` | coerce string → integer | "45" → 45 |
| 1 | `$.notify` | coerce string → boolean | "true" → true |
| 1 | `$.reasoning` | strip additional property | "user sounded upset" → (removed) |
| 2 | `$.due_in_days` | clamp to maximum 30 | 45 → 30 |

The repaired payload is `{"priority":"high","assignee":"Jane Doe","due_in_days":30,"notify":true}`. The assignee is deliberately left alone.

The pass-2 clamp shows why the loop exists: coercion had to happen before the range check could see a number.

## Reading the results

- **CONVERGED:** every violation had a safe fix. Pass the repaired payload on, and log the repair count as a quality signal for the prompt.
- **STOPPED — UNRESOLVED** (or **MAX PASSES**): at least one field needs real information. Re-ask the model with the specific violation ("assignee must match `first.last`"), or send it to a human. Don't forward the payload as is.
- **Watch for value-changing repairs.** In the walkthrough, "45 days" became 30, which is a meaning change, not a formatting fix. Decide per field whether clamping is acceptable or should be rejected.
- **A high repair count across many runs** means the prompt or the output format is wrong. Fix it upstream with few-shot examples or tighter instructions.

## Limitations & honest boundaries

From the tool's registry notes: repairs are **conservative**. Enum nearest-match is used only within a small edit distance; otherwise the schema default is used; otherwise the violation is unresolved. **Pattern, length, and const violations are never auto-fixed.** It uses the same JSON Schema subset as the Contract Validator: no `$ref`, `oneOf`, `anyOf`, or `allOf`.

Also visible in the source:

- Edit distance is Levenshtein on lowercased strings, so it catches typos and case, not synonyms ("urgent" will not map to "high").
- A required field with no `default` is never invented. It stays missing and is reported, so the payload still fails validation until real data arrives.
- Clamping changes meaning. For fields like money or dates, rejecting is often safer than clamping.
- For production-grade validation with the full spec, use a complete JSON Schema validator and keep this repair logic as a thin, logged layer on top.

## Where it fits

- **ARC — Architecture & Contracts:** makes the output contract explicit and enforced.
- **EVA — Closed-loop Evaluation:** repair counts and unresolved codes are measurable signals about prompt quality.
- **REL — Reliability:** bounded passes and refuse-don't-guess behavior keep the outcome predictable.

Related tools:

- **JSON Schema Contract Validator (Subset)** is the validate-only step, useful as a strict CI gate on fixtures.
- **Few-Shot Canonical Example Builder** helps fix the root cause by showing the model correct outputs.
- **Golden Dataset Test Harness** catches regressions when a prompt change raises the repair rate.

## Taking it to production

- Run validation on every model response, and repair only the codes you've approved per field.
- Log each repair (path, rule, before, after) next to the request ID.
- On unresolved violations, re-prompt with the violation text, at most once or twice, then escalate.
- Track the repair rate and unresolved rate per prompt version, and alert on increases.
- Prefer provider-side structured output modes where they are available, and keep the loop as a backstop.

## Further reading

- [JSON Schema Repair Loop (live)](https://iggym.github.io/systems-bench/web-apps/schema-repair-engine/index.html)
- [JSON Schema](https://json-schema.org/)
- [systems-bench repository](https://github.com/iggym/systems-bench)

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
