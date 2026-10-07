import fs from 'fs';
import path from 'path';
import vm from 'vm';

const rootDir = path.resolve('.');
const appsJsonPath = path.join(rootDir, 'apps.json');

console.log('--- systems-bench CI check suite ---');

let errors = 0;
let checks = 0;
const fail = msg => { console.error(`FAIL: ${msg}`); errors++; };
const check = (cond, msg) => { checks++; if (!cond) fail(msg); return cond; };

if (!fs.existsSync(appsJsonPath)) {
  console.error('FAIL: apps.json not found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(appsJsonPath, 'utf8'));
const apps = data.apps;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = d => DATE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));

// ---------- 1. Registry contract ----------
console.log(`\n[1] registry contract — ${apps.length} tools`);

const dimensionIds = new Set((data.dimensions || []).map(d => d.id));
const focusKeys = new Set(Object.keys(data.focuses || {}));
const vocab = new Set(data.tagVocabulary || []);
const MODES = new Set(['local', 'hybrid', 'api']);
const STATUSES = new Set(['live', 'beta', 'archived']);
const REQUIRED = ['id', 'name', 'url', 'description', 'tags', 'status', 'mode', 'focus', 'dimensions', 'notes', 'dateAdded', 'updated'];
const MIN_NOTES = 40;

check(dimensionIds.size === 8, `expected 8 dimensions, found ${dimensionIds.size}`);
check(validDate(data.lastUpdated), `lastUpdated is not a valid YYYY-MM-DD date: ${data.lastUpdated}`);

const ids = new Set();
const usedTags = new Set();
for (const app of apps) {
  const who = app.id || '(missing id)';
  check(!ids.has(app.id), `duplicate ID ${app.id}`);
  ids.add(app.id);

  for (const field of REQUIRED) {
    check(app[field] !== undefined && app[field] !== '' && !(Array.isArray(app[field]) && !app[field].length),
      `${who} missing required field: ${field}`);
  }

  check(fs.existsSync(path.join(rootDir, app.url || '')), `missing file for ${who}: ${app.url}`);
  check(app.url === `web-apps/${app.id}/index.html`, `${who}: url must be web-apps/${app.id}/index.html (got ${app.url})`);
  check(MODES.has(app.mode), `${who}: invalid mode "${app.mode}"`);
  check(STATUSES.has(app.status), `${who}: invalid status "${app.status}"`);
  check(focusKeys.has(app.focus), `${who}: focus "${app.focus}" not in focuses`);
  for (const t of app.tags || []) { usedTags.add(t); check(vocab.has(t), `${who}: tag "${t}" not in tagVocabulary`); }
  for (const d of app.dimensions || []) check(dimensionIds.has(d), `${who}: unknown dimension "${d}"`);
  check(typeof app.notes === 'string' && app.notes.trim().length >= MIN_NOTES, `${who}: notes shorter than ${MIN_NOTES} chars`);
  check(validDate(app.dateAdded), `${who}: invalid dateAdded ${app.dateAdded}`);
  check(validDate(app.updated), `${who}: invalid updated ${app.updated}`);
  check(!(app.updated < app.dateAdded), `${who}: updated (${app.updated}) is before dateAdded (${app.dateAdded})`);
  check(!(data.lastUpdated < app.updated), `${who}: updated (${app.updated}) is after registry lastUpdated (${data.lastUpdated})`);
}

for (const t of vocab) check(usedTags.has(t), `tagVocabulary entry "${t}" is not used by any tool`);
for (const f of focusKeys) check(apps.some(a => a.focus === f), `focus "${f}" has no tools`);

const webAppsDir = path.join(rootDir, 'web-apps');
for (const dir of fs.readdirSync(webAppsDir)) {
  if (fs.statSync(path.join(webAppsDir, dir)).isDirectory()) check(ids.has(dir), `orphan tool folder not in apps.json: web-apps/${dir}`);
}

// ---------- 2. Shared schemas ----------
console.log('[2] shared schemas');
const SCHEMAS = { agentTrace: 'span', decisionLog: 'decision', behaviorSnapshot: 'point' };
for (const [name, itemKey] of Object.entries(SCHEMAS)) {
  const s = (data.schemas || {})[name];
  if (!check(s, `apps.json → schemas.${name} is missing`)) continue;
  check(s.version === 1, `schemas.${name}.version must be 1`);
  check(s.root && s[itemKey], `schemas.${name} must define root and ${itemKey} fields`);
  for (const c of s.consumers || []) check(ids.has(c), `schemas.${name} consumer "${c}" is not a registered tool`);
}

// ---------- 3. HTML: syntax, injected scripts, network honesty ----------
console.log('[3] HTML files — inline JS syntax, injected scripts, provider calls');
const PROVIDER_HOSTS = /https:\/\/(generativelanguage\.googleapis\.com|api\.groq\.com|api\.openai\.com|api\.anthropic\.com)/;
const INJECTED = /cdn-cgi\/challenge-platform|__CF\$cv\$params/;
const htmlFiles = ['index.html', ...apps.map(a => a.url)].filter(f => fs.existsSync(path.join(rootDir, f)));
let scriptsParsed = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(rootDir, file), 'utf8');
  const scriptRe = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(html))) {
    const attrs = m[1] || '';
    if (/\ssrc=/.test(attrs) || /type=["'](?!text\/javascript|module)/i.test(attrs)) continue;
    try { new vm.Script(m[2], { filename: file }); scriptsParsed++; }
    catch (e) { fail(`${file}: inline script syntax error — ${e.message}`); }
    checks++;
  }
  check(!INJECTED.test(html), `${file}: contains an injected third-party challenge script`);
  check(!/<script[^>]+src=["']https?:/i.test(html), `${file}: loads an external script (zero-dependency rule)`);
}
for (const app of apps) {
  const html = fs.readFileSync(path.join(rootDir, app.url), 'utf8');
  if (app.mode === 'local') check(!PROVIDER_HOSTS.test(html), `${app.id}: mode is "local" but the file calls an LLM provider API`);
  else check(PROVIDER_HOSTS.test(html), `${app.id}: mode is "${app.mode}" but no provider API call was found`);
}

// ---------- 4. Tool logic fixtures ----------
console.log('[4] tool logic fixtures');
function loadPure(file) {
  const html = fs.readFileSync(path.join(rootDir, file), 'utf8');
  const m = html.match(/\/\/ @pure-start[\s\S]*?\/\/ @pure-end/);
  if (!m) { fail(`${file}: no // @pure-start … // @pure-end block`); return null; }
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[0], ctx);
  return ctx;
}

const mcp = loadPure('web-apps/mcp-schema-converter/index.html');
if (mcp) {
  const tool = {
    name: 'search',
    args: {
      tier: { type: 'string', enum: ['free', 'pro'], required: true },
      limit: { type: 'integer', default: 10 },
      filters: { type: 'array', items: { type: 'object', properties: {
        field: { type: 'string', required: true },
        op: { type: 'string', enum: ['eq', 'lt', 'gt'] }
      } } }
    }
  };
  const g = JSON.parse(JSON.stringify(mcp.compileTool(tool, 'gemini')));
  check(g.parameters.type === 'OBJECT', 'mcp/gemini: root type must be OBJECT');
  check(!Array.isArray(g.parameters.properties), 'mcp/gemini: properties must be a map, not an array');
  check(JSON.stringify(g.parameters.properties.tier.enum) === '["free","pro"]', 'mcp/gemini: enum dropped');
  check(JSON.stringify(g.parameters.required) === '["tier"]', 'mcp/gemini: required list wrong');
  const item = (g.parameters.properties.filters.items || {});
  check(item.type === 'OBJECT' && item.properties && item.properties.field.type === 'STRING', 'mcp/gemini: array<object> items not converted');
  check(item.properties && JSON.stringify(item.properties.op.enum) === '["eq","lt","gt"]', 'mcp/gemini: nested enum dropped');
  check(JSON.stringify(item.required) === '["field"]', 'mcp/gemini: nested required list wrong');
  check(g.parameters.properties.limit.default === undefined, 'mcp/gemini: default should be omitted');

  const o = JSON.parse(JSON.stringify(mcp.compileTool(tool, 'openai')));
  check(o.parameters.type === 'object' && o.parameters.properties.limit.default === 10, 'mcp/openai: default lost');
  check(o.parameters.properties.filters.items.properties.op.enum.length === 3, 'mcp/openai: nested enum dropped');
}

const rep = loadPure('web-apps/schema-repair-engine/index.html');
if (rep) {
  const schema = { type: 'object', required: ['status', 'name', 'retries', 'tier'], additionalProperties: false, properties: {
    status: { type: 'string', enum: ['success', 'error'] },
    name: { type: 'string' },
    retries: { type: 'integer', minimum: 0, maximum: 5 },
    tier: { type: 'string', enum: ['free', 'pro'], default: 'free' },
    code: { type: 'string', pattern: '^[A-Z]{3}$' }
  } };
  const input = { status: 'SUCESS', retries: '42', code: 'abc', extra: 1 };
  const r = JSON.parse(JSON.stringify(rep.repairLoop(schema, input, 5)));
  check(input.retries === '42' && input.extra === 1, 'repair: input payload was mutated');
  check(r.current.status === 'success', 'repair: close enum typo not nearest-matched');
  check(r.current.retries === 5, `repair: string "42" should coerce then clamp to 5 (got ${JSON.stringify(r.current.retries)})`);
  check(r.current.tier === 'free', 'repair: missing key with default not inserted');
  check(!('extra' in r.current), 'repair: extra property not stripped');
  check(!('name' in r.current), 'repair: missing key without default must not be invented');
  check(r.current.code === 'abc', 'repair: unresolvable PATTERN must leave the value unchanged');
  check(!r.converged && r.residual.length === 2, `repair: expected 2 residual violations (got ${r.residual.length})`);
  check(r.log.filter(l => l.unresolved).length === 2, 'repair: unresolved violations not logged once each');
  const far = JSON.parse(JSON.stringify(rep.repairLoop({ type: 'string', enum: ['ok', 'error'] }, 'banana', 3)));
  check(far.current === 'banana' && !far.converged, 'repair: distant enum value must not be force-matched');
}

const cap = loadPure('web-apps/latency-capacity-profiler/index.html');
if (cap) {
  // 5000 × 8 KiB + 800 × 32 KiB = 67,174,400 B/s ≈ 0.537 Gbps on a 10 Gbps (1.25 GB/s) link
  const m = cap.capacityModel({ readQps: 5000, readKb: 8, writeQps: 800, writeKb: 32, rttMs: 0.5, linkGbps: 10 });
  check(m.linkBytesPerS === 1.25e9, `capacity: 10 Gbps must be 1.25e9 B/s (got ${m.linkBytesPerS})`);
  check(Math.abs(m.util - 67174400 / 1.25e9) < 1e-9, `capacity: utilization wrong (got ${m.util})`);
  check(Math.abs(m.requiredGbps - 0.5373952) < 1e-9, `capacity: required Gbps wrong (got ${m.requiredGbps})`);
  check(m.bytesInFlight === 625000, `capacity: in-flight bytes (BDP) wrong (got ${m.bytesInFlight})`);
}

// ---------- 5. Articles ----------
const articlesDir = path.join(rootDir, 'articles');
const metaPath = path.join(articlesDir, 'metadata.json');
if (fs.existsSync(metaPath)) {
  console.log('[5] articles');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const codes = new Map((data.dimensions || []).map(d => [d.code, d.id]));
  const slugs = new Set();
  for (const a of meta.articles || []) {
    const who = `article ${a.slug}`;
    check(!slugs.has(a.slug), `${who}: duplicate slug`);
    slugs.add(a.slug);
    const file = path.join(articlesDir, a.file || '');
    if (!check(a.file && fs.existsSync(file), `${who}: file ${a.file} not found`)) continue;
    const md = fs.readFileSync(file, 'utf8');
    const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
    check(fm.includes(`slug: "${a.slug}"`), `${who}: front matter slug does not match metadata.json`);
    check(fm.includes(`prompt_version: "${a.prompt_version}"`), `${who}: prompt_version mismatch`);
    check(validDate(a.date), `${who}: invalid date`);
    for (const t of a.tools || []) check(ids.has(t), `${who}: unknown tool "${t}"`);
    for (const t of a.tags || []) check(vocab.has(t), `${who}: tag "${t}" not in tagVocabulary`);
    for (const c of a.dimensions || []) check(codes.has(c), `${who}: unknown dimension code "${c}"`);
    if (a.type === 'tool-deep-dive') {
      const tool = apps.find(x => x.id === a.tools[0]);
      if (tool) {
        const want = tool.dimensions.map(d => [...codes].find(([, id]) => id === d)[0]).sort().join(',');
        check([...a.dimensions].sort().join(',') === want, `${who}: dimensions must match ${tool.id} (${want})`);
        check(md.includes(tool.url), `${who}: does not link to ${tool.url}`);
      }
    }
    check(/## .*Limitations/i.test(md) || a.type !== 'tool-deep-dive', `${who}: missing Limitations section`);
  }
  for (const f of fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'))) {
    check((meta.articles || []).some(a => a.file === f), `articles/${f} is not listed in metadata.json`);
  }
}

console.log(`\n${htmlFiles.length} HTML files scanned · ${scriptsParsed} inline scripts parsed · ${checks} assertions`);
if (errors > 0) {
  console.error(`\nFAILED with ${errors} error(s).`);
  process.exit(1);
}
console.log(`\nSUCCESS: All ${apps.length} tools verified.`);
