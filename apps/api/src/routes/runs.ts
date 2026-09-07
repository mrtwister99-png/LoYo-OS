// D:\dev\loyo-os\apps\api\src\routes\runs.ts
// LOYO OS // RUN LOGS — správa uložených JSON logů jednotlivých běhů orchestrátoru
import type { FastifyInstance } from 'fastify'
import { readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths'

const RUNS_DIR = join(DATA_DIR, 'logs/runs')

export default async function runsRoutes(app: FastifyInstance) {
  // GET /api/logs/runs — seznam všech uložených běhů (základ pro budoucí "Runs" přehled)
  app.get('/logs/runs', async () => {
    let files: string[] = []
    try {
      files = await readdir(RUNS_DIR)
    } catch {
      return { runs: [] }
    }
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse()
    const runs = await Promise.all(
      jsonFiles.map(async f => {
        const runId = f.replace(/\.json$/, '')
        try {
          const raw = JSON.parse(await readFile(join(RUNS_DIR, f), 'utf-8'))
          return { runId, loggedAt: raw.loggedAt, mode: raw.mode, userMessage: raw.userMessage }
        } catch {
          return { runId }
        }
      })
    )
    return { runs }
  })

  // DELETE /api/logs/runs/:runId — smaže konkrétní JSON log z disku
  app.delete('/logs/runs/:runId', async (req: any, reply) => {
    const { runId } = req.params as { runId: string }

    // ochrana proti path traversal (runId nesmí obsahovat / nebo ..)
    if (!runId || runId.includes('..') || runId.includes('/') || runId.includes('\\')) {
      reply.code(400)
      return { error: 'Neplatné runId' }
    }

    const filePath = join(RUNS_DIR, `${runId}.json`)

    try {
      await unlink(filePath)
      return { status: 'deleted', runId }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        reply.code(404)
        return { error: 'Log nenalezen' }
      }
      reply.code(500)
      return { error: 'Smazání se nezdařilo' }
    }
  })
}
