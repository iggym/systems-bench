// Runs the Agent Trace Inspector's timing + critical-path functions against fixtures.
import fs from 'fs';
import path from 'path';

export default function ({ rootDir, vm }) {
  const html = fs.readFileSync(path.join(rootDir, 'web-apps/trace-inspector/index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const src = script.slice(script.indexOf('function assignTiming'), script.indexOf('function renderStats'));
  const ctx = {};
  vm.runInNewContext(src + '; this.assignTiming = assignTiming; this.criticalPath = criticalPath;', ctx);
  const check = (name, ok, detail) => ({ name, ok: !!ok, detail });

  // untimed trace (no startedAt) must not crash and must lay spans out in tree order
  const untimed = [
    { id: 'r', parent: null, durationMs: 1000 },
    { id: 'a', parent: 'r', durationMs: 300 },
    { id: 'b', parent: 'r', durationMs: 500 },
    { id: 'c', parent: 'b', durationMs: 200 }
  ];
  let err = null;
  try { ctx.assignTiming(untimed); } catch (e) { err = e.message; }
  const at = Object.fromEntries(untimed.map(s => [s.id, s.startMs]));
  const cp = [...ctx.criticalPath(untimed)];

  // timed trace: offsets relative to the earliest span
  const timed = [
    { id: 'r', parent: null, startedAt: '2026-10-01T09:00:00.000Z', durationMs: 900 },
    { id: 'a', parent: 'r', startedAt: '2026-10-01T09:00:00.250Z', durationMs: 100 }
  ];
  ctx.assignTiming(timed);

  return [
    check('untimed trace does not crash', err === null, err),
    check('untimed: children run back-to-back from the parent start', at.r === 0 && at.a === 0 && at.b === 300 && at.c === 300, JSON.stringify(at)),
    check('critical path follows the longest duration chain', JSON.stringify(cp) === '["r","b","c"]', JSON.stringify(cp)),
    check('timed: offsets from earliest span', timed[0].startMs === 0 && timed[1].startMs === 250)
  ];
}
