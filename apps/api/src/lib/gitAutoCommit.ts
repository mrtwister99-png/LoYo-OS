// apps/api/src/lib/gitAutoCommit.ts
// ÚKOL 8 — auto-commit manifestů po každém reindexu capabilities.
//
// Commituje JEN změněné data/capabilities/**/manifest.json (git commit --only).
// Cokoli jiného, co máš zrovna ve stage (rozdělaná práce), zůstane nedotčené —
// dřív isomorphic-git commitnul celý stage a tvoje změny skončily pod "auto: reindex".
//
// Push je vypnutý (ENABLE_GIT_AUTO_PUSH=1 ho zapne). Vypnout úplně: DISABLE_GIT_AUTO_COMMIT=1.
// Hooky (husky) se přeskakují — jde jen o data, kód se commituje ručně přes hook.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, CAPABILITIES_DIR } from './dataPaths.js';

const GIT_ROOT = path.resolve(DATA_DIR, '..');
const CAPABILITIES_REL = path.relative(GIT_ROOT, CAPABILITIES_DIR).replace(/\\/g, '/');
// jen <typ>/<id>/manifest.json — ne cizí manifesty hlouběji (upstream knihovny)
const MANIFESTS = `:(glob)${CAPABILITIES_REL}/*/*/manifest.json`;

function git(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: GIT_ROOT, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout);
    });
  });
}

export async function autoCommitCapabilities(customMessage?: string): Promise<{ committed: boolean; oid?: string; files?: number }> {
  try {
    if (process.env.DISABLE_GIT_AUTO_COMMIT === '1') {
      console.log('[gitAuto] DISABLED via ENV, skipping');
      return { committed: false };
    }
    if (!fs.existsSync(path.join(GIT_ROOT, '.git'))) {
      console.log('[gitAuto] not a git repo, skipping', GIT_ROOT);
      return { committed: false };
    }

    // změněné / nové / smazané manifesty (-z: cesty s diakritikou bez uvozovek)
    const status = await git(['status', '--porcelain', '-z', '--untracked-files=all', '--', MANIFESTS]);
    const files = status.split('\0').filter(Boolean).map((line) => line.slice(3)).filter((f) => f.endsWith('manifest.json'));
    if (!files.length) return { committed: false, files: 0 };

    const message = customMessage || `auto: reindex ${files.length} manifests`;
    await git(['add', '-A', '--', ...files]);
    await git(['commit', '--only', '--no-verify', '-m', message, '--', ...files]);
    const oid = (await git(['rev-parse', '--short', 'HEAD'])).trim();
    console.log(`[gitAuto] committed ${oid} — ${files.length} manifestů (jen manifesty, push vypnutý)`);

    if (process.env.ENABLE_GIT_AUTO_PUSH === '1') {
      await git(['push', 'origin', 'HEAD'])
        .then(() => console.log('[gitAuto] pushed OK'))
        .catch((e) => console.warn('[gitAuto] push failed (commit je lokálně)', e.message));
    }
    return { committed: true, oid, files: files.length };
  } catch (e: any) {
    console.error('[gitAuto] failed', e?.message ?? String(e));
    return { committed: false };
  }
}

let lastCommitAt = 0;
export function autoCommitInBackground(msg?: string): void {
  const now = Date.now();
  if (now - lastCommitAt < 5000) return;
  lastCommitAt = now;
  autoCommitCapabilities(msg).catch((e: any) => console.error('[gitAuto] bg failed', e?.message ?? String(e)));
}
