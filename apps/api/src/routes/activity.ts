// D:\dev\loyo-os\apps\api\src\routes\activity.ts
// LOYO OS // ACTIVITY FEED — reální záznam toho, co agenti dělají
import type { FastifyInstance } from 'fastify'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DATA_DIR } from '../lib/dataPaths'

const ACTIVITY_DIR = join(DATA_DIR, 'activity')
const FEED_FILE = join(ACTIVITY_DIR, 'feed.json')
const MAX_EVENTS = 500

export type ActivityEvent = {
  id: string
  ts: string
  agent: string   // 'Lubor_Nehleda' | 'Mary_Jane' | 'SYSTEM' | ...
  type: string    // 'routing' | 'research' | 'cli' | 'save' | 'error' | 'system'
  action: string  // jedna čitelná řádka
  meta?: Record<string, unknown>
}

async function readFeed(): Promise<ActivityEvent[]> {
  try {
    return JSON.parse(await readFile(FEED_FILE, 'utf-8')) as ActivityEvent[]
  } catch {
    return []
  }
}

async function writeFeed(feed: ActivityEvent[]) {
  await mkdir(ACTIVITY_DIR, { recursive: true })
  await writeFile(FEED_FILE, JSON.stringify(feed, null, 2), 'utf-8')
}

// HELPER — aby ostatní routy (třeba /api/finder) mohly logovat samy
export async function logActivity(e: Omit<ActivityEvent, 'id' | 'ts'>): Promise<ActivityEvent> {
  const event: ActivityEvent = { id: randomUUID(), ts: new Date().toISOString(), ...e }
  const feed = await readFeed()
  feed.unshift(event)
  await writeFeed(feed.slice(0, MAX_EVENTS))
  return event
}

export default async function activityRoutes(app: FastifyInstance) {
  // GET /api/activity?limit=50&agent=lubor
  app.get('/activity', async req => {
    const { limit, agent } = req.query as { limit?: string; agent?: string }
    let feed = await readFeed()
    if (agent) feed = feed.filter(e => e.agent.toLowerCase().includes(agent.toLowerCase()))
    return { events: feed.slice(0, parseInt(limit || '50') || 50) }
  })

  // POST /api/activity — agenti / CLI / Mary Jane sem píší události
  app.post('/activity', async req => {
    const { agent, type, action, meta } = req.body as Omit<ActivityEvent, 'id' | 'ts'>
    if (!agent || !action) return { error: 'agent a action jsou povinne' }
    const event = await logActivity({ agent, type: type || 'system', action, meta })
    return { status: 'logged', id: event.id }
  })

  // DELETE /api/activity — vymaže feed
  app.delete('/activity', async () => {
    await writeFeed([])
    return { status: 'cleared' }
  })
}