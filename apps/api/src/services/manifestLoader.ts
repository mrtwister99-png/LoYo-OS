import { loadCapabilities, filterByType } from '@loyo/core';
import type { CapabilityManifest } from '@loyo/core';
import { DATA_DIR } from '../lib/dataPaths.js';
import { join } from 'path';

const CAPABILITIES_DIR = join(DATA_DIR, 'capabilities');

export interface ManifestCache {
  loadedAt: number;
  capabilities: CapabilityManifest[];
  errors: Array<{ path: string; error: string }>;
}

let cache: ManifestCache | null = null;
const CACHE_TTL_MS = 5_000;

export async function getCapabilities(forceReload = false): Promise<ManifestCache> {
  const now = Date.now();
  if (!forceReload && cache && (now - cache.loadedAt) < CACHE_TTL_MS) {
    return cache;
  }

  const result = await loadCapabilities({ baseDir: CAPABILITIES_DIR });
  cache = {
    loadedAt: now,
    capabilities: result.capabilities,
    errors: result.errors,
  };
  return cache;
}

export async function getCapabilityById(id: string): Promise<CapabilityManifest | null> {
  const { capabilities } = await getCapabilities(); // použije in-memory cache
  return capabilities.find(c => c.id === id) ?? null;
}

export async function getAgents() {
  const { capabilities } = await getCapabilities();
  return filterByType(capabilities, 'agent');
}

export async function getClis() {
  const { capabilities } = await getCapabilities();
  return filterByType(capabilities, 'cli');
}
