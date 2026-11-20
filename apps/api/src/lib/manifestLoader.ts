import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './dataPaths.js';
import { initDb, upsertCapabilities, syncDbWithIds, getByTypeFromDb, getByIdFromDb, getAgentsFromDb, getAllFromDb } from './manifestDb.js';
import type { CapabilityManifest } from '@loyo/core';
import { CapabilityManifestSchema } from '@loyo/core';

const CAPABILITIES_DIR = join(DATA_DIR, 'capabilities');

function walkManifests(dir: string, out: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) walkManifests(full, out);
        else if (entry === 'manifest.json') out.push(full);
      } catch {}
    }
  } catch {}
  return out;
}

export interface ManifestCache {
  loadedAt: number;
  capabilities: CapabilityManifest[];
  errors: Array<{ path: string; error: string }>;
}

let cache: ManifestCache | null = null;
const CACHE_TTL_MS = 5_000;
let dbInitialized = false;

function ensureDb() {
  if (!dbInitialized) {
    initDb();
    dbInitialized = true;
  }
}

export async function reindexCapabilities(): Promise<ManifestCache> {
  ensureDb();
  const now = Date.now();
  console.log('[loader] scanning', CAPABILITIES_DIR);
  const files = walkManifests(CAPABILITIES_DIR);
  const caps: CapabilityManifest[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const f of files) {
    try {
      const raw = readFileSync(f, 'utf8');
      let json = JSON.parse(raw) as any;
      json._filePath = f;
      if (!json.id) json.id = f.split(/[\\/]/).slice(-2, -1)[0];
      if (!json.type) {
        if (f.includes('agents')) json.type = 'agent';
        else if (f.includes('cli')) json.type = 'cli';
        else json.type = 'unknown';
      }
      // Zod validace z @loyo/core - jediný zdroj pravdy
      if (json.type !== 'api') {
        const check = CapabilityManifestSchema.safeParse(json);
        if (!check.success) {
          errors.push({ path: f, error: 'schema: ' + check.error.issues.slice(0, 3).map((i: any) => `${i.path.join('.') || '(kořen)'}: ${i.message}`).join('; ') });
        } else {
          // zod zahazuje pole, která schéma nezná (number, script, shell…) — číslo pak
          // loader „dopočítal“ znovu (agenti 20, 21, … místo 2, 3, …). Pole navíc nechat.
          json = { ...json, ...(check.data as any) };
        }
      }
      caps.push(json as CapabilityManifest);
    } catch (e: any) {
      errors.push({ path: f, error: e?.message?? String(e) });
    }
  }

  // týmy: členy bere z teams/index.json (zdroj pro stránku Team), manifest je jen záloha
  try {
    const tIdx = JSON.parse(readFileSync(join(CAPABILITIES_DIR, 'teams', 'index.json'), 'utf8'))
    const tl: any[] = Array.isArray(tIdx?.teams) ? tIdx.teams : []
    for (const c of caps as any[]) {
      if (c.type !== 'team') continue
      const t = tl.find((x: any) => x.id === c.id)
      if (t && Array.isArray(t.agents)) c.members = t.agents
    }
  } catch {}

  // VALIDACE number – podle času přidání (nejstarší 1,2..) + auto-increment
  const byType: Record<string, any[]> = {}
  for (const c of caps) {
    const t = (c as any).type || 'unknown'
    if (!byType[t]) byType[t] = []
    byType[t].push(c)
  }
  for (const type of Object.keys(byType)) {
    const list = byType[type]
    list.sort((a,b) => {
      const da = new Date((a as any).createdAt || (a as any).created || 0).getTime()
      const db = new Date((b as any).createdAt || (b as any).created || 0).getTime()
      if (da!== db) return da - db
      return (a.id||'').localeCompare(b.id||'')
    })
    const used = new Set<number>()
    let maxNum = 0
    for (const c of list) {
      if (typeof (c as any).number === 'number') {
        maxNum = Math.max(maxNum, (c as any).number)
        used.add((c as any).number)
      }
    }
    let next = maxNum > 0? maxNum + 1 : 1
    for (const c of list) {
      if (typeof (c as any).number!== 'number') {
        while (used.has(next)) next++
        ;(c as any).number = next
        used.add(next)
        next++
      }
    }
    const seen: Record<number, string[]> = {}
    for (const c of list) {
      const n = (c as any).number
      if (!seen[n]) seen[n] = []
      seen[n].push(c.id)
    }
    for (const [n, ids] of Object.entries(seen)) {
      if (ids.length > 1) {
        errors.push({ path: `type:${type}`, error: `Duplicitní number ${n} pro ids: ${ids.join(', ')}` })
      }
    }
  }

  console.log(`[loader] found ${caps.length} caps, ${errors.length} errors`, caps.map(c=>c.id));
  upsertCapabilities(caps);
  syncDbWithIds(caps.map(c => c.id));
  cache = { loadedAt: now, capabilities: caps, errors };

  // ÚKOL 8 - auto-commit po každém reindexu (neblokuje response)
  const { autoCommitInBackground } = await import('./gitAutoCommit.js');
  autoCommitInBackground(`auto: reindex ${caps.length} caps`);

  return cache;
}

export async function getCapabilities(forceReload = false): Promise<ManifestCache> {
  ensureDb();
  const now = Date.now();
  if (!forceReload && cache && (now - cache.loadedAt) < CACHE_TTL_MS) return cache;
  return reindexCapabilities();
}

export async function getCapabilityById(id: string): Promise<CapabilityManifest | null> {
  ensureDb();
  const fromDb = getByIdFromDb(id);
  if (fromDb) return fromDb;
  const { capabilities } = await getCapabilities();
  return (capabilities.find((c:any) => c.id === id) as any)?? null;
}

export async function getAgents() {
  ensureDb();
  const fromDb = getAgentsFromDb();
  if (fromDb.length > 0) return fromDb;
  const { capabilities } = await getCapabilities(true);
  return capabilities.filter((c:any) => c.type === 'agent');
}

export async function getClis() {
  ensureDb();
  const fromDb = getByTypeFromDb('cli');
  if (fromDb.length > 0) return fromDb;
  const { capabilities } = await getCapabilities(true);
  return capabilities.filter((c:any) => c.type === 'cli');
}

export function getAgentsSync(): CapabilityManifest[] {
  ensureDb();
  return getAgentsFromDb();
}

export function getAllSync(): CapabilityManifest[] {
  ensureDb();
  return getAllFromDb();
}
  