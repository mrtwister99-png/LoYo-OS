// D:\dev\loyo-os\apps\api\src\routes\mcp.ts
import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths'

const INDEX_PATH = join(DATA_DIR, 'mcp/index.json')

export default async function mcpRoutes(app: FastifyInstance) {
  app.get('/mcp', async () => {
    try {
      const idx = JSON.parse(await readFile(INDEX_PATH, 'utf-8'))
      return { servers: idx.servers || idx.mcp || [] }
    } catch {
      return { servers: [] }
    }
  })
}
