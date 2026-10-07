import fs from 'fs';
import path from 'path';
import vm from 'vm';

const rootDir = path.resolve('.');
const appsJsonPath = path.join(rootDir, 'apps.json');

console.log('--- systems-bench CI check suite ---');

if (!fs.existsSync(appsJsonPath)) {
  console.error('FAIL: apps.json not found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(appsJsonPath, 'utf8'));
const apps = data.apps;

let errors = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); errors++; };
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));

// ---------- 1. Registry contract ----------
console.log(`Checking registry contract for ${apps.length} tools...`);

const STATUSES = ['live', 'beta', 'archived'];
const MODES = ['local', 'hybrid', 'api'];
const focusKeys = Object.keys(data.focuses || {});
const dimensionIds = (data.dimensions || []).map(d => d.id);
const vocab = new Set(data.tagVocabulary || []);
const requiredFields = ['id', 'name', 'url', 'description', 'tags', 'status', 'mode', 'focus', 'dimensions', 'notes', 'dateAdded', 'updated'];

if (!isDate(data.lastUpdated)) fail('apps.json lastUpdated is not a YYYY-MM-DD date');

const ids = new Set();
for (const app of apps) {
  for (const field of requiredFields) {
    if (!app[field] || (Array.isArray(app[field]) && !app[field].length)) fail(`${app.id} missing required field: ${field}`);
  }
  if (ids.has(app.id)) fail(`duplicate ID ${app.id}`);
  ids.add(app.id);

  if (!fs.existsSync(path.join(rootDir, app.url || ''))) fail(`missing file for ${app.id}: ${app.url}`);
  if (app.url !== `web-apps/${app.id}/index.html`) fail(`${app.id}: url must be web-apps/${app.id}/index.html (got ${app.url})`);
  if (!STATUSES.includes(app.status)) fail(`${app.id}: status "${app.status}" not in ${STATUSES.join('|')}`);
  if (!MODES.includes(app.mode)) fail(`${app.id}: mode "${app.mode}" not in ${MODES.join('|')}`);
  if (!focusKeys.includes(app.focus)) fail(`${app.id}: focus "${app.focus}" not in focuses`);
  for (const d of app.dimensions || []) if (!dimensionIds.includes(d)) fail(`${app.id}: unknown dimension "${d}"`);
  for (const t of app.tags || []) if (!vocab.has(t)) fail(`${app.id}: tag "${t}" not in tagVocabulary`);
  if (app.dateAdded && !isDate(app.dateAdded)) fail(`${app.id}: dateAdded is not YYYY-MM-DD`);
  if (app.updated && !isDate(app.updated)) fail(`${app.id}: updated is not YYYY-MM-DD`);
  if (isDate(app.dateAdded) && isDate(app.updated) && app.updated < app.dateAdded) fail(`${app.id}: updated is earlier than dateAdded`);
  if (isDate(app.updated) && isDate(data.lastUpdated) && app.updated > data.lastUpdated) fail(`${app.id}: updated is later than apps.json lastUpdated`);
  if ((app.notes || '').length < 40) fail(`${app.id}: notes must state specific limitations (>= 40 chars)`);
}

// every tool folder is registered
for (const dir of fs.readdirSync(path.join(rootDir, 'web-apps'))) {
  if (fs.statSync(path.join(rootDir, 'web-apps', dir)).isDirectory() && !ids.has(dir)) fail(`orphan tool folder not in apps.json: web-apps/${dir}`);
}

// shared schemas declared, and their consumers exist
for (const name of ['agentTrace', 'decisionLog', 'behaviorSnapshot']) {
  const schema = (data.schemas || {})[name];
  if (!schema) { fail(`apps.json schemas.${name} missing`); continue; }
  if (!schema.version) fail(`schemas.${name}.version missing`);
  for (const c of schema.consumers || []) if (!ids.has(c)) fail(`schemas.${name} consumer "${c}" is not a registered tool`);
}

// ---------- 2. HTML: script syntax, links, privacy ----------
const htmlFiles = ['index.html', ...apps.map(a => a.url)].filter(f => fs.existsSync(path.join(rootDir, f)));
console.log(`Parsing ${htmlFiles.length} HTML files (inline script syntax, local links, external origins)...`);

const PROVIDER_URL = /generativelanguage\.googleapis\.com|api\.groq\.com|api\.openai\.com|api\.anthropic\.com/;
const appByUrl = Object.fromEntries(apps.map(a => [a.url, a]));
let scriptCount = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(rootDir, file), 'utf8');

  // inline <script> blocks must compile
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs) || /type=["'](?!text\/javascript|module)/.test(attrs)) continue;
    scriptCount++;
    try { new vm.Script(m[2], { filename: file }); }
    catch (e) { fail(`${file}: inline script syntax error — ${e.message}`); }
  }

  // no external scripts, no injected challenge/analytics snippets
  for (const m of html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)) {
    if (/^(https?:)?\/\//.test(m[1])) fail(`${file}: external script ${m[1]} (tools must be zero-dependency)`);
  }
  if (/cdn-cgi\/challenge-platform|googletagmanager|google-analytics/.test(html)) fail(`${file}: contains a third-party tracking/challenge snippet`);

  // relative href/src must resolve
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"'#?]+)[^"']*["']/gi)) {
    const ref = m[1];
    if (/^(https?:|mailto:|data:|javascript:|\/\/)/.test(ref) || ref.includes("' +")) continue;
    const target = path.resolve(path.dirname(path.join(rootDir, file)), ref);
    if (!fs.existsSync(target)) fail(`${file}: broken local link "${ref}"`);
  }

  // a tool registered as local must not call model providers
  const app = appByUrl[file];
  if (app && app.mode === 'local' && PROVIDER_URL.test(html)) fail(`${app.id}: mode is "local" but the page calls a model provider API — use "hybrid" or "api"`);
}
console.log(`  ${scriptCount} inline scripts compiled.`);

// ---------- 3. Tool fixtures ----------
const fixtureDir = path.join(rootDir, 'tests', 'fixtures');
if (fs.existsSync(fixtureDir)) {
  for (const f of fs.readdirSync(fixtureDir).filter(f => f.endsWith('.mjs')).sort()) {
    const mod = await import(path.join(fixtureDir, f));
    const results = await mod.default({ rootDir, vm });
    for (const r of results) if (!r.ok) fail(`fixture ${f}: ${r.name} — ${r.detail || 'failed'}`);
    console.log(`  fixture ${f}: ${results.filter(r => r.ok).length}/${results.length} passed`);
  }
}

// ---------- 4. Articles ----------
const articlesDir = path.join(rootDir, 'articles');
const metaPath = path.join(articlesDir, 'metadata.json');
if (fs.existsSync(metaPath)) {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const list = meta.articles || [];
  console.log(`Checking ${list.length} articles against articles/metadata.json...`);
  const slugs = new Set();
  const codes = new Set((data.dimensions || []).map(d => d.code));
  for (const a of list) {
    if (slugs.has(a.slug)) fail(`article duplicate slug ${a.slug}`);
    slugs.add(a.slug);
    const file = path.join(articlesDir, a.file || '');
    if (!a.file || !fs.existsSync(file)) { fail(`article ${a.slug}: file ${a.file} missing`); continue; }
    for (const t of a.tools || []) if (!ids.has(t)) fail(`article ${a.slug}: unknown tool "${t}"`);
    for (const c of a.dimensions || []) if (!codes.has(c)) fail(`article ${a.slug}: unknown dimension code "${c}"`);
    if (!a.summary || a.summary.length > 160) fail(`article ${a.slug}: summary missing or > 160 chars`);
    if (!isDate(a.date)) fail(`article ${a.slug}: date is not YYYY-MM-DD`);

    // front matter must agree with metadata.json
    const md = fs.readFileSync(file, 'utf8');
    const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1];
    if (!fm) { fail(`article ${a.slug}: no front matter`); continue; }
    const field = (k) => ((fm.match(new RegExp('^' + k + ':\\s*"?([^"\\n]*)"?', 'm')) || [])[1] || '').trim();
    if (field('slug') !== a.slug) fail(`article ${a.slug}: front matter slug "${field('slug')}" differs from metadata.json`);
    if (field('prompt_version') !== a.promptVersion) fail(`article ${a.slug}: prompt_version differs from metadata.json`);
    if (!/limitations/i.test(md)) fail(`article ${a.slug}: missing a limitations section`);
  }
  for (const f of fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'))) {
    if (!list.some(a => a.file === f)) fail(`articles/${f} is not listed in articles/metadata.json`);
  }
}

if (errors > 0) {
  console.error(`\nFAILED with ${errors} error(s).`);
  process.exit(1);
}

console.log(`\nSUCCESS: All ${apps.length} tools verified. Zero slop. Inventory honest and intact.`);
