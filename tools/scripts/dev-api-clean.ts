import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

function killPort(port: number) {
  console.log(`[dev:api:clean] checking port ${port}...`);
  try {
    // najdi PID co drží port 3001
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
    const pids = new Set<number>();
    for (const line of out.split('\n')) {
      const m = line.trim().match(/(\d+)\s*$/);
      if (m) {
        const pid = parseInt(m[1], 10);
        if (pid && pid!== process.pid) pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        console.log(` killing PID ${pid} on :${port}`);
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch {}
    }
  } catch {
    // nic na portu = OK
  }
}

killPort(3001);

console.log('[dev:api:clean] cleaning index.db*...');
for (const f of ['data/index.db', 'data/index.db-wal', 'data/index.db-shm']) {
  try {
    fs.unlinkSync(path.join(ROOT, f));
    console.log(` removed ${f}`);
  } catch {}
}

console.log('[dev:api:clean] starting api...\n');
const child = spawn('pnpm', ['--filter', 'api', 'dev'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => process.exit(code?? 0));