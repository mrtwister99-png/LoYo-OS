// D:\dev\loyo-os\apps\api\src\routes\workflows.ts
import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths'

const INDEX_PATH = join(DATA_DIR, 'workflows/index.json')

export default async function workflowsRoutes(app: FastifyInstance) {
  app.get('/workflows', async () => {
    try {
      const idx = JSON.parse(await readFile(INDEX_PATH, 'utf-8'))
      return { workflows: idx.workflows || [] }
    } catch {
      return { workflows: [] }
    }
  })
}
