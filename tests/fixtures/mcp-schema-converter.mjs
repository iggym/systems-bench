// Runs the MCP Client Inspector's compile functions (extracted from its inline script) against fixtures.
import fs from 'fs';
import path from 'path';

export default function ({ rootDir, vm }) {
  const html = fs.readFileSync(path.join(rootDir, 'web-apps/mcp-schema-converter/index.html'), 'utf8');
  const src = html.slice(html.indexOf('function jsonType'), html.indexOf('function compileSchema'));
  const ctx = {};
  vm.runInNewContext(src + '; this.buildGemini = buildGemini; this.buildOpenAIProps = buildOpenAIProps;', ctx);

  const args = {
    tier: { type: 'string', enum: ['free', 'pro'], required: true },
    items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string', required: true }, qty: { type: 'integer' } } } },
    tags: { type: 'array', items: { type: 'string' } }
  };
  const g = JSON.parse(JSON.stringify(ctx.buildGemini(args)));
  const o = JSON.parse(JSON.stringify(ctx.buildOpenAIProps(args)));
  const check = (name, ok, detail) => ({ name, ok: !!ok, detail });

  return [
    check('gemini properties is a name→schema map', g.properties && !Array.isArray(g.properties) && g.properties.tier),
    check('gemini keeps enums', JSON.stringify(g.properties.tier.enum) === '["free","pro"]' && g.properties.tier.format === 'enum'),
    check('gemini required list', JSON.stringify(g.required) === '["tier"]', JSON.stringify(g.required)),
    check('gemini array<object> items', g.properties.items.type === 'ARRAY' && g.properties.items.items.type === 'OBJECT'
      && g.properties.items.items.properties.sku.type === 'STRING' && JSON.stringify(g.properties.items.items.required) === '["sku"]',
      JSON.stringify(g.properties.items)),
    check('gemini array<string> items', g.properties.tags.items.type === 'STRING'),
    check('openai array<object> items', o.properties.items.items.properties.qty.type === 'integer' && o.required[0] === 'tier')
  ];
}
