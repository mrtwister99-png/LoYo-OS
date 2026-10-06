import { FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getCapabilities, getCapabilityById } from '../lib/manifestLoader.js';
import { DATA_DIR as ROOT_DATA_DIR } from '../lib/dataPaths.js';
import { CapabilityManifestSchema } from '@loyo/core';

const DATA_DIR = join(ROOT_DATA_DIR, 'capabilities');

// Verzování: před přepsáním/smazáním zkopíruj starý manifest
async function backupManifest(targetDir: string): Promise<void>
{
  const manifestPath = join(targetDir, 'manifest.json');
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const existing = JSON.parse(raw);
    const version = existing.version ?? '1.0.0';
    const backupPath = join(targetDir, `manifest.v${version}.json`);
    await fs.writeFile(backupPath, raw, 'utf-8');
  } catch {
    // manifest ještě neexistuje, nic nezálohujeme
  }
}

const TYPE_FOLDER: Record<string, string> = {
  agent: 'agents',
  team: 'teams',
  skill: 'skills',
  mcp: 'mcp',
  cli: 'cli',
  loop: 'loops',
  workflow: 'workflows',
  rag: 'rag',
  api: 'api',
};

// ---- zápis do index.json (stránky Skills, MCP, Loops, Workflows, Team a Agents čtou právě index) ----
const INDEX_KEY: Record<string, string> = { agent: 'agents', team: 'teams', skill: 'skills', mcp: 'tools', loop: 'loops', workflow: 'workflows' };

function indexRecord(type: string, m: any): Record<string, unknown> {
  const name = m.displayName ?? m.name ?? m.id;
  const base = { id: m.id, number: m.number };
  switch (type) {
    case 'agent': return { ...base, folder: m.id, name, role: m.role ?? m.description ?? '', category: 'all', team: '', status: 'online', skills: [], tools: [], workflow: '', promptFile: '', docs: [], tasksToday: 0, created: m.createdAt ?? new Date().toISOString() };
    case 'team': return { ...base, name, desc: m.description ?? '', color: '#ff6f00', status: 'ACTIVE', purpose: m.description ?? '', agents: Array.isArray(m.members) ? m.members : [], ragFiles: [], canCollaborateWith: [], workflows: [], loops: [], createdAt: m.createdAt ?? new Date().toISOString() };
    case 'skill': return { ...base, name, desc: m.description ?? '', folder: m.id, file: m.entrypoint ?? '', category: 'all', status: m.status ?? 'draft', version: m.version ?? '1.0.0' };
    case 'mcp': return { ...base, name, command: m.entrypoint ?? '', status: m.status ?? 'draft', tools: Array.isArray(m.tools) ? m.tools.map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean) : [] };
    case 'loop': return { ...base, name, desc: m.description ?? '', status: m.status ?? 'draft', schedule: typeof m.schedule === 'string' ? m.schedule : '', agent: m.agent ?? '', enabled: m.enabled ?? true, category: 'all' };
    default: return { ...base, name, desc: m.description ?? '', status: m.status ?? 'draft', steps: [], lastRun: '', createdAt: m.createdAt ?? new Date().toISOString() };
  }
}

async function syncIndexFromManifest(type: string, m: any): Promise<void> {
  const key = INDEX_KEY[type];
  const folder = TYPE_FOLDER[type];
  if (!key || !folder) return;
  const p = join(DATA_DIR, folder, 'index.json');
  let idx: any = { version: '2.0', lastSync: '', [key]: [] };
  try { idx = JSON.parse(await fs.readFile(p, 'utf-8')); } catch {}
  if (!Array.isArray(idx[key])) idx[key] = [];
  const rec: any = indexRecord(type, m);
  const i = idx[key].findIndex((x: any) => x.id === m.id);
  if (i >= 0) {
    // existující záznam: přepíšou se jen pole z Builderu, vazby a stav zůstanou
    const keep = idx[key][i];
    const upd: any = { ...keep, name: rec.name, number: rec.number };
    if (type === 'team') { upd.agents = rec.agents; upd.desc = rec.desc; }
    if (type === 'agent') upd.role = rec.role;
    if (type === 'mcp') { upd.tools = rec.tools; upd.command = rec.command || keep.command; }
    idx[key][i] = upd;
  } else {
    idx[key].push(rec);
  }
  idx.lastSync = new Date().toISOString();
  await fs.writeFile(p, JSON.stringify(idx, null, 2), 'utf-8');
}

// Zod kontrola manifestu (měkká): uloží se i tak, ale vrátí varování (typ "api" schéma zatím nezná)
function schemaWarnings(type: string, m: unknown): string[] {
  if (type === 'api') return [];
  const check = CapabilityManifestSchema.safeParse(m);
  return check.success ? [] : check.error.issues.slice(0, 3).map(i => `${i.path.join('.') || '(kořen)'}: ${i.message}`);
}

export const capabilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/capabilities — seznam všech, volitelně filtr ?type=agent&reload=true
  fastify.get<{ Querystring: { type?: string; reload?: string } }>('/capabilities', async (req) => {
    const cache = await getCapabilities(req.query.reload === 'true');
    const result = req.query.type
      ? cache.capabilities.filter(c => c.type === req.query.type)
      : cache.capabilities;
    return {
      capabilities: result,
      errors: cache.errors,
      loadedAt: new Date(cache.loadedAt).toISOString(),
    };
  });

  // GET /api/capabilities/:id — detail jednoho
  fastify.get<{ Params: { id: string } }>('/capabilities/:id', async (req, reply) => {
    const cap = await getCapabilityById(req.params.id);
    if (!cap) {
      reply.code(404);
      return { error: 'Capability not found', id: req.params.id };
    }
    return cap;
  });

  // POST /api/capabilities — Koštěrad zapíše manifest na disk
  fastify.post<{ Body: { type: string; manifest: Record<string, unknown>; overwrite?: boolean } }>(
    '/capabilities',
    async (req, reply) => {
      const { type, manifest } = req.body;

      if (!type || !manifest) {
        reply.code(400);
        return { error: 'Chybí type nebo manifest.' };
      }

      const id = manifest.id as string;
      if (!id || !/^[a-z0-9-]+$/.test(id)) {
        reply.code(422);
        return { error: 'Pole id chybí nebo není kebab-case.' };
      }

      const folderName = TYPE_FOLDER[type];
      if (!folderName) {
        reply.code(422);
        return { error: `Neznámý typ capability: "${type}". Povolené: ${Object.keys(TYPE_FOLDER).join(', ')}.` };
      }
      const targetDir = join(DATA_DIR, folderName, id);

      // ochrana před přepsáním: existující položka jen s overwrite: true (číslo si pak nechá)
      const manifestFile = join(targetDir, 'manifest.json');
      let existingManifest: any = null;
      try { existingManifest = JSON.parse(await fs.readFile(manifestFile, 'utf-8')); } catch {}
      if (existingManifest && !req.body.overwrite) {
        reply.code(409);
        return { error: `Capability "${type}/${id}" už existuje.`, id };
      }
      // číslo: zadané > stávající > další volné v typu
      const sameType = (await getCapabilities()).capabilities.filter((x: any) => x.type === type);
      const nextNumber = Math.max(0, ...sameType.map((x: any) => (typeof x.number === 'number' ? x.number : 0))) + 1;
      const finalNumber = typeof manifest.number === 'number' ? manifest.number : (existingManifest?.number ?? nextNumber);

      try {
        await fs.mkdir(targetDir, { recursive: true });
        await backupManifest(targetDir);

        const manifestPath = join(targetDir, 'manifest.json');
        const toWrite = {
          ...manifest,
          type,
          number: finalNumber,
          updatedAt: new Date().toISOString(),
          createdAt: manifest.createdAt ?? new Date().toISOString(),
        };
        await fs.writeFile(manifestPath, JSON.stringify(toWrite, null, 2), 'utf-8');

        // audit.json — prázdný pokud neexistuje
        const auditPath = join(targetDir, 'audit.json');
        const auditExists = await fs.access(auditPath).then(() => true).catch(() => false);
        if (!auditExists) {
          await fs.writeFile(auditPath, '[]', 'utf-8');
        }

        // index.json pro stránky (Rust) – ať je nová položka vidět
        try { await syncIndexFromManifest(type, toWrite); } catch {}

        // invaliduj cache loaderu
        await getCapabilities(true);

        return {
          success: true,
          path: `data/capabilities/${folderName}/${id}/manifest.json`,
          message: `✓ ${manifest.displayName ?? id} vytvořen → data/capabilities/${folderName}/${id}/manifest.json` + (schemaWarnings(type, toWrite).length ? ` ⚠ schéma: ${schemaWarnings(type, toWrite).join('; ')}` : ''),
        };
      } catch (err) {
        reply.code(500);
        return {
          error: 'Zápis na disk selhal.',
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  // DELETE /api/capabilities/:type/:id — Koštěrad maže nepovedené manifesty
  fastify.delete<{ Params: { type: string; id: string } }>(
    '/capabilities/:type/:id',
    async (req, reply) => {
      const { type, id } = req.params;

      const folderName = TYPE_FOLDER[type];
      if (!folderName) {
        reply.code(422);
        return { error: `Neznámý typ: "${type}".` };
      }

      if (!id || !/^[a-z0-9-]+$/.test(id)) {
        reply.code(422);
        return { error: 'Neplatné id.' };
      }

      const targetDir = join(DATA_DIR, folderName, id);

      try {
        await fs.access(targetDir);
      } catch {
        reply.code(404);
        return { error: `Capability "${type}/${id}" nenalezena.` };
      }

      // ochrana systémových agentů
      const PROTECTED = ['mary-jane', 'kosterad-fuckstein'];
      if (PROTECTED.includes(id)) {
        reply.code(403);
        return { error: `Capability "${id}" je systémová a nelze ji smazat.` };
      }

      try {
        await backupManifest(targetDir);
        await fs.rm(targetDir, { recursive: true, force: true });
        await getCapabilities(true);
        return {
          success: true,
          message: `✓ ${type}/${id} smazán.`,
        };
      } catch (err) {
        reply.code(500);
        return {
          error: 'Smazání selhalo.',
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );
};
