// D:\dev\loyo-os\apps\api\src\routes\teams.ts
import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths'

const INDEX_PATH = join(DATA_DIR, 'teams/index.json')

export default async function teamsRoutes(app: FastifyInstance) {
  app.get('/teams', async () => {
    try {
      const idx = JSON.parse(await readFile(INDEX_PATH, 'utf-8'))
      return { teams: idx.teams || [] }
    } catch {
      return { teams: [] }
    }
  })
}
