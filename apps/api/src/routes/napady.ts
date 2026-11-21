// apps/api/src/routes/napady.ts — NÁPADY (panel na prvním dashboardu + /napad v chatu / Telegramu)
// Úložiště: data/ja/napady.json  →  { napady: [{ id, title, notes: [{ text, at }], createdAt, source }] }
import type { FastifyInstance } from 'fastify'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DATA_DIR } from '../lib/dataPaths.js'
import { logActivity } from './activity.js'

export type Napad = { id: string; title: string; notes: { text: string; at: string }[]; createdAt: string; source: string; done?: boolean }

const FILE = join(DATA_DIR, 'ja', 'napady.json')

export async function loadNapady(): Promise<Napad[]> {
  try {
    const j = JSON.parse(await readFile(FILE, 'utf8'))
    return Array.isArray(j.napady) ? j.napady : []
  } catch { return [] }
}
async function saveNapady(list: Napad[]) {
  await mkdir(join(DATA_DIR, 'ja'), { recursive: true })
  await writeFile(FILE, JSON.stringify({ napady: list }, null, 2), 'utf8')
}

export async function addNapad(title: string, source = 'ui'): Promise<Napad> {
  const list = await loadNapady()
  const n: Napad = { id: randomUUID().slice(0, 8), title: title.trim().slice(0, 300), notes: [], createdAt: new Date().toISOString(), source }
  list.unshift(n)
  await saveNapady(list)
  await logActivity({ agent: 'Mary Jane', type: 'system', action: `💡 nápad: ${n.title.slice(0, 80)}` }).catch(() => {})
  return n
}

export default async function napadyRoutes(app: FastifyInstance) {
  app.get('/napady', async () => ({ napady: await loadNapady() }))

  app.post('/napady', async (req, reply) => {
    const { title } = (req.body as { title?: string }) || {}
    if (!title?.trim()) { reply.code(400); return { error: 'Chybí text nápadu.' } }
    return { ok: true, napad: await addNapad(title, 'ui') }
  })

  // úprava: přejmenovat, přidat podrobnost, odškrtnout
  app.put('/napady/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { title, note, done, removeNote } = (req.body as { title?: string; note?: string; done?: boolean; removeNote?: number }) || {}
    const list = await loadNapady()
    const n = list.find((x) => x.id === id)
    if (!n) { reply.code(404); return { error: 'Nápad nenalezen.' } }
    if (typeof title === 'string' && title.trim()) n.title = title.trim().slice(0, 300)
    if (typeof note === 'string' && note.trim()) n.notes.push({ text: note.trim().slice(0, 2000), at: new Date().toISOString() })
    if (typeof removeNote === 'number') n.notes.splice(removeNote, 1)
    if (typeof done === 'boolean') n.done = done
    await saveNapady(list)
    return { ok: true, napad: n }
  })

  app.delete('/napady/:id', async (req) => {
    const { id } = req.params as { id: string }
    await saveNapady((await loadNapady()).filter((x) => x.id !== id))
    return { ok: true }
  })
}
