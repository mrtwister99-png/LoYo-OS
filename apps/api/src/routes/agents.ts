import type { FastifyInstance } from 'fastify'
import { getAgents, getCapabilityById } from '../lib/manifestLoader.js'
import { getDbStats, searchFromDb } from '../lib/manifestDb.js'
import { runOrchestrator } from '../services/orchestrator.js'

export default async function agentRoutes(app: FastifyInstance) {
  // GET /api/agents → SQLite SELECT * za ~2ms + FTS5 search
  app.get('/agents', async (req) => {
    const { search, stats } = (req.query as any) || {}
    if (stats === 'true' || stats === '1') {
      return {...getDbStats(), agents: await getAgents() }
    }
    if (search) {
      const agents = searchFromDb(String(search), 'agent')
      return { agents, count: agents.length, query: search }
    }
    const agents = await getAgents()
    return { agents, count: agents.length }
  })

  // GET /api/agents/:id → SELECT WHERE id =?
  app.get('/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = await getCapabilityById(id)
    if (!agent) {
      reply.code(404); return { error: 'Agent not found', id }
    }
    return agent
  })

  // POST /api/agents/chat → chat se sekretářkou (Mary Jane routing)
  app.post('/agents/chat', async req => {
    const { message } = req.body as { message: string }
    const { reply } = await runOrchestrator(message)
    return { reply }
  })
}
