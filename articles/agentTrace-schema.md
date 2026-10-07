---
title: agentTrace v1 — schema reference for agent session traces
slug: agentTrace-schema
tool_id: schema-guide
tool_url: "#"
focus: design
mode: local
dimensions: [ARC, OBS]
tags: [architecture, observability, schemas]
audience: engineer
reading_time_min: 10
summary: Field-by-field reference for the agentTrace v1 schema, with mapping guidance from common agent platforms.
date: 2026-10-07
prompt_version: master-prompt-v1
---

# agentTrace v1 — Agent Session Trace Schema

## Overview

The **agentTrace** v1 schema represents one agent session as a tree of **spans**, where each span is a unit of work (LLM call, tool invocation, loop, eval, handoff). Spans have timing, tokens, cost, status, and optional error information. The schema is designed to be:

- **Minimal:** Only required fields are `schemaVersion`, `session`, and `spans[]`. Everything else is optional.
- **Deterministic:** Parseable and renderable locally without cloud-provider APIs.
- **Cost-trackable:** Every span can carry actual cost (from your invoice) or token counts (to estimate cost).

**Consumed by these bench tools:**
- Agent Trace Inspector
- Session Cost Attributor
- (Governance & Budget Caps ingests action logs, not traces; see the action log schema for that.)

---

## Root object

```typescript
{
  schemaVersion: number (required) = 1
  session: string (required)
  workflow: string (optional)
  spans: span[] (required)
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | number | Yes | Always `1` for this schema version. Allows future schema evolution. |
| `session` | string | Yes | Unique session identifier. Example: `"sess_8832_07"`, `"user_402_triage_20261001_120000"`. Used for grouping and attribution. |
| `workflow` | string | No | Human-readable workflow name. Example: `"support-triage"`, `"research-summary"`. Helps categorize sessions. |
| `spans` | span[] | Yes | Array of spans. Non-empty array required. |

---

## Span object

```typescript
{
  id: string (required)
  parent: string | null (required)
  type: string (required)
  name: string (required)
  startedAt: string | number (optional)
  durationMs: number (optional)
  model: string | null (optional)
  tokensIn: number (optional)
  tokensOut: number (optional)
  costUsd: number (optional)
  status: string (required)
  error: string (optional)
  input: string (optional)
  output: string (optional)
  attrs: object (optional)
}
```

### Core fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier for this span within the session. Example: `"s0"`, `"trace_abc123"`, `"llm_call_1"`. No particular format required. |
| `parent` | string \| null | Yes | Parent span's `id`, or `null` for root spans. Defines the tree structure. Multiple roots are allowed (though typically one root per session). |
| `type` | string | Yes | Kind of work. Common values: `"plan"`, `"llm"`, `"tool"`, `"loop"`, `"eval"`, `"handoff"`, `"act"`. Custom types are allowed. |
| `name` | string | Yes | Human-readable name. Example: `"classify intent"`, `"lookup_invoice(8832)"`, `"draft response"`. Used as a label in visualizations. |
| `status` | string | Yes | Outcome of the span. Standard values: `"ok"`, `"error"`, `"timeout"`. Custom values allowed (e.g., `"partial"`, `"cancelled"`). |

### Timing fields

| Field | Type | Required | Description |
|---|---|---|---|
| `startedAt` | string \| number | No | Start time. If string, must be ISO-8601 (e.g., `"2026-08-01T10:00:00.000Z"`). If number, epoch milliseconds. If omitted, spans are ordered by DFS traversal. |
| `durationMs` | number | No | Duration in milliseconds. If omitted, defaults to 1ms for rendering; use this only for untimed traces or as a fallback. |

**Timing strategy:**
- **Timed traces:** All spans have `startedAt` in wall-clock time. Use ISO-8601 or epoch ms. Waterfall rendering positions bars by `startedAt` with width ∝ `durationMs`.
- **Untimed traces:** No `startedAt`. Spans are positioned in DFS order (depth-first traversal). Useful for abstract traces or offline analysis.

### Cost and token fields

| Field | Type | Required | Description |
|---|---|---|---|
| `tokensIn` | number | No | Tokens sent to the model (prompt tokens). Omit if not applicable (e.g., tool calls). Example: `850`. |
| `tokensOut` | number | No | Tokens returned by the model (completion tokens). Omit if not applicable. Example: `40`. |
| `costUsd` | number | No | Cost in USD. Derived from your actual invoice or estimated from token counts and vendor pricing. If omitted, treated as `0.0`. Example: `0.0004`. Precision: 4 decimal places is typical; more are allowed. |
| `model` | string | null | No | Model identifier, if applicable. Examples: `"gemini-2.5-flash"`, `"claude-3-sonnet"`, `"groq-llama-3.3-70b"`, `null` (for tool calls). |

**Cost calculation guidance (not a prescribed method):**
If your system doesn't have `costUsd`, you can estimate:
- For LLM calls: `cost = (tokensIn × inPrice + tokensOut × outPrice) / 1e6`, where prices are per-million-tokens from the vendor.
- For tool calls: Usually $0 or a small fixed cost (e.g., $0.0001 per call, if the tool is metered).

### Error and content fields

| Field | Type | Required | Description |
|---|---|---|---|
| `error` | string | No | Error message if `status` is `"error"` or `"timeout"`. Examples: `"HTTP 429 rate limited"`, `"Timeout after 30s"`, `"Invalid input: expected JSON"`. Use this for debugging. |
| `input` | string | No | Stringified input sent to the span. For LLM calls, the user prompt (or system + user prompt). For tool calls, the input JSON/args. Use this for tracing and auditing. |
| `output` | string | No | Stringified output received. For LLM calls, the response text. For tool calls, the result JSON. For evals, the score or decision. |

### Extensibility

| Field | Type | Required | Description |
|---|---|---|---|
| `attrs` | object | No | Free-form metadata. Example: `{ "retries": 2, "http_status": 200, "model_temp": 0.7, "region": "us-central1" }`. Use for domain-specific context not covered by standard fields. |

---

## Minimal valid example

```json
{
  "schemaVersion": 1,
  "session": "sess_demo_001",
  "spans": [
    {
      "id": "s0",
      "parent": null,
      "type": "plan",
      "name": "support triage",
      "status": "ok"
    },
    {
      "id": "s1",
      "parent": "s0",
      "type": "llm",
      "name": "classify intent",
      "startedAt": "2026-08-01T10:00:00.000Z",
      "durationMs": 620,
      "model": "gemini-2.5-flash",
      "tokensIn": 850,
      "tokensOut": 40,
      "costUsd": 0.0004,
      "status": "ok",
      "output": "{\"intent\":\"billing\",\"confidence\":0.92}"
    }
  ]
}
```

**Why it's minimal:**
- Only `schemaVersion`, `session`, and `spans` at root.
- Each span has only `id`, `parent`, `type`, `name`, `status` (all required for structure).
- All other fields (timing, cost, tokens, error, input, output, attrs) are optional.

---

## Mapping from common agent frameworks

This section provides *guidance* on how to export from your own system into agentTrace v1. Not prescriptive; your system may differ.

### From OpenTelemetry traces

OpenTelemetry (OTel) is a standard for distributed tracing. If your agent harness uses OTel:

1. **Trace → agentTrace root:** Extract trace ID, span IDs, parent-child relationships. Set `session = traceID`, `workflow = extractFromAttributes("workflow_name", default: omitted)`.

2. **OTel spans → agentTrace spans:**
   - `span.spanId` → `id`
   - `span.parentSpanId` → `parent`
   - `span.name` → `name`
   - `span.startTime` → `startedAt` (convert to ISO-8601 or epoch ms)
   - `span.duration` → `durationMs` (convert ns to ms)
   - `span.status.code` (OK, ERROR, UNSET) → `status` (map to "ok", "error", or custom)
   - `span.attributes["llm.model"]` → `model`
   - `span.attributes["llm.tokens.{input,output}"]` → `tokensIn`, `tokensOut`
   - `span.attributes["cost.usd"]` → `costUsd`
   - `span.events[]` → store in `attrs` if needed (OTel events don't map directly; use your judgment)
   - All other attributes → `attrs` dict

3. **Extract span type:** OTel doesn't have a "type" field by default. Infer from `span.name` or an attribute:
   - If name contains "llm" or attribute `span_type=llm` → type: "llm"
   - If name contains "tool" → type: "tool"
   - If name contains "eval" → type: "eval"
   - etc.

### From LangChain execution traces

LangChain has built-in tracing (if using LangSmith). Rough mapping:

1. **Run → agentTrace root:** Extract run ID from your run context. Set `session = run_id`, `workflow = run.metadata.get("workflow_name")`.

2. **LangChain run steps → spans:**
   - `run.id` → `id`
   - `run.parent_run_id` → `parent`
   - `run.name` → `name` (or `type` if available)
   - `run.start_time` → `startedAt`
   - `run.end_time - run.start_time` → `durationMs`
   - `run.extra.get("llm.model")` → `model` (or extract from the run's serialized state)
   - Count tokens from `run.serialized` or prompts (may require re-parsing)
   - Query your LangSmith runs for actual cost, or estimate from tokens.
   - `run.end_reason` → `status` (map "agent_loop_exceeded" → "timeout", etc.)
   - `run.error` → `error`

3. **Type inference:** LangChain run types include "llm", "retriever", "tool", etc. Use these directly if present; else infer from `run.name`.

### From custom agent harness

If you built your own harness:

1. **Emit agentTrace v1 directly:** Modify your instrumentation to output spans in agentTrace format as you go.

2. **At session end:** Collect all spans, compute missing fields (or leave optional), and emit JSON.

3. **Ensure you capture:**
   - Unique span and session IDs.
   - Parent-child relationships (for tree structure).
   - Wall-clock start times and durations (for waterfall rendering).
   - Token counts from API responses (for cost estimation).
   - Actual cost from invoices or API cost fields.
   - Error messages on failure.

---

## Real-world example

Here's a more realistic trace from a multi-step support-triage session:

```json
{
  "schemaVersion": 1,
  "session": "sess_customer_8832_20261001_093042",
  "workflow": "support-triage",
  "spans": [
    {
      "id": "root",
      "parent": null,
      "type": "plan",
      "name": "support triage for ticket #8832",
      "startedAt": "2026-10-01T09:30:42.000Z",
      "durationMs": 4200,
      "tokensIn": 2400,
      "tokensOut": 900,
      "costUsd": 0.008,
      "status": "ok",
      "attrs": { "ticket_id": "8832", "customer_tier": "gold" }
    },
    {
      "id": "intent_classify",
      "parent": "root",
      "type": "llm",
      "name": "classify intent",
      "startedAt": "2026-10-01T09:30:42.120Z",
      "durationMs": 620,
      "model": "gemini-2.5-flash",
      "tokensIn": 850,
      "tokensOut": 40,
      "costUsd": 0.0004,
      "status": "ok",
      "input": "Customer message: My invoice #8832 was charged twice...",
      "output": "{\"intent\":\"billing\",\"confidence\":0.92}",
      "attrs": { "latency_percentile": "p50" }
    },
    {
      "id": "lookup_tool",
      "parent": "root",
      "type": "tool",
      "name": "lookup_invoice",
      "startedAt": "2026-10-01T09:30:43.100Z",
      "durationMs": 180,
      "costUsd": 0.0001,
      "status": "ok",
      "input": "{\"invoice_id\": 8832}",
      "output": "{\"amount\": 120.00, \"status\": \"paid_twice\"}",
      "attrs": { "http_status": 200, "db_latency_ms": 45 }
    },
    {
      "id": "draft_response",
      "parent": "root",
      "type": "llm",
      "name": "draft response",
      "startedAt": "2026-10-01T09:30:43.900Z",
      "durationMs": 880,
      "model": "gemini-2.5-pro",
      "tokensIn": 1050,
      "tokensOut": 210,
      "costUsd": 0.0031,
      "status": "ok",
      "input": "Invoice lookup: paid twice...",
      "output": "I see you were charged twice for invoice #8832. I can issue a refund..."
    },
    {
      "id": "eval_check",
      "parent": "root",
      "type": "eval",
      "name": "refund eligibility check",
      "startedAt": "2026-10-01T09:30:44.900Z",
      "durationMs": 410,
      "model": "gemini-2.5-flash",
      "tokensIn": 300,
      "tokensOut": 30,
      "costUsd": 0.0002,
      "status": "ok",
      "output": "{\"eligible\": true, \"reason\": \"duplicate charge within 30 days\"}"
    },
    {
      "id": "refund_attempt_1",
      "parent": "root",
      "type": "tool",
      "name": "issue_refund (attempt 1)",
      "startedAt": "2026-10-01T09:30:45.400Z",
      "durationMs": 760,
      "costUsd": 0.0,
      "status": "error",
      "error": "HTTP 429 rate limited",
      "input": "{\"invoice_id\": 8832, \"reason\": \"duplicate_charge\"}",
      "attrs": { "http_status": 429, "retry_after_sec": 60 }
    },
    {
      "id": "refund_attempt_2",
      "parent": "refund_attempt_1",
      "type": "tool",
      "name": "issue_refund (retry)",
      "startedAt": "2026-10-01T09:30:46.300Z",
      "durationMs": 140,
      "costUsd": 0.0,
      "status": "timeout",
      "error": "Timeout after 5s"
    },
    {
      "id": "escalate",
      "parent": "root",
      "type": "handoff",
      "name": "escalate to human support",
      "startedAt": "2026-10-01T09:30:46.600Z",
      "durationMs": 60,
      "costUsd": 0.0,
      "status": "ok",
      "output": "{\"escalation_id\": \"esc_62841\", \"queue\": \"high_priority\"}",
      "attrs": { "reason": "refund_failed_retry" }
    }
  ]
}
```

**Annotations:**
- **Root span** (id: root) is the session plan. Its duration (4200ms) is the sum of all wall-clock times, not a direct computation—that's OK.
- **Intent classify** (id: intent_classify) is a cheap LLM call (Gemini Flash, 40 output tokens, $0.0004).
- **Lookup tool** (id: lookup_tool) is a tool call (tool calls have no model and minimal cost).
- **Draft response** (id: draft_response) uses Gemini Pro (more expensive) and produces a longer output (210 tokens).
- **Refund attempts** (id: refund_attempt_1, refund_attempt_2) show error and timeout. Attempt 2 is a child of attempt 1 (retry chain).
- **Escalate** (id: escalate) is a handoff span (agent passes control to human). Status is "ok" (handoff succeeded), not "error".
- **Attrs** fields carry domain-specific data: HTTP status, database latency, retry counts, ticket ID, customer tier. These are not in the schema, but the schema allows them.

---

## Common pitfalls

### 1. Forgetting cost or token fields

**Mistake:** Omitting `costUsd` or `tokensIn/Out` to save space.

**Why it breaks:** Cost Attributor and budget tools can't analyze spend. Tools assume missing cost = $0.

**Fix:** Always populate cost from your invoice. If you use OpenAI's token counter or Claude's API, extract tokens from the response. Estimate cost: `cost = (tokensIn * in_price + tokensOut * out_price) / 1e6`.

### 2. Incorrect parent references

**Mistake:** Circular references (span A's parent is B, B's parent is A), or referencing non-existent parent IDs.

**Why it breaks:** Tree rendering fails; tools assume tree is valid.

**Fix:** Before emitting, validate: every span's parent (if non-null) must exist as another span's ID, and no cycles.

### 3. Mixing time formats

**Mistake:** Some spans have ISO-8601 `startedAt`, others epoch ms, others omitted.

**Why it breaks:** Waterfall renderer may misalign spans or default to DFS order.

**Fix:** Pick a format (ISO-8601 is recommended) and use consistently. If timing is unavailable, omit all `startedAt`/`durationMs` and rely on DFS ordering.

### 4. Span type misspellings

**Mistake:** Using `type: "llm_call"` instead of `type: "llm"`.

**Why it breaks:** Tools don't recognize the type; filtering or aggregation breaks.

**Fix:** Use the standard types: `plan`, `llm`, `tool`, `loop`, `eval`, `handoff`, `act`. Custom types are allowed but won't be recognized by bench tools.

### 5. Missing root span

**Mistake:** All spans have non-null parents; no root span.

**Why it breaks:** Waterfall renderer doesn't know where to start; critical path computation fails.

**Fix:** Ensure at least one span has `parent: null` (the session plan span).

---

## See also

- **[Agent Trace Inspector](../articles/trace-inspector.md)** — how to visualize and analyze traces.
- **[Session Cost Attributor](../articles/session-cost-attributor.md)** — how to break down cost using agentTrace.
- **[OpenTelemetry Trace Spec](https://opentelemetry.io/docs/specs/otel/trace/)** — the standard that inspired this design.
- **[systems-bench repo](https://github.com/iggym/systems-bench)** — source code, examples, and schema definitions in `apps.json`.

---

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
