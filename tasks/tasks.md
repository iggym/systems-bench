# systems-bench — Improvement Tasks

> Backlog of improvements for the repo and the live site (<https://iggym.github.io/systems-bench/>),
> from an audit of `apps.json`, `index.html`, `tests/check.mjs`, CI, the README, and the 24 tools
> under `web-apps/`. Each task gives the problem, the change, and how to know it's done.
>
> **Priority:** 🔴 P0 fixes trust or correctness · 🟠 P1 high value · 🟢 P2 nice to have
> **Size:** S (< 1h) · M (half a day) · L (1+ days)

---

## 1. Honesty & correctness (the project's core promise)

- [x] 🔴 **S — Make the README match what `npm test` actually checks.**
  The README says the suite verifies "syntax, link integrity, schema contract, and limitation notes,"
  and that "25 files parsed." `tests/check.mjs` only checks duplicate IDs, that each file exists, and
  that required fields are present. Either build the checks in §2 or reword the README until they exist.
  *Done when:* every claim about CI in the README maps to a real assertion in `tests/check.mjs`.
  ✅ *Done 2026-10-07:* README now describes the checks that exist (see §2).

- [x] 🔴 **S — Fix `mode` for `adversarial-red-teamer`.** It's registered as `local`, but its
  description and notes describe an optional live probe that needs a Gemini key, so it is really
  `hybrid`. *Done when:* `mode: "hybrid"`, and a test fails if a `local` tool contains a provider API URL.
  ✅ *Done 2026-10-07:* `mode: "hybrid"`; CI fails any `local` tool whose page calls a provider API.

- [x] 🔴 **M — Fix MCP Client Inspector's Gemini branch.** Its own `notes` say it "drops enums and
  mishandles array-of-object." Fix the converter, add fixture tests, then update `notes`.
  *Done when:* enum and `array<object>` fixtures produce valid Gemini `FunctionDeclarations`.
  ✅ *Done 2026-10-07:* Gemini output now uses a name→schema `properties` map with `required`, keeps enums (`format: enum`), and handles `array<object>`; covered by `tests/fixtures/mcp-schema-converter.mjs`.

- [ ] 🟠 **S — Rename the `decision-log-analyzor` slug to `decision-log-analyzer`.** Move the folder,
  update `id`/`url`, and leave a small redirect `index.html` at the old path so existing links keep working.

- [x] 🟠 **S — Fill in the missing `updated` fields.** Nine entries don't have one
  (`compression-ratio-benchmarker`, `golden-dataset-harness`, `llm-rubric-judge`, `mcp-schema-converter`,
  `multi-llm-arena`, `needle-haystack-benchmarker`, `prompt-mutation-optimizer`, `react-loop-visualizer`,
  `scratchpad-state-manager`). Add it to the required fields, or set `updated = dateAdded` by default.
  ✅ *Done 2026-10-07:* Missing `updated` set to `dateAdded`; `updated` is now a required field.

- [ ] 🟠 **S — Clean up `tagVocabulary` and `focuses`.** The tags `hitl`, `hub`, `infrastructure`, and
  `latency` aren't used by any tool. The `describe` focus has no tools either. Apply the obvious tags
  (`latency` → latency profiler and EdgeGuard; `hitl` → governance and workflow designer), and remove
  anything still unused or mark it reserved.

- [x] 🔴 **S — Add the `schemas` block the README promises.** The README says the shared schemas
  are "documented in `apps.json → schemas`," but there is no `schemas` key in `apps.json`. Add
  `agentTrace` v1, `decisionLog` v1, and `behaviorSnapshot` v1 (fields + version), or fix the README.
  *Done when:* the key exists and a test checks that it lists the three schemas.
  ✅ *Done 2026-10-07:* `apps.json → schemas` defines `agentTrace`, `decisionLog`, `behaviorSnapshot` (fields taken from the tools' parsers); CI checks the block and its consumers.

- [x] 🟢 **S — Bump `lastUpdated`** in `apps.json` (still `2026-08-01`) and add a test that it is
  ≥ the newest `updated` date.
  ✅ *Done 2026-10-07:* `lastUpdated` bumped; CI fails if any tool's `updated` is later than it.

## 2. Test suite & CI (`tests/check.mjs`, `.github/workflows/ci.yml`)

- [x] 🔴 **M — Enforce the registry contract** that the README describes:
  - `tags` ⊆ `tagVocabulary`; `dimensions` ⊆ the `dimensions[].id`; `focus` ∈ keys of `focuses`
  - `mode` ∈ {`local`,`hybrid`,`api`}; `status` ∈ {`live`,`beta`,`archived`}
  - `id` matches the folder name in `url`; dates are valid `YYYY-MM-DD`; `updated ≥ dateAdded`
  - `notes` has a minimum length (so it can't be an empty placeholder)
  - every folder in `web-apps/` is registered (no orphan tools)
  ✅ *Done 2026-10-07:* All listed rules enforced in `tests/check.mjs`.
- [x] 🔴 **M — Add a JS syntax check.** Pull each inline `<script>` out of every HTML file and parse it
  with `new Function()` or `node --check` on a temp file, so a broken tool fails CI.
  ✅ *Done 2026-10-07:* Every inline `<script>` in all 25 HTML files is compiled with `vm.Script`. It immediately caught a real syntax error (see §8).
- [x] 🟠 **M — Check links.** Verify that every relative `href`/`src` in every HTML file resolves, and
  flag any external script/style origin that isn't on an allowlist (keeps the zero-dependency claim honest).
  ✅ *Done 2026-10-07:* Relative `href`/`src` must resolve; external `<script src>` and known tracking/challenge snippets fail CI. (A full origin allowlist for fonts/styles is still open under §3 fonts.)
- [ ] 🟠 **L — Add headless smoke tests (Playwright).** Load each tool, fail on any console error, click
  the primary action using the built-in sample input, and check that the output area isn't empty. Load
  `index.html` and check that it renders 24 cards and the filters work.
- [ ] 🟠 **S — Update the GitHub Actions versions** from `actions/checkout@v3` / `setup-node@v3` to v4,
  and pin Node to the current LTS.
- [ ] 🟠 **M — Unit-test the core heuristics.** Pull the pure functions out into testable form
  (schema-subset validator, repair loop, critical-path calculation, drift statistics, Little's Law
  math, PII regexes) and test them against fixtures, so a behavior change can't slip through silently.
- [ ] 🟢 **S — Set `permissions: contents: read`** in `ci.yml` (least privilege for the workflow token).
- [ ] 🟢 **S — Add an HTML validity / a11y lint** (e.g. `html-validate`, or `axe` in the Playwright
  run) as a non-blocking job first.
- [ ] 🟢 **S — Add a Pages deploy workflow** that only publishes after checks pass (instead of the
  default branch-publish), plus a status badge.

## 3. Site — the bench (`index.html`)

- [x] 🔴 **S — Fix the card ID label.** `(a.id).padStart(3,'0')` gets applied to the slug, so cards show
  `#adversarial-red-teamer` and not a short number. Use a stable index or a short code.
  ✅ *Done 2026-10-07:* Cards show a stable registry number (`#001`–`#024`) with the slug as tooltip.
- [ ] 🟠 **M — Add filters for focus, mode, and dimension.** These are the registry's most useful axes
  (Evaluate/Design/Operate, "no key needed," REL…SCL), but you can only filter by tag and status today.
  The status filter has a single value (`live`), so it does very little.
- [ ] 🟠 **S — Show `mode` and `notes` on each card.** Add a "no key / key optional / key required"
  badge and an expandable "Limitations" line. Showing limitations up front is the project's whole point,
  but the site currently hides them.
- [ ] 🟠 **S — Group cards by focus** (Evaluate / Design / Operate sections) to match the README.
- [ ] 🟠 **S — Keep filter state in the URL** (`?focus=operate&mode=local&q=trace`) so filtered views can be shared.
- [ ] 🟠 **S — Add SEO and social metadata:** Open Graph / Twitter tags, a canonical URL, a favicon,
  and an OG image. Update the title/description to match the README's positioning ("agentic AI systems").
- [ ] 🟢 **S — Use `<a target="_blank">` only for external links.** Tools currently open in a new tab
  from the bench. Consider same-tab navigation plus a back link (see §4).
- [ ] 🟢 **S — Add a "Start here" strip** with three recommended entry tools for first-time visitors,
  plus links to the 8 criteria and the shared schemas.
- [ ] 🟢 **M — Add a criteria coverage matrix page:** tools × 8 dimensions, generated from `apps.json`.
- [ ] 🟠 **S — Accessibility pass on the bench.** Add visible `:focus-visible` styles to cards and inputs,
  `aria-label`s on the search box and selects, and `aria-live` on the result count. Check the contrast
  of `--text-mute` on cards, and test keyboard-only navigation.
- [ ] 🟢 **S — Add a `404.html`** that links back to the bench.
- [ ] 🟢 **M — Support a light theme** via `prefers-color-scheme` on the bench and the tools
  (share the tokens from the §4 visual-system task).
- [ ] 🟢 **S — Load fonts locally or add a system-font fallback**, so the bench makes no third-party
  requests (matching "nothing phones home"), or document the Google Fonts request in the README.

## 4. Tools — consistency across `web-apps/*`

- [ ] 🟠 **M — Add a shared header/back link** ("← systems-bench") to all 24 tools. None of them link
  back to the bench right now.
- [ ] 🟠 **S — Add a `<meta name="description">`** to every tool (none have one) and standardize
  `<title>` as `<Tool name> — systems-bench` (several don't follow this, e.g. AI Infra Router).
- [ ] 🟠 **M — Add a "Limitations" panel to each tool** that shows the same text as its `notes` field,
  so users see the boundaries inside the tool too. Add a test that keeps the two in sync.
- [ ] 🟠 **M — Make the visual system consistent.** The bench uses an industrial theme (Big Shoulders /
  IBM Plex, orange/teal) while the tools use a GitHub-dark palette. Pick one set of tokens and apply it everywhere.
- [ ] 🟢 **M — Make model IDs configurable.** Gemini model names (`gemini-2.5-flash`, `gemini-2.5-pro`)
  are hard-coded in several tools. Put them in a model dropdown with a free-text override.
- [ ] 🟢 **M — Support OpenAI-compatible local endpoints** (Ollama / llama.cpp at `localhost:11434`)
  in hybrid tools. The README recommends this, but most tools don't support it.
- [ ] 🟢 **S — Add "Load sample" and "Copy/Download result"** buttons to every tool that's missing them.
- [ ] 🟠 **S — Add a Content-Security-Policy `<meta>` to each tool** that limits `connect-src` to the
  providers the tool actually calls (Gemini, Groq, and later localhost). This enforces the
  "nothing phones home" claim in the browser, not just in the docs.
- [ ] 🟢 **S — Add a `tool-template/index.html`** with the shared header and back link, the
  sample/reset/export scaffolding, design tokens, and a limitations panel. New tools start from it.
- [ ] 🟢 **M — Replace the token heuristic** (~1.33 tokens/word, used in several tools) with an
  optional bundled BPE tokenizer, keeping the heuristic as a labeled fallback.

## 5. Content — articles & docs

- [ ] 🟠 **L — Launch an articles section.** *(In progress: 6 articles in `articles/`, indexed in `articles/metadata.json`; rendering them on the site and linking from cards is still open.)* Generate one deep-dive per tool with
  `docs/master-prompt-v1.md`, store them in `articles/<tool-id>.md`, render them as static pages, and
  add a "Read the guide" link on each card. Add an optional `article` field to `apps.json`.
- [ ] 🟠 **M — Write the cross-cutting articles** *(In progress: "Debug an expensive agent session" and "Calibration: when agent confidence lies" are published, plus an `agentTrace` schema guide.)* from the backlog in the master prompt (debugging an
  expensive session, a prompt regression gate, trustworthy structured outputs, context engineering, calibration).
- [x] 🟠 **S — Add a test for articles:** front matter `tool_id` exists in `apps.json`, `tags` ⊆
  vocabulary, `dimensions` match, and `prompt_version` is set.
  ✅ *Done 2026-10-07:* `articles/metadata.json` is validated: files exist, tool ids and dimension codes are real, summary ≤ 160 chars, front-matter slug and `prompt_version` match, a limitations section is present, and every `.md` is listed.
- [ ] 🟠 **M — Publish the shared schemas as JSON Schema files** (`schemas/agentTrace.v1.json`, etc.)
  with example payloads, and validate the tools' sample inputs against them in CI.
- [ ] 🟢 **S — Add `CONTRIBUTING.md`** (how to add a tool: one HTML file + one `apps.json` entry +
  `notes`; the honesty rules), issue/PR templates, and `CODE_OF_CONDUCT.md`.
- [ ] 🟢 **S — Add `SECURITY.md`** covering API-key handling and how to report a vulnerability.
- [ ] 🟢 **S — Generate the README's tool tables from `apps.json`** with a script (including the
  hard-coded counts: "24 tools", "31 tags", the `lastUpdated` date, and the badge), and fail CI if they
  drift, so the "single source of truth" rule also covers the docs.
- [ ] 🟢 **S — Add a `CHANGELOG.md`** and move the changelog table out of the README; tag releases
  (`v3.3.0` matches `package.json`).

## 6. Distribution & community

- [ ] 🟢 **S — Add `sitemap.xml` and `robots.txt`** listing the bench, the tools, and the articles.
- [ ] 🟢 **S — Add an RSS/Atom feed** for new tools and articles.
- [ ] 🟢 **S — Add GitHub topics and a social preview image** to the repo.
- [ ] 🟢 **M — Add a "Request a tool" issue form** with fields that match the `apps.json` contract.

- [ ] 🟢 **S — Trim `.gitignore`.** It's the generic Node template, and this repo has no build step.

## 7. Tool roadmap (gaps against the 8 criteria)

- [ ] 🟢 **M — Retry/backoff & rate-limit simulator** (TOL, REL): model retry storms, jitter, and
  429 handling against a request log.
- [ ] 🟢 **M — Tool-call permission / allowlist designer** (SAF, TOL): define per-tool scopes and
  test a trace against them.
- [ ] 🟢 **M — Eval run diff** (EVA): compare two golden-set or rubric runs and surface regressions.
- [ ] 🟢 **M — OpenTelemetry GenAI → `agentTrace` converter** (OBS): turn standard OTel GenAI spans
  into the bench's trace schema, so the observability tools work on real exports.

---

## 8. Found and fixed during the 2026-10-07 pass

These weren't in the original audit. The new checks or the article walkthroughs turned them up.

- [x] 🔴 **Context Budgeting & Compactor was completely broken.** A misplaced `)` inside a template
  literal was a syntax error, so the whole script failed to load on the live site. Caught by the new
  inline-script syntax check.
- [x] 🔴 **Injected third-party scripts in 14 tools.** Pages carried a Cloudflare challenge-platform
  snippet (`/cdn-cgi/challenge-platform/...`) left over from wherever they were first saved, which
  contradicts "no telemetry." Removed. CI now fails on that snippet and on any external `<script src>`.
- [x] 🔴 **JSON Schema Repair Loop broke its own "never force a value" promise.** "No safe repair"
  cases (pattern/length/const) overwrote the field with `undefined`. Min/max clamps were no-ops.
  Enum nearest-match always picked *some* value, however distant. A missing field without a default
  got coerced to the string `"null"`. All fixed and covered by `tests/fixtures/schema-repair-engine.mjs`.
- [x] 🔴 **Agent Trace Inspector crashed on traces without `startedAt`**, which the schema allows.
  Untimed traces are now laid out in tree order. Covered by `tests/fixtures/trace-inspector.mjs`.
- [x] 🟠 **Registry text corrected** to match the code: Trace Inspector span types (no `hitl` type),
  the double-counting caveat for rolled-up parent costs, and the Repair Loop's new behavior.

### Follow-ups surfaced by this pass

- [ ] 🟠 **S — Governance & Budget Caps: output validation is substring-based.** `required_keys`
  matches any occurrence of the text. Parse JSON when the output is JSON. Also consider checking
  `must_not_contain` before `required_keys`, so leaks are reported as leaks.
- [ ] 🟠 **S — Trace Inspector / Session Cost Attributor: support `hitl` and `retrieval` span types**
  (currently shown as `other`). Optionally detect rolled-up parent costs and warn about them.
- [ ] 🟢 **S — Decision Log Analyzer: report `partial` outcomes separately**, not just as failures.
- [ ] 🟢 **S — Run the Playwright smoke test in CI.** Every page now loads without errors locally;
  the script used for this pass can become `tests/smoke.mjs` (see §2 headless smoke tests).

## Suggested order

1. ~~§1 honesty fixes and the §2 registry-contract tests~~ (done 2026-10-07; see §8). Next: §2 smoke tests and CI action upgrades.
2. §3 card ID fix, the focus/mode filters, and limitations on cards.
3. §4 back links, meta descriptions, and limitations panels.
4. §5 articles pipeline, using `docs/master-prompt-v1.md`.
5. Everything else, as capacity allows.
