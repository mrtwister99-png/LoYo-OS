// D:\dev\loyo-os\apps\api\src\services\agentStats.ts
// LOYO OS // Živé statistiky agentů — počet úkolů dnes + čas posledního běhu
import * as fs from 'fs/promises'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

// Cesta odvozená od umístění souboru — žádný hardcoded disk
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const INDEX_PATH = resolve(__dirname, '../../../../data/capabilities/agents/index.json')

interface AgentRecord {
  id: string
  tasksToday: number
  lastRun?: string | null
  [key: string]: unknown
}

interface AgentIndex {
  version: string
  lastSync: string
  agents: AgentRecord[]
}

function isSameDay(iso: string | null | undefined, now: Date): boolean
{
  if (!iso) return false
  const d = new Date(iso)
  // Ochrana proti invalid date
  if (isNaN(d.getTime())) return false
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// ---------- zavolej po úspěšném dokončení úkolu agenta ----------
export async function bumpAgentStats(agentId: string): Promise<void>
{
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf-8')
    const idx: AgentIndex = JSON.parse(raw)

    const agent = idx.agents.find(a => a.id === agentId)
    if (!agent) {
      console.warn(`[AGENTSTATS] agent "${agentId}" nenalezen v index.json — statistika se nezapsala`)
      return
    }

    const now = new Date()
    agent.tasksToday = isSameDay(agent.lastRun, now)
      ? (agent.tasksToday || 0) + 1
      : 1
    agent.lastRun = now.toISOString()
    idx.lastSync = now.toISOString()

    await fs.writeFile(INDEX_PATH, JSON.stringify(idx, null, 2), 'utf-8')
    console.log(`[AGENTSTATS] ${agentId}: tasksToday=${agent.tasksToday}, lastRun=${agent.lastRun}`)
  } catch (e) {
    console.error('[AGENTSTATS] chyba při zápisu statistik:', (e as Error).message)
  }
}

// ---------- čtení statistik jednoho agenta (read-only) ----------
export async function getAgentStats(agentId: string): Promise<AgentRecord | null>
{
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf-8')
    const idx: AgentIndex = JSON.parse(raw)
    return idx.agents.find(a => a.id === agentId) ?? null
  } catch {
    return null
  }
}

// ---------- reset tasksToday pro všechny agenty (volej každý den o půlnoci) ----------
export async function resetDailyStats(): Promise<void>
{
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf-8')
    const idx: AgentIndex = JSON.parse(raw)
    for (const agent of idx.agents) {
      agent.tasksToday = 0
    }
    idx.lastSync = new Date().toISOString()
    await fs.writeFile(INDEX_PATH, JSON.stringify(idx, null, 2), 'utf-8')
    console.log('[AGENTSTATS] denní reset dokončen')
  } catch (e) {
    console.error('[AGENTSTATS] chyba při resetu:', (e as Error).message)
  }
}
