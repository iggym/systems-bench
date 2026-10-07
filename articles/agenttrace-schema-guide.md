---
title: "agentTrace v1: one export format for agent traces and cost"
slug: "agenttrace-schema-guide"
type: "schema-guide"
tool_id: "trace-inspector"
tool_url: "web-apps/trace-inspector/index.html"
related_tools: [session-cost-attributor]
focus: "operate"
mode: "local"
dimensions: [OBS, ARC]
tags: [observability, metrics]
audience: "engineer"
reading_time_min: 6
summary: "Field-by-field reference for the agentTrace v1 schema, a minimal valid example, export guidance, and the bench tools that consume it."
date: "2026-10-07"
prompt_version: "master-prompt-v1"
---

# agentTrace v1: one export format for agent traces and cost

## TL;DR

- **What it is:** a small JSON format describing one agent session as a tree of spans, defined in `apps.json → schemas.agentTrace`.
- **Who reads it:** Agent Trace Inspector (waterfall and critical path) and Session Cost Attributor (spend by session, model, type, and step).
- **Rule to remember:** totals are plain sums over spans, so put **self cost** on each span and never a rollup of its children.

## The problem

Every agent framework logs differently: nested callbacks, flat event streams, provider-specific usage blocks. Analysis tools that each accept their own format push you into writing a converter per tool. `agentTrace` v1 is the one shape the systems-bench observability tools agree on. Write one exporter, and the waterfall and cost attribution both work.

## Structure

A trace is a session object with a `spans` array. Spans form a tree through `parent`:

```
session (root object)
└─ spans[]
   ├─ span (parent: null)          ← root span, e.g. the plan
   │  ├─ span (parent: <root id>)  ← llm / tool / eval …
   │  │  └─ span (parent: …)       ← e.g. a retry under the failed call
   │  └─ span
```

This is the same parent/child span model used in distributed tracing. See [OpenTelemetry: traces](https://opentelemetry.io/docs/concepts/signals/traces/).

## Field reference

**Root object**

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | number | `1` |
| `session` | string | Session label; used as the session name in cost attribution |
| `workflow` | string | Optional workflow name |
| `spans` | span[] | Required, non-empty |

**Span**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique within the trace; auto-assigned if missing |
| `parent` | string \| null | `null`, or an id not found in the trace, makes it a root |
| `type` | string | `llm`, `tool`, `loop`, `eval`, `handoff`, `plan`, `act`; anything else displays as `other` |
| `name` | string | Human label; Session Cost Attributor groups "steps" by this |
| `startedAt` | ISO-8601 or epoch ms | Optional. Without it, spans are laid out in tree order |
| `durationMs` | number | Drives bar width and the critical path |
| `model` | string \| null | Groups cost by model; missing goes to `(no model / tool)` |
| `tokensIn` / `tokensOut` | number | Summed into token totals and blended $/1M |
| `costUsd` | number | Missing counts as 0; never estimated |
| `status` | `ok` \| `error` \| `timeout` | Default `ok` |
| `error` | string | Optional message |
| `input` / `output` | string | Optional; shown in the span detail view |
| `attrs` | object | Optional free-form metadata |

Session Cost Attributor accepts three wrappers: one session object as above, `{ "sessions": [ {session, workflow, spans}, … ] }`, or a bare spans array. The Trace Inspector reads one session object or a bare array.

## Minimal valid example

This is illustrative and pastes straight into either tool:

```json
{
  "schemaVersion": 1,
  "session": "sess_min",
  "spans": [
    { "id": "p", "parent": null, "type": "plan", "name": "plan", "durationMs": 1500 },
    { "id": "c", "parent": "p", "type": "llm", "name": "answer", "model": "model-small",
      "durationMs": 1200, "tokensIn": 800, "tokensOut": 120, "costUsd": 0.0004 }
  ]
}
```

In the Trace Inspector this shows 2 spans and a 1.50s total, with both spans on the critical path. Because no span has `startedAt`, the child is placed at the start of its parent.

## Exporting from your stack

This is guidance, not a supported integration. Map whatever your runtime records:

- **Span boundaries:** one span per model call, tool call, eval, or human hand-off, plus one root span per session.
- **Parent links:** use the call stack or the loop iteration that triggered the step. Retries should be children of the failed attempt, so they show up together on the critical path.
- **Cost:** compute `costUsd` per model call from your provider's reported token usage and your price table. Leave parents at their own cost, usually 0 for a plan span.
- **OpenTelemetry users:** span id, parent span id, start time, and duration map directly. Token and model attributes from the [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) map to `model`, `tokensIn`, and `tokensOut`. A converter tool is on the systems-bench roadmap.

## Common mistakes

- **Rolled-up parent costs:** a parent whose `costUsd` already includes its children gets double-counted in both tools. In the Cost Attributor it also inflates the `(no model / tool)` bucket.
- **Unrecognized types:** `hitl` or `retrieval` spans render as `other`. Map them to the closest supported type and keep the original in `attrs`.
- **Mixed time units:** `startedAt` accepts ISO-8601 or epoch milliseconds. Epoch seconds will be read as milliseconds and the timeline will collapse.
- **Orphaned parents:** a typo in `parent` silently promotes the span to a root.

## Limitations & honest boundaries

- The Trace Inspector runs client-side with no live ingestion. Totals are plain sums, and unknown types render as `other`.
- The Session Cost Attributor computes attribution locally from these logs. It doesn't connect to billing APIs or cloud cost explorers.
- The tools enforce very little of the schema. Missing optional fields default quietly, so validate your exporter's output yourself, for example with the JSON Schema Contract Validator and a schema written from the table above.

## Where it fits

- **OBS — Observability:** one export feeds both trace and cost views.
- **ARC — Architecture & Contracts:** an explicit, versioned interface between your runtime and your analysis tools.

## Further reading

- [Agent Trace Inspector article](trace-inspector.md) · [Debug an expensive agent session](debug-an-expensive-agent-session.md)
- [OpenTelemetry: traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [systems-bench repository](https://github.com/iggym/systems-bench)

Found a gap? Open an issue or PR at https://github.com/iggym/systems-bench.
