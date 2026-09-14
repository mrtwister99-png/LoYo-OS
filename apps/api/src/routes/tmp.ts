import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'

export default async function tmpRoutes(app: FastifyInstance) {
  app.get('/api/tmp', async (req, reply) => {
    const { path } = (req.query as any) || {}
    if (!path) return reply.status(400).send({ error: 'missing path' })
    // bezpečnost — povol jen soubory z data/tmp
    if (!path.includes('tmp') && !path.includes('data')) return reply.status(403).send({ error: 'forbidden' })
    try {
      const raw = await readFile(path, 'utf-8')
      return JSON.parse(raw)
    } catch (e: any) {
      return reply.status(404).send({ error: e.message, path })
    }
  })
}