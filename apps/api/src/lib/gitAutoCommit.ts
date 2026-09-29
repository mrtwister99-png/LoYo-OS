import fs from 'node:fs';
import path from 'node:path';
import * as git from 'isomorphic-git';
// @ts-ignore - http client nemá typy pro ESM, ale runtime funguje
import http from 'isomorphic-git/http/node';
import { DATA_DIR, CAPABILITIES_DIR } from './dataPaths.js';

const GIT_ROOT = path.resolve(DATA_DIR, '..');
const CAPABILITIES_REL = path.relative(GIT_ROOT, CAPABILITIES_DIR).replace(/\\/g, '/');

function walkManifests(dir: string, out: string[] = []): string[] {
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) walkManifests(full, out);
        else if (entry === 'manifest.json') out.push(full);
      } catch {}
    }
  } catch {}
  return out;
}

export async function autoCommitCapabilities(customMessage?: string): Promise<{ committed: boolean; oid?: string; files?: number }> {
  try {
    if (process.env.DISABLE_GIT_AUTO_COMMIT === '1' || process.env.DISABLE_GIT_AUTO_PUSH === '1') {
      console.log('[gitAuto] DISABLED via ENV, skipping');
      return { committed: false };
    }

    const gitDir = path.join(GIT_ROOT, '.git');
    if (!fs.existsSync(gitDir)) {
      console.log('[gitAuto] not a git repo, skipping', GIT_ROOT);
      return { committed: false };
    }

    const absCapsDir = path.join(GIT_ROOT, CAPABILITIES_REL);
    const files: string[] = walkManifests(absCapsDir);
    if (files.length === 0) return { committed: false };

    for (const abs of files) {
      const rel = path.relative(GIT_ROOT, abs).replace(/\\/g, '/');
      await (git as any).add({ fs, dir: GIT_ROOT, filepath: rel });
    }

    const status = await (git as any).statusMatrix({
      fs,
      dir: GIT_ROOT,
      filter: (f: string) => f.startsWith(CAPABILITIES_REL),
    });

    const hasStaged = (status as any[]).some((row: any[]) => row[3] === 2 || row[3] === 3);
    if (!hasStaged) {
      return { committed: false, files: files.length };
    }

    const message: string = customMessage || `auto: reindex ${files.length} caps`;

    const oid = await (git as any).commit({
      fs,
      dir: GIT_ROOT,
      message,
      author: { name: 'LOYO OS Bot', email: 'bot@loyo.os' },
      committer: { name: 'LOYO OS Bot', email: 'bot@loyo.os' },
    }) as string;

    console.log(`[gitAuto] committed ${oid} - ${files.length} manifests (PUSH VYPNUT)`);
    console.log('[gitAuto] auto-push je VYPNUTY - udelej git push rucne az budes chtit');

    if (process.env.ENABLE_GIT_AUTO_PUSH === '1') {
      try {
        const remotes = (await (git as any).listRemotes({ fs, dir: GIT_ROOT })) as any[];
        const hasOrigin = remotes.find((r: any) => r.remote === 'origin');
        if (hasOrigin) {
          const branch = ((await (git as any).currentBranch({ fs, dir: GIT_ROOT, fullname: false })) as string) || 'main';
          console.log(`[gitAuto] pushing to origin/${branch}...`);
          await (git as any).push({
            fs,
            http,
            dir: GIT_ROOT,
            remote: 'origin',
            ref: branch,
            onAuth: (): any => {
              const token = process.env.GITHUB_TOKEN;
              if (token) return { username: token };
              return { username: 'git' };
            },
          });
          console.log(`[gitAuto] pushed to origin/${branch} OK`);
        }
      } catch (e: any) {
        console.warn('[gitAuto] push failed (nevadí, commit je lokálně)', e?.message ?? String(e));
      }
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
