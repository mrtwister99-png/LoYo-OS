import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (e === 'manifest.json') out.push(p);
  }
  return out;
}

for (const file of walk('data/capabilities')) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const oldType = json.type;
  let newType = oldType;
  if (file.includes('\\agents\\') || file.includes('/agents/')) newType = 'agent';
  if (file.includes('\\cli\\') || file.includes('/cli/')) newType = 'cli';
  if (file.includes('\\mcp\\')) newType = 'mcp';
  if (oldType!== newType) {
    console.log(`Fix ${file}: ${oldType} -> ${newType}`);
    json.type = newType;
    writeFileSync(file, JSON.stringify(json, null, 2));
  }
}
console.log('done');