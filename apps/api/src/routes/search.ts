import type { FastifyInstance } from 'fastify'
import { getDb } from '../lib/connection.js'
import { z } from 'zod'

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.enum(['all','capabilities','notes','tasks']).default('all')
})

export async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (req) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return []
    const { q, limit, type } = parsed.data
    const db = getDb()
    try {
      // better-sqlite3 sync + WAL - <10ms, FTS5 + bm25
      if (type === 'all') {
        const caps = db.prepare(`SELECT 'capability' as source, *, bm25(capabilities_fts) as rank FROM capabilities_fts WHERE capabilities_fts MATCH ? ORDER BY rank LIMIT ?`).all(q, limit) as any[]
        const notes = db.prepare(`SELECT 'note' as source, *, bm25(notes_fts) as rank FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT ?`).all(q, Math.floor(limit/2)) as any[]
        const tasks = db.prepare(`SELECT 'task' as source, *, bm25(tasks_fts) as rank FROM tasks_fts WHERE tasks_fts MATCH ? ORDER BY rank LIMIT ?`).all(q, Math.floor(limit/2)) as any[]
        return [...caps,...notes,...tasks].sort((a,b)=>a.rank-b.rank).slice(0,limit)
      }
      if (type === 'notes') return db.prepare(`SELECT *, bm25(notes_fts) as rank FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT ?`).all(q, limit)
      if (type === 'tasks') return db.prepare(`SELECT *, bm25(tasks_fts) as rank FROM tasks_fts WHERE tasks_fts MATCH ? ORDER BY rank LIMIT ?`).all(q, limit)
      return db.prepare(`SELECT *, bm25(capabilities_fts) as rank FROM capabilities_fts WHERE capabilities_fts MATCH ? ORDER BY rank LIMIT ?`).all(q, limit)
    } catch (e) {
      console.error('[search] FTS error', e)
      return []
    }
  })
}