# systems-bench — Improvement Tasks

Findings from a repo + site review (2026-10-06). Priorities: **P0** = correctness/trust
(the README or site claims something that isn't true), **P1** = high-value improvement,
**P2** = nice to have. Each task lists *why* and a concrete *done when*.

---

## P0 — Make the claims true

The project's brand is honesty ("zero slop", "inventory honest and intact"). These gaps
undercut that directly.

- [ ] **T01 · Make `tests/check.mjs` do what the README says it does.**
  README promises "syntax, link integrity, schema contract, and limitation notes on every
  tool" and "25 files parsed … syntax & schema assertions". The script only checks
  required fields, duplicate ids, and file existence.
  *Done when* the suite also: validates `status` ∈ {live, beta, archived}, `mode` ∈
  {local, hybrid, api}, `focus` ∈ keys of `focuses`, `dimensions` ⊆ `dimensions[].id`,
  `tags` ⊆ `tagVocabulary`, `id` matches folder name, dates are ISO `YYYY-MM-DD`;
  parses every inline `<script>` with `new Function`/`vm.Script` for syntax errors;
  checks local `href`/`src` links resolve; and fails on orphan `web-apps/*` folders not
  in `apps.json`.

- [ ] **T02 · Add the `schemas` block to `apps.json` (or fix the README).**
  README says `apps.json` declares shared `schemas` (`agentTrace`, `decisionLog`,
  `behaviorSnapshot`) "documented in apps.json → schemas" — no such key exists.
  *Done when* `apps.json.schemas` defines all three with field lists and versions, and
  `check.mjs` verifies that tools referencing a schema exist.

- [ ] **T03 · Fill in missing `updated` dates.** 9 tools lack `updated`
  (compression-ratio-benchmarker, golden-dataset-harness, llm-rubric-judge,
  mcp-schema-converter, multi-llm-arena, needle-haystack-benchmarker,
  prompt-mutation-optimizer, react-loop-visualizer, scratchpad-state-manager).
  *Done when* every entry has `updated` and the check suite requires it.

- [ ] **T04 · Remove the third-party font request or qualify "nothing phones home".**
  `index.html` loads Google Fonts, contradicting "no telemetry / nothing phones home".
  *Done when* fonts are self-hosted (or replaced with a system stack) and no external
  request is made on page load except user-initiated API calls.

- [ ] **T05 · Derive README counts instead of hard-coding them.**
  "24 tools", "31 tags", "25 files parsed", `lastUpdated 2026-08-01` are manual and will
  drift. *Done when* a script (`npm run sync-readme` or a check) verifies README numbers
  match `apps.json`.

- [ ] **T06 · Fix the `decision-log-analyzor` typo.**
  Rename folder/id to `decision-log-analyzer`, keep a redirect stub at the old path so
  existing links don't break.

---

## P1 — Site & tool UX

- [ ] **T07 · Add a "← back to bench" link and shared footer to every tool page.**
  No tool links back to the index; visitors land in a dead end (cards open in a new tab).
- [ ] **T08 · Add filters the registry already supports.**
  The bench filters by tag and status only. Add `focus` (evaluate/design/operate),
  `mode` (local/hybrid/api — "no key needed" is a key decision for users), and the
  8 engineering `dimensions`. Persist filter state in the URL query string so views are
  shareable.
- [ ] **T09 · Show `mode`, `focus`, dimension codes, and `notes` on cards.**
  The honesty `notes` and "needs API key" signal are invisible on the site. Add mode
  badge, dimension chips (REL/ARC/…), and a collapsible "limits" line.
- [ ] **T10 · Fix the card id label.** `card-id` pads the slug (`#adversarial-red-teamer`),
  which reads oddly; show a short index or the focus area instead.
- [ ] **T11 · Accessibility pass.** Visible `:focus-visible` styles on cards/inputs,
  `aria-label`s on search and selects, `aria-live` on the result count, sufficient contrast
  for `--text-mute` on cards, and keyboard-only navigation test on every tool.
- [ ] **T12 · SEO & sharing metadata.** Every tool page lacks `<meta name="description">`,
  Open Graph/Twitter tags, canonical URL, and a favicon. Generate them from `apps.json`.
  Add `sitemap.xml`, `robots.txt`, and a `404.html`.
- [ ] **T13 · Light theme support.** All pages are dark-only; add
  `prefers-color-scheme: light` tokens (shared palette, see T21).
- [ ] **T14 · "Load sample" + "Copy/Download result" consistency.** Ensure every tool has a
  one-click sample input, a reset, and an export of its output (JSON/Markdown).

---

## P1 — Content (articles)

- [ ] **T15 · Stand up `docs/articles/`** and generate the first wave with
  [`docs/master-prompt-v1.md`](../docs/master-prompt-v1.md): one `tool-deep-dive` per
  tool (24), starting with the observability set (trace-inspector,
  session-cost-attributor, decision-log-analyzor, behavior-drift-monitor).
- [ ] **T16 · Three schema guides** (`agentTrace`, `decisionLog`, `behaviorSnapshot`) —
  how to export each from common stacks and which tools consume them.
- [ ] **T17 · Eight criterion guides** (REL … SCL) mapping each criterion to its tools.
- [ ] **T18 · Playbooks** chaining tools, e.g. *trace → cost attribution → budget caps*,
  *golden dataset → rubric judge → prompt mutation*, *schema validate → repair loop*.
- [ ] **T19 · Publish articles on the site.** Add an `articles/` section (static HTML
  rendered from the Markdown, no build dependency or a tiny Node script) and link each
  tool card to its article. Add `article` field to `apps.json` entries.
- [ ] **T20 · Article lint in CI.** Validate article front matter (tool ids exist,
  dimensions valid, summary ≤ 160 chars) as part of `npm test`.

---

## P1 — Engineering & CI

- [ ] **T21 · Shared design tokens.** Tools use a GitHub-dark palette while the bench uses
  its own; extract a tiny `assets/bench.css` (tokens + base components) so tools and the
  bench look like one product. Keep tools self-contained by inlining at publish time if
  "single file" must be preserved.
- [ ] **T22 · Upgrade CI actions.** `actions/checkout@v3` and `actions/setup-node@v3` run on
  deprecated Node runtimes; bump to `@v4`, set `node-version: '22.x'`, and add
  `permissions: contents: read`.
- [ ] **T23 · Smoke-test every tool in a headless browser.** Playwright script that loads
  each `web-apps/*/index.html`, fails on console errors, clicks the primary action with
  the built-in sample, and asserts output renders. Run in CI.
- [ ] **T24 · Unit-test the core heuristics.** Extract and test the pure functions
  (schema subset validator, repair loop, critical-path calc, drift stats, Little's Law
  math, PII regexes) against fixtures so behavior changes are caught.
- [ ] **T25 · Explicit GitHub Pages deploy workflow** gated on `npm test`, so a broken
  `apps.json` can never ship.
- [ ] **T26 · Content-Security-Policy meta** on each tool restricting `connect-src` to the
  providers it actually calls (Gemini, Groq, localhost) — enforces the privacy claim.
- [ ] **T27 · Local/OpenAI-compatible endpoint support.** README recommends Ollama
  (`localhost:11434`) but live tools only call Gemini/Groq. Add a configurable
  OpenAI-compatible base URL to hybrid/api tools, or remove the claim.

---

## P2 — Repo hygiene & community

- [ ] **T28 · `CONTRIBUTING.md`** — how to add a tool (one HTML file + one `apps.json`
  entry), the honesty/`notes` policy, and the check suite.
- [ ] **T29 · Issue & PR templates** (`.github/ISSUE_TEMPLATE/`, `pull_request_template.md`)
  including a "notes updated?" checkbox.
- [ ] **T30 · `CHANGELOG.md`** split out of the README; keep `package.json` version in sync.
- [ ] **T31 · Trim `.gitignore`** — it is the generic Node template; this repo has no build.
- [ ] **T32 · Prune unused tags** from `tagVocabulary` (e.g. `hitl`, `hub`, `infrastructure`,
  `latency`) or assign them; have the check suite warn on unused vocabulary.
- [ ] **T33 · Shared `tool-template/index.html`** with header, back link, sample/reset/export
  scaffolding, and tokens — the starting point for new tools.
- [ ] **T34 · Tool roadmap.** Gaps visible against the 8 criteria: a retry/backoff &
  rate-limit simulator (TOL/REL), a tool-call permission/allowlist designer (SAF), an
  eval-results diff across runs (EVA), and an OpenTelemetry GenAI → `agentTrace`
  converter (OBS).
