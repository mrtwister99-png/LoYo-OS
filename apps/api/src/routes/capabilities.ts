import { FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getCapabilities, getCapabilityById } from '../lib/manifestLoader.js';
import { DATA_DIR as ROOT_DATA_DIR } from '../lib/dataPaths.js';

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
  agent:    'agents',
  team:     'teams',
  skill:    'skills',
  mcp:      'mcps',
  cli:      'clis',
  loop:     'loops',
  workflow: 'workflows',
  rag:      'rags',
  api:      'apis',
};

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
  fastify.post<{ Body: { type: string; manifest: Record<string, unknown> } }>(
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

      try {
        await fs.mkdir(targetDir, { recursive: true });
        await backupManifest(targetDir);

        const manifestPath = join(targetDir, 'manifest.json');
        const toWrite = {
          ...manifest,
          type,
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

        // invaliduj cache loaderu
        await getCapabilities(true);

        return {
          success: true,
          path: `data/capabilities/${folderName}/${id}/manifest.json`,
          message: `✓ ${manifest.displayName ?? id} vytvořen → data/capabilities/${folderName}/${id}/manifest.json`,
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
