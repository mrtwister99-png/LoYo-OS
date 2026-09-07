// D:\dev\loyo-os\apps\api\src\services\scheduler.ts
// LOYO OS // SCHEDULER — kontroluje commands.json každou minutu a spouští naplánované příkazy

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { logActivity } from '../routes/activity'
import { resetDailyStats } from './agentStats.js'
import { logRun } from './runLogger'
import { saveChatMessage } from './chatHistory'
import { randomUUID } from 'node:crypto'

import { DATA_DIR } from '../lib/dataPaths.js'

const COMMANDS_FILE = resolve(DATA_DIR, 'capabilities/agents/mary-jane/commands.json')
const SCHEDULER_STATE_FILE = resolve(DATA_DIR, 'capabilities/agents/mary-jane/scheduler_state.json')
const NOTIFICATIONS_DIR = resolve(DATA_DIR, 'notifications')
const PENDING_FILE = resolve(NOTIFICATIONS_DIR, '_pending.json')

const CHECK_INTERVAL_MS = 60_000 // každou minutu

interface ScheduleDef
{
  type: 'hourly' | 'daily'
  at?: string       // "07:00" — pro daily
  from?: number     // 7 — pro hourly (od které hodiny)
  to?: number       // 22 — pro hourly (do které hodiny)
}

interface CommandDef
{
  name: string
  handler: string
  description: string
  enabled: boolean
  response?: string
  schedule?: ScheduleDef
  addedBy: string
  createdAt: string
}

interface SchedulerState
{
  lastRuns: Record<string, string>  // "/voda" → "2026-09-01T14:00:00"
}

// ---------- state persistence ----------
async function loadState(): Promise<SchedulerState>
{
  try
  {
    const raw = await readFile(SCHEDULER_STATE_FILE, 'utf-8')
    return JSON.parse(raw)
  }
  catch
  {
    return { lastRuns: {} }
  }
}

async function saveState(state: SchedulerState): Promise<void>
{
  await writeFile(SCHEDULER_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
}

// ---------- load commands ----------
async function loadCommands(): Promise<CommandDef[]>
{
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return (data.commands || []).filter((c: CommandDef) => c.enabled && c.schedule)
  }
  catch
  {
    return []
  }
}

// ---------- should this command fire now? ----------
function shouldFire(cmd: CommandDef, now: Date, lastRun: string | undefined): boolean
{
  const schedule = cmd.schedule!
  const hour = now.getHours()
  const minute = now.getMinutes()

  if (schedule.type === 'hourly')
  {
    const from = schedule.from ?? 0
    const to = schedule.to ?? 23
    if (hour < from || hour > to) return false

    // fire na začátku každé hodiny (minuta 0)
    if (minute > 1) return false

    // už jsme tuto hodinu spustili?
    if (lastRun)
    {
      const lastDate = new Date(lastRun)
      if (lastDate.getHours() === hour && lastDate.toDateString() === now.toDateString())
      {
        return false
      }
    }
    return true
  }

  if (schedule.type === 'daily')
  {
    const [targetH, targetM] = (schedule.at || '07:00').split(':').map(Number)
    if (hour !== targetH || minute > 1) return false

    // už jsme dnes spustili?
    if (lastRun)
    {
      const lastDate = new Date(lastRun)
      if (lastDate.toDateString() === now.toDateString())
      {
        return false
      }
    }
    return true
  }

  return false
}

// ---------- execute scheduled command ----------
async function executeScheduled(cmd: CommandDef): Promise<string>
{
  // custom příkaz — vrať response
  if (cmd.handler === 'custom' && cmd.response)
  {
    return cmd.response
  }

  // built-in daily-brief — zavolá interně status logiku
  if (cmd.handler === 'daily-brief')
  {
    // importujeme orchestrator lazy, aby nebyl circular dependency
    const { runOrchestrator } = await import('./orchestrator')
    const result = await runOrchestrator('/status')
    const statusText = result.reply

    return `☀️ Čauky, Tome! Tady tvůj ranní přehled:\n\n${statusText}\n\nChceš se na něco zaměřit, nebo jedeme podle plánu?`
  }

  return `[scheduler] neznámý handler: ${cmd.handler}`
}

// ---------- notification store (API endpoint si je vyzvedne) ----------
interface SchedulerNotification
{
  id: string
  ts: string
  command: string
  message: string
  read: boolean
  type: 'reminder' | 'daily-brief' | 'system'
}

let pendingNotifications: SchedulerNotification[] = []

export function getNotifications(onlyUnread = false): SchedulerNotification[]
{
  if (onlyUnread) return pendingNotifications.filter(n => !n.read)
  return [...pendingNotifications]
}

export function markNotificationRead(id: string): void
{
  const n = pendingNotifications.find(x => x.id === id)
  if (n)
  {
    n.read = true
    savePendingNotifications().catch((err) =>
      console.error('[scheduler] pending save error:', err)
    )
  }
}

export function markAllRead(): void
{
  pendingNotifications.forEach(n => n.read = true)
  savePendingNotifications().catch((err) =>
    console.error('[scheduler] pending save error:', err)
  )
}

// drž max 50 notifikací v paměti
function addNotification(command: string, message: string): void
{
  pendingNotifications.unshift({
    id: randomUUID().slice(0, 8),
    ts: new Date().toISOString(),
    command,
    message,
    read: false,
    type: command === '/daily-brief' ? 'daily-brief' : command.startsWith('/') ? 'reminder' : 'system',
  })
  if (pendingNotifications.length > 50)
  {
    pendingNotifications = pendingNotifications.slice(0, 50)
  }
  // persist na disk (fire-and-forget, chyba nevadí)
  savePendingNotifications().catch((err) =>
    console.error('[scheduler] pending save error:', err)
  )
}

// ---------- pending notifications persistence ----------
async function loadPendingNotifications(): Promise<void>
{
  try
  {
    const raw = await readFile(PENDING_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) pendingNotifications = parsed
  }
  catch
  {
    // soubor ještě neexistuje — začínáme s prázdným polem
  }
}

async function savePendingNotifications(): Promise<void>
{
  await mkdir(NOTIFICATIONS_DIR, { recursive: true })
  // drž max 50 i na disku
  const toSave = pendingNotifications.slice(0, 50)
  await writeFile(PENDING_FILE, JSON.stringify(toSave, null, 2), 'utf-8')
}

// ---------- notification file persistence ----------
async function appendNotificationFile
(commandName: string, now: Date, message: string): Promise<void>
{
  await mkdir(NOTIFICATIONS_DIR, { recursive: true })

  // název souboru: /voda → voda.md, /daily-brief → daily-brief.md
  const slug = commandName.replace(/^\//, '')
  const filePath = resolve(NOTIFICATIONS_DIR, `${slug}.md`)

  const time = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('cs-CZ')

  // formát záznamu
  const entry = `${date} ${time} — připomenuto\n`

  // pro daily-brief: uložit celý obsah
  const fullEntry = slug === 'daily-brief'
    ? `## ${date}\n${message}\n\n---\n\n`
    : entry

  try
  {
    const existing = await readFile(filePath, 'utf-8')
    await writeFile(filePath, existing + fullEntry, 'utf-8')
  }
  catch
  {
    // soubor neexistuje — vytvořit s hlavičkou
    const header = `# ${commandName} — historie notifikací\n\n`
    await writeFile(filePath, header + fullEntry, 'utf-8')
  }
}

// ---------- main tick ----------
async function tick(): Promise<void>
{
  try
  {
    const now = new Date()

    // jedno loadState() pro celý tick
    const state = await loadState()
    let stateChanged = false

    // ── půlnoční reset tasksToday pro všechny agenty ──────────────
    if (now.getHours() === 0 && now.getMinutes() <= 1)
    {
      const midnightKey = `midnight-reset-${now.toDateString()}`
      if (!state.lastRuns[midnightKey])
      {
        await resetDailyStats()
        state.lastRuns[midnightKey] = now.toISOString()
        await saveState(state)
        console.log('[scheduler] půlnoční reset tasksToday dokončen')
      }
    }
    // ──────────────────────────────────────────────────────────────

    const commands = await loadCommands()

    for (const cmd of commands)
    {
      const lastRun = state.lastRuns[cmd.name]
      if (!shouldFire(cmd, now, lastRun)) continue

      console.log(`[scheduler] firing ${cmd.name} at ${now.toISOString()}`)

      const message = await executeScheduled(cmd)

      // uložit notifikaci do paměti
      addNotification(cmd.name, message)

      // zapsat do chatu — Mary pošle zprávu jako by ji napsala sama
      await saveChatMessage('mary', message).catch((err) =>
        console.error('[scheduler] chat save error:', err)
      )

      // zapsat na disk do data/notifications/<command>.md
      await appendNotificationFile(cmd.name, now, message).catch((err) =>
        console.error('[scheduler] notification file error:', err)
      )

      // logovat do activity
      await logActivity({
        agent: 'Scheduler',
        type: 'system',
        action: `scheduled: ${cmd.name}`,
        meta: { message: message.slice(0, 200) },
      })

      // update state
      state.lastRuns[cmd.name] = now.toISOString()
      stateChanged = true

      const runId = `sched-${now.toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`
      await logRun(runId, { mode: 'scheduler', command: cmd.name, message, firedAt: now.toISOString() })
    }

    if (stateChanged)
    {
      await saveState(state)
    }
  }
  catch (err)
  {
    console.error('[scheduler] tick error:', err)
  }
}

// ---------- start/stop ----------
let intervalHandle: NodeJS.Timeout | null = null

export async function startScheduler(): Promise<void>
{
  if (intervalHandle) return
  console.log('[scheduler] started — checking every 60s')
  // načti notifikace z disku PŘED prvním tickem — žádná race condition
  await loadPendingNotifications().catch((err) =>
    console.error('[scheduler] pending load error:', err)
  )
  tick() // první check hned po načtení
  intervalHandle = setInterval(tick, CHECK_INTERVAL_MS)
}

export function stopScheduler(): void
{
  if (intervalHandle)
  {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('[scheduler] stopped')
  }
}
