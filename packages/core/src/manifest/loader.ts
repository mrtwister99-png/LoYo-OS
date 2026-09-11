import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { CapabilityManifestSchema, type CapabilityManifest } from './schema.js';

export interface LoadResult {
  capabilities: CapabilityManifest[];
  errors: Array<{ path: string; error: string }>;
}

export interface LoaderOptions {
  baseDir: string;   // absolutní cesta k data/capabilities/
}

// Helper: najde root monorepa
// Bezpečnější je předat baseDir explicitně z volajícího kódu (viz apps/api/src/lib/dataPaths.ts)
export function resolveDataDir(fromCwd = process.cwd()): string
{
  return resolve(fromCwd, '../../data/capabilities');
}

export async function loadCapabilities(options: LoaderOptions): Promise<LoadResult>
{
  const capabilities: CapabilityManifest[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  const types = await fs.readdir(options.baseDir).catch(() => []);

  for (const type of types) {
    const typeDir = join(options.baseDir, type);
    const stat = await fs.stat(typeDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const ids = await fs.readdir(typeDir).catch(() => []);
    for (const id of ids) {
      if (id.startsWith('.')) continue;

      const manifestPath = join(typeDir, id, 'manifest.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8');
        const json = JSON.parse(raw);

        const manifest = CapabilityManifestSchema.parse({
          ...json,
          id,
          type,
          _filePath: manifestPath,
          createdAt: json.createdAt ?? new Date().toISOString(),
          updatedAt: json.updatedAt ?? new Date().toISOString(),
        });

        capabilities.push(manifest);
      } catch (err) {
        errors.push({
          path: manifestPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { capabilities, errors };
}

export async function findCapability(
  options: LoaderOptions,
  id: string
): Promise<CapabilityManifest | null>
{
  const types = await fs.readdir(options.baseDir).catch(() => []);

  for (const type of types) {
    const manifestPath = join(options.baseDir, type, id, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const json = JSON.parse(raw);
      return CapabilityManifestSchema.parse({
        ...json, id, type,
        _filePath: manifestPath,
        createdAt: json.createdAt ?? new Date().toISOString(),
        updatedAt: json.updatedAt ?? new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }
  return null;
}

export function filterByType<T extends CapabilityManifest['type']>(
  capabilities: CapabilityManifest[],
  type: T
): Extract<CapabilityManifest, { type: T }>[]
{
  return capabilities.filter(c => c.type === type) as Extract<CapabilityManifest, { type: T }>[];
}

// === Audit helper ===
export async function appendAudit(
  baseDir: string,
  agentId: string,
  entry: {
    action: string;
    reasoning?: string;
    confidence?: number;
    result?: unknown;
    error?: string;
  }
): Promise<void>
{
  // baseDir = data/capabilities, agent je v agents/{agentId}
  const auditPath = join(baseDir, 'agents', agentId, 'audit.json');
  let existing: unknown[] = [];

  try {
    const raw = await fs.readFile(auditPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // soubor neexistuje, začneme prázdným polem
  }

  existing.push({ ...entry, timestamp: new Date().toISOString() });

  // rotace: max 500 záznamů, starší archivuj
  if (existing.length > 500) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const archivePath = join(baseDir, 'agents', agentId, `audit_${month}.json`);
    const toArchive = existing.slice(0, existing.length - 500);
    let archiveExisting: unknown[] = [];
    try {
      const raw = await fs.readFile(archivePath, 'utf-8');
      archiveExisting = JSON.parse(raw);
    } catch { /* nový archiv */ }
    await fs.writeFile(
      archivePath,
      JSON.stringify([...archiveExisting, ...toArchive], null, 2),
      'utf-8'
    );
    existing = existing.slice(-500);
  }

  await fs.writeFile(auditPath, JSON.stringify(existing, null, 2), 'utf-8');
}
