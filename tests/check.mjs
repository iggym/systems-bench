
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve('.');
const appsJsonPath = path.join(rootDir, 'apps.json');

console.log('--- systems-bench CI check suite ---');

if (!fs.existsSync(appsJsonPath)) {
  console.error('FAIL: apps.json not found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(appsJsonPath, 'utf8'));
const apps = data.apps;

console.log(`Checking ${apps.length} tools in apps.json...`);

let errors = 0;
const ids = new Set();

for (const app of apps) {
  if (ids.has(app.id)) {
    console.error(`FAIL: duplicate ID ${app.id}`);
    errors++;
  }
  ids.add(app.id);

  const filePath = path.join(rootDir, app.url);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: missing file for ${app.id}: ${app.url}`);
    errors++;
  }

  const requiredFields = ['id', 'name', 'url', 'description', 'tags', 'status', 'mode', 'focus', 'dimensions', 'notes'];
  for (const field of requiredFields) {
    if (!app[field]) {
      console.error(`FAIL: ${app.id} missing required field: ${field}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\nFAILED with ${errors} error(s).`);
  process.exit(1);
}

console.log(`\nSUCCESS: All ${apps.length} tools verified. Zero slop. Inventory honest and intact.`);
