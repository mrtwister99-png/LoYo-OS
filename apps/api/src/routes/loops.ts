// D:\dev\loyo-os\apps\api\src\routes\loops.ts
import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths'

const INDEX_PATH = join(DATA_DIR, 'loops/index.json')
const COMMANDS_FILE = join(DATA_DIR, 'agents/Mary_Jane/commands.json')

export default async function loopsRoutes(app: FastifyInstance)
{
  app.get('/loops', async () =>
  {
    // 1. klasické loops z index.json
    let manualLoops: any[] = []
    try
    {
      const idx = JSON.parse(await readFile(INDEX_PATH, 'utf-8'))
      manualLoops = idx.loops || []
    }
    catch {}

    // 2. scheduled příkazy z commands.json → promítnuté jako loops
    let scheduledLoops: any[] = []
    try
    {
      const raw = await readFile(COMMANDS_FILE, 'utf-8')
      const data = JSON.parse(raw)
      const scheduled = (data.commands || []).filter((c: any) => c.schedule && c.enabled)

      scheduledLoops = scheduled.map((c: any) =>
      {
        const s = c.schedule
        let scheduleLabel = ''
        if (s.type === 'hourly')
        {
          scheduleLabel = `každou hodinu ${s.from || 0}:00–${s.to || 23}:00`
        }
        else if (s.type === 'daily')
        {
          scheduleLabel = `denně v ${s.at || '07:00'}`
        }

        return {
          id: `sched_${c.name.replace(/^\//, '')}`,
          name: c.name,
          desc: c.description || '',
          status: 'ACTIVE',
          schedule: scheduleLabel,
          agent: 'Scheduler',
          enabled: true,
          category: 'SCHEDULED',
          source: 'commands.json',
        }
      })
    }
    catch {}

    return { loops: [...scheduledLoops, ...manualLoops] }
  })
}
