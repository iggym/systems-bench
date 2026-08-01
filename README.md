<div align="center">

# 🧰 systems-bench

**A workbench for building, evaluating, and understanding agentic AI systems — one tool at a time.**

**33 single-purpose, client-side tools for agent harnesses, loops, workflows, evals, cost, safety, and observability. Zero accounts. Zero dashboards. No telemetry. Grab a tool and go.**

[![Live bench](https://img.shields.io/badge/live-%F0%9F%94%97%20systems--bench-blue?style=flat-square)](https://iggym.github.io/systems-bench/)
[![CI](https://img.shields.io/github/actions/workflow/status/iggym/systems-bench/ci.yml?branch=main&style=flat-square&label=CI%20checks)](https://github.com/iggym/systems-bench/actions)
[![Tools](https://img.shields.io/badge/tools-33-5eead4?style=flat-square&logo=wrench)](https://iggym.github.io/systems-bench/)
[![Zero deps](https://img.shields.io/badge/dependencies-0-3fb950?style=flat-square)](https://github.com/iggym/systems-bench)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-8d99a3?style=flat-square)](LICENSE)
[![Last updated](https://img.shields.io/badge/updated-2026--08--01-ff8a3d?style=flat-square)](https://github.com/iggym/systems-bench)

</div>

---

## 👋 Hello — and who this is for

AI agents are getting easier to build and **harder to trust**. They call tools, spend money, make decisions, and drift out of alignment — often quietly. `systems-bench` is a free, open workbench of 33 small, sharp tools that help you **evaluate, design, and operate** agentic systems with confidence.

Everything runs in your browser. Nothing phones home. No sign-up, no data leaves your machine (unless *you* paste an API key to test against a live model).

**Jump straight to the section for you:**

| You are… | Skip to |
|---|---|
| 🧑‍💻 **Engineer** — want to run it in 60 seconds | [Quick Start](#-for-engineers-quick-start) |
| 🏛️ **Engineering leader** — want the strategic picture | [For leaders](#-for-engineering-leaders) |
| ✍️ **Journalist** — want the story | [Why it matters](#-for-journalists-why-it-matters) |
| 🔍 **Recruiter** — want a 30-second read | [For recruiters](#-for-recruiters) |
| 👔 **Non-technical leader** — plain English | [For non-technical leaders](#-for-non-technical-leaders) |

---

## 🧑‍💻 For engineers: Quick Start

**One-line value proposition:** a static, single-purpose toolkit for agentic-AI systems work — JSON in, analysis out, nothing to install, everything inspectable.

```bash
git clone https://github.com/iggym/systems-bench.git
cd systems-bench
python3 -m http.server 8000        # open http://localhost:8000
```

Run the full verification suite (syntax, link integrity, and behavior tests on every tool):

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
                │    one workbench · 33 tools · zero accounts   │
                └───────────────────────┬──────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
   │     apps.json      │──▶│    index.html      │   │  web-apps/tool-    │
   │  single source of  │   │  (root bench)      │   │  suite/ (in-bench  │
   │  truth: tools,     │   │  filters + cards   │   │  hub)              │
   │  schemas, criteria │   └────────────────────┘   └────────────────────┘
   └─────────┬──────────┘
             │ references (status, url, tags, dimensions…)
             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │   web-apps/<tool>/index.html   —   33 self-contained tools   │
   │   each: single HTML file · zero dependencies · JSON in → out │
   └───────────────────────────────┬──────────────────────────────┘
                                   │ verified by
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │   tests/check.mjs   —   the CI gate                          │
   │   apps.json contract · JS syntax · link integrity ·          │
   │   16 behavior assertions · registry renderer smoke tests     │
   └──────────────────────────────────────────────────────────────┘
```

**Design principles** (yes, these are enforced by the check suite):

- 🔒 **Honest by construction** — a tool can't go `live` without an honest-limits `notes` line; planned tools are never counted as shipped; duplicates are flagged, never hidden.
- 🧩 **Single source of truth** — `apps.json` is the only inventory; the root bench and the in-bench hub render from it. No drifted copies.
- 🧪 **Reproducible** — `npm test` runs deterministic checks on every tool (syntax, load, behavior with default inputs). CI runs it on every push.
- 🪶 **Grab-and-go** — each tool is one HTML file. Open it, use it, delete it. No framework, no build step, no vendor lock.

### 🗂️ The 33 tools at a glance

**🧪 Evaluate** — benchmarks, evals, judges, diagnostics

| Tool | What it does |
|---|---|
| Multi-LLM Arena & Parallel Tester | Same prompt to two models in parallel — TTFT, tok/s, diff, sim mode |
| Golden Dataset Test Harness | Golden-set regression runs with deep-diff, live or local-lint |
| LLM-as-a-Judge Rubric Evaluator | Grade output against your rubric (live judge or honest local checks) |
| Needle in a Haystack Benchmarker | Real retrieval sweep + lost-in-the-middle diagnosis |
| Context Compression Benchmarker | Real compression ratios vs lexical retention, incl. live summary |
| System Prompt Mutation Optimizer | Deterministic prompt variants, ranked locally or by live judge |
| Eval Failure Clustering & Traceability | Group failing cases by error signature, surface dominant clusters |
| Decision Log Analyzer | Confidence-vs-outcome calibration, failure hotspots, cost per decision |
| Adversarial Edge-Case Red-Teamer | Static review + optional live probe against a real model |
| Agent Hedge Request Tester | Monte Carlo P50/P99 of request hedging vs overhead |
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
| Agentic HITL Gatekeeper | Policy gate: auto-block destructive, auto-pass read-only, escalate the rest |
| ReAct Loop Visualizer | Step-through Thought→Action→Observation timeline |
| AI Infra Router & SOW Generator | Build-vs-buy framework, transparent cost model, PII scrubber, DRAFT SOW |

**📈 Operate** — cost, capacity, latency, proxy infrastructure

| Tool | What it does |
|---|---|
| Agent Trace Inspector | Nested waterfall of exported traces + critical path (agentTrace schema) |
| Session Cost Attributor | Spend by session/model/type/step, blended $/1M (agentTrace schema) |
| Agent Behavior Drift Monitor | Baseline-vs-recent drift on daily aggregates + interpretation hints |
| Meter Shock | Project usage spend to month-end, find your blowout day |
| Governance & Budget Caps | Per-event enforcement: ALLOW/WARN/HITL/BLOCK/BLOCK_BUDGET |
| Edge Exponential Backoff Gateway | Seeded sim of token-bucket + jittered backoff vs unlimited baseline |
| EdgeGuard AI | Dual-engine hedge router: threshold-firing, loser aborted, cost-accounted |
| Jeff Dean Latency & Capacity Profiler | Little's-law in-flight math, bandwidth vs link, IOPS vs disk |
| Model Latency & Cost Profiler | Monthly spend, blended $/M, TTFT/SLA estimates per tier |
| Pipeline Rot | ML-pipeline decay scoring — drift, step changes, volatility, staleness |
| Zombie Stack | Find subscriptions/services still running long after their workload |

**🗂️ Describe** — registries & documentation surfaces

| Tool | What it does |
|---|---|
| AI Engineering Tool Suite (this hub) | The registry hub, rendered from the same `apps.json` as the root |

### ➕ Adding a tool (contribution-ready)

1. Create `web-apps/<tool-id>/index.html` — one self-contained HTML file, zero deps.
2. Add an entry to `apps.json` (id, name, url, description, tags, status, mode, focus, dimensions, dateAdded, **notes**).
3. Run `npm test` — the checker validates syntax, link integrity, and that your tool loads and behaves.

Full contract in [the registry section](#-the-registry-contract) below.

---

## 🏛️ For engineering leaders

**The problem:** agent teams ship fast but can't answer three questions: *Is it reliable? What did it decide and why? Is it still under budget?* Most tooling is either a heavy dashboard platform or scattered scripts that rot.

**The strategic value of `systems-bench`:**
- 🧭 **A shared vocabulary.** Every tool is tagged against **8 engineering criteria** — Reliability, Architecture & Contracts, Closed-loop Evaluation, Tooling Integration, Workflow & Orchestration, Observability, Safety & Governance, Scale & Maintainability. Teams get a common lens for "are we covering the bases?"
- 📉 **Cost & risk visibility before they hit.** Spend projection (Meter Shock), budget enforcement (Governance & Budget Caps), drift detection (Behavior Drift Monitor), and capacity math (Jeff Dean profiler) turn "we'll find out in the bill" into "we know now."
- 🔬 **Evaluation as a discipline, not an afterthought.** Golden datasets, rubric judges, failure clustering, and repair loops give you the closed feedback loop that prevents prompt/model regressions.
- 🕵️ **Observability that's actually inspectable.** Trace, decision-log, and behavior-drift tools use three documented schemas (`agentTrace`, `decisionLog`, `behaviorSnapshot`) — the same contract your own exports can follow.
- ⚖️ **Governance primitives.** HITL gates, forbidden actions, budget caps, output validation — simulated locally so you can design policy *before* wiring it into production gateways.

**Maintenance signals** (the boring, important stuff):

| Signal | Status |
|---|---|
| CI | ✅ GitHub Actions runs the full check suite on every push |
| Check suite | ✅ 35 files parsed, 33 tools load, 16 behavior assertions, renderer smoke tests |
| Dependencies | ✅ 0 (pure HTML/JS/CSS) |
| License | ✅ BSD 3-Clause |
| Inventory freshness | 🗓️ 33 tools · 32 live · 1 flagged duplicate · `lastUpdated 2026-08-01` |
| Honesty policy | ✅ planned tools are never counted as live; every live tool documents its limits in `notes` |

**Onboarding a new engineer:** clone → `python3 -m http.server 8000` → read the registry contract in this README → pick a tool card → open the single HTML file. That's the entire onboarding loop.

---

## ✍️ For journalists: Why it matters

**The hook:** Everyone is building AI agents. Almost nobody is checking them. `systems-bench` is a rare thing in the AI-tools gold rush — a project that **audited itself, admitted its registry was inflated, fixed it, and made honesty a CI-enforced policy.**

**The context, briefly:** Agentic AI (AI that calls tools and takes actions) is moving fast, and so is its tooling ecosystem. Most products sell you a dashboard and a login. `systems-bench` does the opposite: a static, open, client-side workbench — your data never leaves your browser unless you opt in with an API key.

**Why it matters:**
- 🆕 **Novel stance:** the registry refuses to count tools that don't exist. When we audited v1, 2 of 26 advertised tools were 404s and one was mislabeled. The v2 rebuild made the registry honest; v3 rebuilt the weak tools and built the missing ones (including the "Jeff Dean capacity calculator" that was promised but never built).
- 📈 **Impact shape:** 33 tools spanning evals, cost, safety, and observability — free, open, MIT-style ethos (BSD-3).
- 🎯 **Story-worthy angles:** "The AI workbench that audits itself" · "Bring your own trace: observability without a SaaS bill" · "Client-side agent safety — no telemetry, no accounts" · "A single `npm test` that checks every tool's honesty."

**Visual proof:** the live bench at [iggym.github.io/systems-bench](https://iggym.github.io/systems-bench/) renders all 33 cards with filters by engineering criterion, status, focus, and mode — a screenshot of the pegboard is the fastest way to see the collection at a glance. Each tool is one self-contained page you can open directly.

---

## 🔍 For recruiters

**30-second read.**

> **systems-bench** — a self-built, open, 33-tool workbench for agentic AI engineering. Zero dependencies, client-side, CI-tested, honestly documented. Built solo, shipped in the open.

**What this demonstrates:**
- 🛠️ **Full-stack, full-lifecycle engineering** — product thinking, systems design, testing, CI, docs, and honest self-audit.
- 🧪 **Testing discipline** — a custom check suite (syntax + link integrity + behavior tests + renderer smoke tests) runs in CI on every push.
- 📐 **Architecture sense** — single-source-of-truth data (`apps.json`), two renderers from one contract, three documented trace schemas.
- ✍️ **Communication** — the README you're reading; honest `notes` on every tool.
- ⚖️ **Engineering judgment** — deliberately flags duplicates and never inflates counts.

**Live demo:** [iggym.github.io/systems-bench](https://iggym.github.io/systems-bench/) · **Code:** [github.com/iggym/systems-bench](https://github.com/iggym/systems-bench) · **Commit history:** single-author, atomic, changelog-driven (v1 → v3.2 with dated milestones).

---

## 👔 For non-technical leaders

**The problem in plain language:** AI assistants and agents are powerful, but they can also be **expensive, unpredictable, and unsafe** if nobody checks them. The teams building them often lack simple tools to answer: *Is this costing what we expect? Did it do what we asked? Would it ever do something harmful?*

**The solution:** a free, open toolbox — like a well-organized workbench — where your team can:
- 🔍 **Test before trusting** — check how well an AI answers before shipping it.
- 💰 **Watch the budget** — see the month the bill will blow past plan, *before* it happens.
- 🛡️ **Stay safe** — simulate guardrails (approval steps, forbidden actions, budget caps) before they go live.
- 📊 **Understand what happened** — replay what an AI did step-by-step, like a black-box flight recorder.

**Why it matters to you:**
- **Business value:** catch costly errors early, control AI spend, and reduce risk — without buying another platform or trusting another black box.
- **Transparency:** everything runs in the browser, no data leaves your team, no accounts to manage.
- **Trustworthy project:** the team behind it publicly audits its own claims — even fixing its own over-counting — and enforces honesty in its automated checks.

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
| `status` | `live` (ships & links work) · `duplicate` (kept, flagged) · `planned` (never counted, never linked) |
| `mode` | `local` (no key) · `hybrid` (local works; key unlocks live) · `api` (needs keys) |
| `focus` | `evaluate` / `design` / `operate` / `describe` |
| `dimensions` | Subset of the 8 criteria the tool genuinely covers |
| `notes` | **Required** for every live/duplicate tool — specific, checkable limits |
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
| **v3.2** · 2026-08-01 | Observability expansion: `Session Cost Attributor`, `Decision Log Analyzer`, `Agent Behavior Drift Monitor`; `decisionLog` + `behaviorSnapshot` schemas |
| **v3.1** · 2026-08-01 | `Agent Trace Inspector` + shared `agentTrace` schema |
| **v3** · 2026-08-01 | Tool rebuild wave: real JSON-Schema validator, honest red-teamer, fixed EdgeGuard hedging, transparent infra-router; built the two phantom tools + the Jeff Dean capacity calculator; added orchestration designer, failure clustering, governance/budget caps; CI test suite added |
| **v2** · 2026-08-01 | Honesty pass: 26 claimed → 23 real (2 phantom, 1 mislabel), single source of truth, `notes`/statuses everywhere |
| **v1** · 2026-07-30 | Original collection (registry later audited) |

---

## 💬 Feedback

Found a bug? Want a tool? Think a `notes` line is too kind? **Say so.**

- 🐛 Open an [issue](https://github.com/iggym/systems-bench/issues) — the honesty policy applies to feedback too.
- 🧩 Open a [pull request](https://github.com/iggym/systems-bench/pulls) — a tool is one HTML file and one `apps.json` entry.
- ✨ Request a feature — the bench is intentionally extensible; new criteria, schemas, and tools land regularly.

Built solo, shipped in the open — [@iggym](https://github.com/iggym). Pull up a stool. 🪑
