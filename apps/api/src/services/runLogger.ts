// D:\dev\loyo-os\apps\api\src\services\runLogger.ts
import { writeFile, mkdir, readdir, stat, unlink, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const LOGS_DIR = resolve(__dirname, '../../../../data/logs/runs')
const MAX_RUN_LOGS = 100 // kolik posledních běhů se drží, starší se mažou

export async function logRun(runId: string, data: Record<string, unknown>) {
  try {
    await mkdir(LOGS_DIR, { recursive: true })
    const file = join(LOGS_DIR, `${runId}.json`)
    await writeFile(file, JSON.stringify({ runId, loggedAt: new Date().toISOString(), ...data }, null, 2), 'utf-8')
    await rotateOldRuns()
  } catch (e) {
    console.error('[RUN LOG] Nepodařilo se zapsat log:', e)
  }
}

// ---------- smaže nejstarší logy nad limit MAX_RUN_LOGS ----------
async function rotateOldRuns() {
  try {
    const files = (await readdir(LOGS_DIR)).filter(f => f.endsWith('.json'))
    if (files.length <= MAX_RUN_LOGS) return

    const withStats = await Promise.all(
      files.map(async f => {
        const full = join(LOGS_DIR, f)
        const s = await stat(full)
        return { full, mtime: s.mtimeMs }
      }),
    )
    withStats.sort((a, b) => a.mtime - b.mtime) // nejstarší první
    const toDelete = withStats.slice(0, withStats.length - MAX_RUN_LOGS)
    await Promise.all(toDelete.map(f => unlink(f.full).catch(() => {})))
  } catch (e) {
    console.error('[RUN LOG] Rotace selhala:', e)
  }
}

// ---------- přečte konkrétní run log podle ID (pro API endpoint) ----------
export async function getRunLog(runId: string): Promise<unknown | null> {
  try {
    const raw = await readFile(join(LOGS_DIR, `${runId}.json`), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}
