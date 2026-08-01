<div align="center">

# 🧰 systems-bench

**A workbench for building, evaluating, and understanding agentic AI systems — one tool at a time.**

**24 single-purpose, client-side tools for agent harnesses, loops, workflows, evals, cost, safety, and observability. Zero accounts. Zero dashboards. No telemetry. Grab a tool and go.**

[![Live bench](https://img.shields.io/badge/live-%F0%9F%94%97%20systems--bench-blue?style=flat-square)](https://iggym.github.io/systems-bench/)
[![CI](https://img.shields.io/github/actions/workflow/status/iggym/systems-bench/ci.yml?branch=main&style=flat-square&label=CI%20checks)](https://github.com/iggym/systems-bench/actions)
[![Tools](https://img.shields.io/badge/tools-24-5eead4?style=flat-square&logo=wrench)](https://iggym.github.io/systems-bench/)
[![Zero deps](https://img.shields.io/badge/dependencies-0-3fb950?style=flat-square)](https://github.com/iggym/systems-bench)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-8d99a3?style=flat-square)](LICENSE)
[![Last updated](https://img.shields.io/badge/updated-2026--08--01-ff8a3d?style=flat-square)](https://github.com/iggym/systems-bench)

</div>

---

## 👋 Hello — and who this is for

AI agents are getting easier to build and **harder to trust**. They call tools, spend money, make decisions, and drift out of alignment — often quietly. `systems-bench` is a free, open workbench of 24 small, sharp tools that help you **evaluate, design, and operate** agentic systems with confidence.

Everything runs in your browser. Nothing phones home. No sign-up, no data leaves your machine (unless *you* paste an API key to test against a live model).

**Jump straight to the section for you:**

| You are… | Skip to |
|---|---|
| 🧑‍💻 **Engineer** — want to run it in 60 seconds | [Quick Start](#-for-engineers-quick-start) |
| 🏛️ **Engineering leader** — want the strategic picture | [For leaders](#-for-engineering-leaders) |
| 👔 **Non-technical reader** — plain English | [For non-technical readers](#-for-non-technical-readers) |

---

## 🧑‍💻 For engineers: Quick Start

**One-line value proposition:** a static, single-purpose toolkit for agentic-AI systems work — JSON in, analysis out, nothing to install, everything inspectable.

```bash
git clone https://github.com/iggym/systems-bench.git
cd systems-bench
python3 -m http.server 8000        # open http://localhost:8000
```

Run the full verification suite (syntax, link integrity, schema contract, and behavior tests on every tool):

```bash
npm test
```

**Try a real example in ~30 seconds** — open <kbd>Agent Trace Inspector</kbd> from the bench and paste this trace:

```json
{
  "session": "sess_8832",
  "spans": [
    { "id": "s1", "parent": null, "type": "plan", "name": "triage", "durationMs": 900, "costUsd": 0.0002 },
    { "id": "s2", "parent": "s1", "type": "tool", "name": "lookup_invoice(8832)", "durationMs": 180, "status": "error", "error": "HTTP 429" }
  ]
}
```

You get a waterfall timeline, critical-path highlighting, token/cost/status aggregation, and per-span detail — a mini-version of what distributed tracing tools show, but **client-side and free**.

### 🔭 How it's put together

```
                ┌──────────────────────────────────────────────┐
                │                 systems-bench                 │
                │    one workbench · 24 tools · zero accounts   │
                └───────────────────────┬──────────────────────┘
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
   ┌────────────────────┐                              ┌────────────────────┐
   │     apps.json      │─────────────────────────────▶│    index.html      │
   │  single source of  │                              │  (root bench)      │
   │  truth: tools,     │                              │  filters + cards   │
   │  schemas, criteria │                              └────────────────────┘
   └─────────┬──────────┘
             │ references (status, url, tags, dimensions…)
             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │   web-apps/<tool>/index.html   —   24 self-contained tools   │
   │   each: single HTML file · zero dependencies · JSON in → out │
   └───────────────────────────────┬──────────────────────────────┘
                                   │ verified by
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │   tests/check.mjs   —   the CI gate                          │
   │   apps.json contract · JS syntax · link integrity ·          │
   │   schema verification · zero slop policy enforced            │
   └──────────────────────────────────────────────────────────────┘
```

**Design principles** (enforced by the check suite):

- 🔒 **Honest by construction** — a tool can't go `live` without an honest-limits `notes` line; planned tools are never counted as shipped; low-utility tools are pruned.
- 🧩 **Single source of truth** — `apps.json` is the only inventory; the root bench renders directly from it.
- 🧪 **Reproducible** — `npm test` runs deterministic checks on every tool (syntax, load, schema verification). CI runs it on every push.
- 🪶 **Grab-and-go** — each tool is one HTML file. Open it, use it, delete it. No framework, no build step, no vendor lock.

### 🗂️ The 24 tools at a glance

**🧪 Evaluate** — benchmarks, evals, judges, diagnostics

| Tool | What it does |
|---|---|
| Multi-LLM Arena & Parallel Tester | Same prompt to two models in parallel — TTFT, tok/s, diff, sim mode |
| Golden Dataset Test Harness | Golden-set regression runs with deep-diff, live or local-lint |
| LLM-as-a-Judge Rubric Evaluator | Grade output against your rubric (live judge or honest local checks) |
| Needle in a Haystack Benchmarker | Real retrieval sweep + lost-in-the-middle diagnosis |
| Context Compression Benchmarker | Real compression ratios vs lexical retention, incl. live summary |
| System Prompt Mutation Optimizer | Deterministic prompt variants, ranked locally or by live judge |
| Decision Log Analyzer | Confidence-vs-outcome calibration, failure hotspots, cost per decision |
| Adversarial Edge-Case Red-Teamer | Static review + optional live probe against a real model |
| JSON Schema Contract Validator | Real schema validation — type/enum/pattern/bounds + JSONPath report |
| JSON Schema Repair Loop | Validate → classify → auto-repair → re-validate, with a repair log |

**🛠️ Design** — harnesses, schemas, context & state engineering

| Tool | What it does |
|---|---|
| Workflow Orchestration Designer | Typed node graphs (plan/act/tool/eval/HITL/handoff/end) + deterministic sim + Mermaid export |
| MCP Client Inspector | Compile MCP-style tool defs → OpenAI/Gemini schemas as you type |
| Context Firewall & Hand-off Generator | Strip trace noise, redact PII by policy, build a compact hand-off payload |
| Context Budgeting & Compactor | Fit context into a token budget — 4 strategies with audit trails |
| Few-Shot Canonical Example Builder | Format + budget few-shot blocks, detect duplicates |
| Scratchpad State Manager | Versioned hand-off payload with SHA-256 integrity |
| ReAct Loop Visualizer | Step-through Thought→Action→Observation timeline |
| AI Infra Router & SOW Generator | Build-vs-buy framework, transparent cost model, PII scrubber, DRAFT SOW |

**📈 Operate** — cost, capacity, latency, proxy infrastructure

| Tool | What it does |
|---|---|
| Agent Trace Inspector | Nested waterfall of exported traces + critical path (`agentTrace` schema) |
| Session Cost Attributor | Spend by session/model/type/step, blended $/1M (`agentTrace` schema) |
| Agent Behavior Drift Monitor | Baseline-vs-recent drift on daily aggregates + interpretation hints |
| Governance & Budget Caps | Per-event enforcement: ALLOW/WARN/HITL/BLOCK/BLOCK_BUDGET |
| EdgeGuard AI | Dual-engine hedge router: threshold-firing, loser aborted, cost-accounted |
| Jeff Dean Latency & Capacity Profiler | Little's-law in-flight math, bandwidth vs link, IOPS vs disk |

### ➕ Adding a tool (contribution-ready)

1. Create `web-apps/<tool-id>/index.html` — one self-contained HTML file, zero deps.
2. Add an entry to `apps.json` (id, name, url, description, tags, status, mode, focus, dimensions, dateAdded, **notes**).
3. Run `npm test` — the checker validates syntax, link integrity, and schema compliance.

Full contract in [the registry section](#-the-registry-contract) below.

---

## 🏛️ For engineering leaders

**The problem:** agent teams ship fast but can't answer three questions: *Is it reliable? What did it decide and why? Is it still under budget?* Most tooling is either a heavy dashboard platform or scattered scripts that rot.

**The strategic value of `systems-bench`:**
- 🧭 **A shared vocabulary.** Every tool is tagged against **8 engineering criteria** — Reliability, Architecture & Contracts, Closed-loop Evaluation, Tooling Integration, Workflow & Orchestration, Observability, Safety & Governance, Scale & Maintainability. Teams get a common lens for "are we covering the bases?"
- 📉 **Cost & risk visibility before they hit.** Budget enforcement (Governance & Budget Caps), drift detection (Behavior Drift Monitor), trace analytics (Trace Inspector & Session Cost Attributor), and capacity math (Jeff Dean profiler) turn "we'll find out in the bill" into "we know now."
- 🔬 **Evaluation as a discipline, not an afterthought.** Golden datasets, rubric judges, contract validators, and repair loops give you the closed feedback loop that prevents prompt/model regressions.
- 🕵️ **Observability that's actually inspectable.** Trace, decision-log, and behavior-drift tools use three documented schemas (`agentTrace`, `decisionLog`, `behaviorSnapshot`) — the same contract your own exports can follow.
- ⚖️ **Governance primitives.** HITL triggers, forbidden actions, budget caps, and output validation — simulated locally so you can design policy *before* wiring it into production gateways.

**Maintenance signals** (the boring, important stuff):

| Signal | Status |
|---|---|
| CI | ✅ GitHub Actions runs the full check suite on every push |
| Check suite | ✅ 25 files parsed, 24 tools load, syntax & schema assertions verified in CI |
| Dependencies | ✅ 0 (pure HTML/JS/CSS) |
| License | ✅ BSD 3-Clause |
| Inventory freshness | 🗓️ 24 tools · 24 live · zero slop · `lastUpdated 2026-08-01` |
| Honesty policy | ✅ planned tools are never counted as live; every live tool documents its limits in `notes` |

**Onboarding a new engineer:** clone → `python3 -m http.server 8000` → read the registry contract in this README → pick a tool card → open the single HTML file. That's the entire onboarding loop.

---

## 👔 For non-technical readers

**The problem in plain language:** AI assistants and agents are powerful, but they can also be **expensive, unpredictable, and unsafe** if nobody checks them. The teams building them often lack simple tools to answer: *Is this costing what we expect? Did it do what we asked? Would it ever do something harmful?*

**The solution:** a free, open toolbox — like a well-organized workbench — where your team can:
- 🔍 **Test before trusting** — check how well an AI answers before shipping it.
- 💰 **Watch the budget** — track usage and cost attribution *before* bills blow past plan.
- 🛡️ **Stay safe** — simulate guardrails (approval steps, forbidden actions, budget caps) before they go live.
- 📊 **Understand what happened** — replay what an AI did step-by-step, like a black-box flight recorder.

**Why it matters to you:**
- **Business value:** catch costly errors early, control AI spend, and reduce risk — without buying another platform or trusting another black box.
- **Transparency:** everything runs in the browser, no data leaves your team, no accounts to manage.
- **Trustworthy project:** the team behind it publicly audits its own claims and enforces inventory honesty in its automated checks.

**Getting started takes one line:** open the [live bench](https://iggym.github.io/systems-bench/), click any card, and try it. That's it.

---

## 📋 The registry contract

`apps.json` is **versioned** (`registryVersion: 3`), declares the 8 engineering `dimensions`, 4 `focuses` (`evaluate · design · operate · describe`), a canonical `tagVocabulary` (31 tags), and the shared `schemas` — all enforced by `tests/check.mjs`.

| Field | Meaning |
|---|---|
| `id` | Stable slug (matches the folder name) |
| `name` | Display name — describes what the tool **actually does** |
| `url` | Relative path from repo root |
| `description` | Honest one-liner, including limits |
| `status` | `live` (ships & links work) · `planned` (never counted, never linked) |
| `mode` | `local` (no key) · `hybrid` (local works; key unlocks live) · `api` (needs keys) |
| `focus` | `evaluate` / `design` / `operate` / `describe` |
| `dimensions` | Subset of the 8 criteria the tool genuinely covers |
| `notes` | **Required** for every live tool — specific, checkable limits |
| `dateAdded` / `updated` | First listed / last materially changed |
| `tags` | Must be ⊆ `tagVocabulary` |

**The 8 engineering criteria:**

| | Criterion | Code |
|---|---|---|
| 1 | Reliability — deterministic, repeatable, graceful degradation, rollback paths | `REL` |
| 2 | Architecture & Contracts — schemas, interfaces, module boundaries | `ARC` |
| 3 | Closed-loop Evaluation — scoring, feedback cycles, traceability | `EVA` |
| 4 | Tooling Integration — I/O contracts, retries, rate limits, secure boundaries | `TOL` |
| 5 | Workflow & Orchestration — planning, branching, async, deterministic handoffs | `ORC` |
| 6 | Observability — tracing, decision logs, cost, drift, reasoning transparency | `OBS` |
| 7 | Safety & Governance — budget caps, forbidden actions, HITL, output validation | `SAF` |
| 8 | Scale & Maintainability — modularity, versioning, CI/CD, reproducibility | `SCL` |

**Shared schemas** (one ingest format across observability tools, documented in `apps.json → schemas`):

- `agentTrace` v1 — `spans[]` (id, parent, type, name, timing, model, tokens, cost, status, attrs) → **Agent Trace Inspector**, **Session Cost Attributor**
- `decisionLog` v1 — `decisions[]` (step, actor, decision, rationale, confidence, outcome, cost) → **Decision Log Analyzer**
- `behaviorSnapshot` v1 — `series[]` of `{date, metrics}` → **Agent Behavior Drift Monitor**

---

## 🗓️ Changelog

| Version | What changed |
|---|---|
| **v3.3** · 2026-08-01 | High-utility consolidation and CI audit: removed 9 low-utility/slop tools, registered the 4 observability tools (`trace-inspector`, `session-cost-attributor`, `behavior-drift-monitor`, `decision-log-analyzor`), implemented `package.json` + `tests/check.mjs`, and standardized the 24-tool high-utility bench |
| **v3.2** · 2026-08-01 | Observability expansion: `Session Cost Attributor`, `Decision Log Analyzer`, `Agent Behavior Drift Monitor`; `decisionLog` + `behaviorSnapshot` schemas |
| **v3.1** · 2026-08-01 | `Agent Trace Inspector` + shared `agentTrace` schema |
| **v3** · 2026-08-01 | Tool rebuild wave: real JSON-Schema validator, honest red-teamer, fixed EdgeGuard hedging, transparent infra-router; added orchestration designer, governance/budget caps |
| **v2** · 2026-08-01 | Honesty pass: single source of truth, `notes`/statuses everywhere |
| **v1** · 2026-07-30 | Original collection |

---

## 💬 Feedback

Found a bug? Want a tool? Think a `notes` line is too kind? **Say so.**

- 🐛 Open an [issue](https://github.com/iggym/systems-bench/issues) — the honesty policy applies to feedback too.
- 🧩 Open a [pull request](https://github.com/iggym/systems-bench/pulls) — a tool is one HTML file and one `apps.json` entry.
- ✨ Request a feature — the bench is intentionally extensible; new criteria, schemas, and tools land regularly.

Built solo, shipped in the open — [@iggym](https://github.com/iggym). Pull up a stool. 🪑
