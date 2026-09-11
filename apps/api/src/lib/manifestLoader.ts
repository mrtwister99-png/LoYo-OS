import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './dataPaths.js';
import { initDb, upsertCapabilities, syncDbWithIds, getByTypeFromDb, getByIdFromDb, getAgentsFromDb, getAllFromDb } from './manifestDb.js';
import type { CapabilityManifest } from '@loyo/core';

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
      const json = JSON.parse(raw) as any;
      json._filePath = f;
      if (!json.id) json.id = f.split(/[\\/]/).slice(-2, -1)[0];
      if (!json.type) {
        if (f.includes('agents')) json.type = 'agent';
        else if (f.includes('cli')) json.type = 'cli';
        else json.type = 'unknown';
      }
      caps.push(json as CapabilityManifest);
    } catch (e: any) {
      errors.push({ path: f, error: e?.message?? String(e) });
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