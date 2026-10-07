// Runs the JSON Schema Repair Loop's full runRepairLoop() against fixtures with a stub DOM.
import fs from 'fs';
import path from 'path';

function run(vm, src, schema, payload, maxPasses = 3) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { value: '', textContent: '', innerHTML: '', className: '' });
  el('schemaInput').value = JSON.stringify(schema);
  el('payloadInput').value = JSON.stringify(payload);
  el('maxPasses').value = String(maxPasses);
  const ctx = { document: { getElementById: el }, navigator: {} };
  vm.runInNewContext(src + '; runRepairLoop();', ctx);
  return { out: JSON.parse(els.outPayload.textContent), badge: els.statusBadge.textContent, log: els.logTable.innerHTML };
}

export default function ({ rootDir, vm }) {
  const html = fs.readFileSync(path.join(rootDir, 'web-apps/schema-repair-engine/index.html'), 'utf8');
  const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const check = (name, ok, detail) => ({ name, ok: !!ok, detail });
  const results = [];

  // the tool's own sample
  const sampleSchema = JSON.parse(html.match(/<textarea id="schemaInput"[^>]*>([\s\S]*?)<\/textarea>/)[1]);
  const samplePayload = JSON.parse(html.match(/<textarea id="payloadInput"[^>]*>([\s\S]*?)<\/textarea>/)[1]);
  const s = run(vm, src, sampleSchema, samplePayload);
  results.push(check('sample: status "SUCCESS" → "success"', s.out.status === 'success', s.out.status));
  results.push(check('sample: error_code "0" → 0', s.out.error_code === 0));
  results.push(check('sample: tier "ultimate" falls back to default "free"', s.out.data.tier === 'free', s.out.data.tier));
  results.push(check('sample: tags[1] 42 → "42"', s.out.data.tags[1] === '42'));

  // unresolved violations must leave the value in place
  const pat = run(vm, src, { type: 'object', properties: { id: { type: 'string', pattern: '^u-\\d+$' } } }, { id: 'bad' });
  results.push(check('pattern violation keeps value', pat.out.id === 'bad', JSON.stringify(pat.out)));
  results.push(check('pattern violation reported unresolved', /UNRESOLVED/.test(pat.log) && /could not be safely/.test(pat.log)));

  // clamps actually clamp
  const clamp = run(vm, src, { type: 'object', properties: { n: { type: 'integer', minimum: 1, maximum: 10 } } }, { n: 99 });
  results.push(check('maximum clamp', clamp.out.n === 10, JSON.stringify(clamp.out)));

  // missing required without default stays null, not the string "null"
  const miss = run(vm, src, { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }, {});
  results.push(check('missing required → null placeholder, not "null"', miss.out.name === null, JSON.stringify(miss.out)));

  // far-off enum with no default is unresolved, not guessed
  const en = run(vm, src, { type: 'object', properties: { c: { type: 'string', enum: ['red', 'green'] } } }, { c: 'purple' });
  results.push(check('distant enum without default left as-is', en.out.c === 'purple', JSON.stringify(en.out)));

  return results;
}
