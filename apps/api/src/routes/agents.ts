// D:\dev\loyo-os\apps\api\src\routes\agents.ts
import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths.js'
import { runOrchestrator } from '../services/orchestrator.js'

const AGENTS_INDEX = join(DATA_DIR, 'capabilities', 'agents', 'index.json')

export default async function agentRoutes(app: FastifyInstance) {
  // GET /api/agents → seznam agentů z capabilities/agents/index.json
  app.get('/agents', async () => {
    const raw = await readFile(AGENTS_INDEX, 'utf-8').catch(() => '{"agents":[]}')
    const { agents } = JSON.parse(raw)
    return { agents }
  })

  // GET /api/agents/:id → detail jednoho agenta
  app.get('/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = await readFile(AGENTS_INDEX, 'utf-8').catch(() => '{"agents":[]}')
    const { agents } = JSON.parse(raw)
    const agent = agents.find((a: any) => a.id === id)
    if (!agent) { reply.code(404); return { error: 'Agent not found', id } }
    return agent
  })

  // POST /api/agents/chat → chat se sekretářkou (Mary Jane routing)
  app.post('/agents/chat', async req => {
    const { message } = req.body as { message: string }
    const { reply } = await runOrchestrator(message)
    return { reply }
  })
}
