import type { FastifyInstance } from 'fastify'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, sep, join } from 'node:path'
import { z } from 'zod'
import { DATA_DIR, TMP_DIR } from '../lib/dataPaths.js'

const QuerySchema = z.object({
  path: z.string().min(1).max(200).regex(/^[a-z0-9/_.-]+$/i)
})

export default async function tmpRoutes(app: FastifyInstance) {
  app.get('/tmp/list', async (req) => {
    const q = req.query as { ext?: string }
    const filterExt = q?.ext || 'json'
    try {
      const files = await readdir(TMP_DIR)
      const detailed = await Promise.all(files.filter(f=> filterExt? f.endsWith('.'+filterExt) : true).map(async (name) => {
        try {
          const full = join(TMP_DIR, name)
          const s = await stat(full)
          return { name, size: s.size, mtime: s.mtime.toISOString(), mtimeMs: s.mtime.getTime(), isFile: s.isFile() }
        } catch {
          return { name, size: 0, mtime: '', mtimeMs: 0, isFile: true }
        }
      }))
      detailed.sort((a,b)=> (b as any).mtimeMs - (a as any).mtimeMs)
      return { files: detailed.map(({mtimeMs,...rest}:any)=>rest), dir: TMP_DIR, count: detailed.length }
    } catch (e: any) {
      return { files: [], dir: TMP_DIR, error: e.message }
    }
  })

  app.get('/tmp', async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.status(400).send({ error: 'invalid path', detail: parsed.error.flatten() })
    const inputPath = parsed.data.path

    // FIX F3-4: Dir traversal - path.includes('tmp') projde data/tmp/../../.env
    // Správně: resolve + startsWith DATA_DIR
    const resolved = resolve(DATA_DIR, inputPath)

    // Ochrana proti prefix bypass: /data vs /data-evil -> musí končit sep
    const safeData = DATA_DIR.endsWith(sep) ? DATA_DIR : DATA_DIR + sep
    const safeTmp = TMP_DIR.endsWith(sep) ? TMP_DIR : TMP_DIR + sep

    // Povolujeme jen cesty uvnitř DATA_DIR (a specifičtěji TMP_DIR nebo DATA_DIR)
    // resolve odstraní ../, takže data/tmp/../../.env -> DATA_DIR/.env -> neprojde pokud chceme jen tmp
    // Pro maximální bezpečnost: musí být uvnitř DATA_DIR
    if (!resolved.startsWith(safeData)) {
      return reply.status(403).send({ error: 'forbidden - dir traversal blocked', resolved })
    }

    // Volitelně: pokud chceš povolit jen tmp, odkomentuj:
    // if (!resolved.startsWith(safeTmp)) {
    //   return reply.status(403).send({ error: 'forbidden - only tmp allowed' })
    // }

    try {
      const raw = await readFile(resolved, 'utf-8')
      return JSON.parse(raw)
    } catch (e: any) {
      return reply.status(404).send({ error: e.message, requestedPath: inputPath })
    }
  })
}
