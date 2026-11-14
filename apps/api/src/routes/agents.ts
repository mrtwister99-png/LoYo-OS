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

  // POST /api/agents/tridil/run → ruční běh Třídila („Roztřídit teď“), body: { dryRun?, all? }
  let tridilRunning = false
  app.post('/agents/tridil/run', async (req, reply) => {
    if (tridilRunning) {
      reply.code(409); return { error: 'Třídil už běží' }
    }
    tridilRunning = true
    try {
      const { dryRun, all } = (req.body as { dryRun?: boolean; all?: boolean }) || {}
      const { runTridil } = await import('../services/tridil.js')
      const { result, message } = await runTridil({ dryRun: !!dryRun, all: !!all })
      return {
        message,
        dir: result.dir,
        dryRun: result.dryRun,
        moved: result.moved.length,
        movedFiles: result.moved.slice(0, 200).map(m => ({ file: m.file, folder: m.folder, target: m.target.split(/[\\/]/).pop() })),
        skipped: result.skipped.length,
        errors: result.errors,
      }
    } catch (err: any) {
      reply.code(500); return { error: err?.message ?? String(err) }
    } finally {
      tridilRunning = false
    }
  })

  // GET /api/agents/tridil/config → nastavení Třídila (cesta, složky, přípony, vypnuté)
  app.get('/agents/tridil/config', async () => {
    const { loadTridilConfig, resolveTridilDir } = await import('../services/tridil.js')
    const { stat } = await import('node:fs/promises')
    const config = await loadTridilConfig()
    const resolvedDir = resolveTridilDir(config.dir)
    const dirExists = await stat(resolvedDir).then(s => s.isDirectory()).catch(() => false)
    return { config, resolvedDir, dirExists }
  })

  // POST /api/agents/tridil/config (POST kvůli CORS — povolené jen GET/POST) → uloží změny z UI (validace: názvy složek bez cest, přípony jen [a-z0-9])
  app.post('/agents/tridil/config', async (req, reply) => {
    const { loadTridilConfig, saveTridilConfig, resolveTridilDir } = await import('../services/tridil.js')
    const { stat } = await import('node:fs/promises')
    const body = (req.body as any) || {}
    const cur = await loadTridilConfig()
    const folderOk = (f: unknown) => typeof f === 'string' && /^[^\\/:*?"<>|]+$/.test(f) && f !== '.' && f !== '..'
    const extNorm = (e: unknown) => String(e).trim().toLowerCase().replace(/^\./, '')
    const extOk = (e: string) => /^[a-z0-9]{1,15}$/.test(e)

    const next = { ...cur }
    if (body.dir !== undefined) {
      if (typeof body.dir !== 'string' || !body.dir.trim()) { reply.code(400); return { error: 'Cesta je prázdná' } }
      const resolved = resolveTridilDir(body.dir.trim())
      const ok = await stat(resolved).then(s => s.isDirectory()).catch(() => false)
      if (!ok) { reply.code(400); return { error: `Složka neexistuje: ${resolved}` } }
      next.dir = body.dir.trim()
    }
    if (body.mapping !== undefined) {
      if (typeof body.mapping !== 'object' || Array.isArray(body.mapping)) { reply.code(400); return { error: 'mapping musí být objekt' } }
      const mapping: Record<string, string[]> = {}
      for (const [folder, exts] of Object.entries(body.mapping)) {
        if (!folderOk(folder) || !Array.isArray(exts)) { reply.code(400); return { error: `Neplatná složka: ${folder}` } }
        const list = [...new Set(exts.map(extNorm))]
        const bad = list.find(e => !extOk(e))
        if (bad !== undefined) { reply.code(400); return { error: `Neplatná přípona: ${bad}` } }
        mapping[folder] = list
      }
      next.mapping = mapping
    }
    if (body.disabledFolders !== undefined) {
      if (!Array.isArray(body.disabledFolders) || !body.disabledFolders.every(folderOk)) { reply.code(400); return { error: 'Neplatné disabledFolders' } }
      next.disabledFolders = body.disabledFolders
    }
    if (body.disabledExtensions !== undefined) {
      if (!Array.isArray(body.disabledExtensions)) { reply.code(400); return { error: 'Neplatné disabledExtensions' } }
      next.disabledExtensions = [...new Set<string>((body.disabledExtensions as unknown[]).map(extNorm))].filter(extOk)
    }
    await saveTridilConfig(next)
    return { config: next, resolvedDir: resolveTridilDir(next.dir), dirExists: true }
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
