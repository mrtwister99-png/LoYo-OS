import type { FastifyInstance } from 'fastify'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, sep, join } from 'node:path'
import { z } from 'zod'
import { DATA_DIR, TMP_DIR } from '../lib/dataPaths.js'

const QuerySchema = z.object({
  path: z.string().min(1).max(200).regex(/^[a-z0-9/_.-]+$/i)
})

export default async function tmpRoutes(app: FastifyInstance) {
  // GET /api/tmp/list - seznam souborů v data/tmp
  app.get('/api/tmp/list', async () => {
    try {
      const files = await readdir(TMP_DIR)
      const detailed = await Promise.all(files.map(async (name) => {
        try {
          const full = join(TMP_DIR, name)
          const s = await stat(full)
          return { name, size: s.size, mtime: s.mtime.toISOString(), isFile: s.isFile() }
        } catch {
          return { name, size: 0, mtime: '', isFile: true }
        }
      }))
      return { files: detailed, dir: TMP_DIR }
    } catch (e: any) {
      return { files: [], dir: TMP_DIR, error: e.message }
    }
  })

  app.get('/api/tmp', async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.status(400).send({ error: 'invalid path', detail: parsed.error.flatten() })
    const inputPath = parsed.data.path
    const resolved = resolve(DATA_DIR, inputPath)
    const safeTmp = TMP_DIR.endsWith(sep)? TMP_DIR : TMP_DIR + sep
    const safeData = DATA_DIR.endsWith(sep)? DATA_DIR : DATA_DIR + sep
    if (!resolved.startsWith(safeTmp) &&!resolved.startsWith(safeData)) {
      return reply.status(403).send({ error: 'forbidden' })
    }
    try {
      const raw = await readFile(resolved, 'utf-8')
      return JSON.parse(raw)
    } catch (e: any) {
      return reply.status(404).send({ error: e.message, requestedPath: inputPath })
    }
  })
}