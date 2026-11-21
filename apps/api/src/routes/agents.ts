import type { FastifyInstance } from 'fastify'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { readFile, mkdir, writeFile as writeFileFs } from 'node:fs/promises'
import { openSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { AGENTS_DIR, DATA_DIR } from '../lib/dataPaths.js'
import { getAgents, getCapabilityById } from '../lib/manifestLoader.js'
import { getDbStats, searchFromDb } from '../lib/manifestDb.js'
import { runOrchestrator } from '../services/orchestrator.js'
import { saveChatMessage } from '../services/chatHistory.js'
import { logActivity } from './activity.js'

// Souhrn běhu Lopatinky do UI chatu (Chat.tsx sleduje /api/chat/watch).
// Text skládá run.mjs a ukládá ho do state.json — formát tipů tak existuje jen na jednom místě.
function lopatinkaChatMessage(state: any, dryRun: boolean): string {
  const text = typeof state?.lastChatText === 'string' ? state.lastChatText.trim() : ''
  if (text) return text
  return `🛒 Lopatinka proběhla${dryRun ? ' (dry-run)' : ''}, ale nic rozumného do rozpočtu nenašla.`
}

// Telegram ENV se v API nenačítá z .env (agent si ho čte sám) — pro UI zjistíme
// přítomnost klíčů z ENV nebo z .env v rootu projektu. Hodnoty se nikam nevrací.
const LOPATINKA_DIR = join(AGENTS_DIR, 'lopatinka')
const lopatinkaFile = (file: string) => join(LOPATINKA_DIR, file)

// Runtime soubory Lopatinky (watchlist, feedback, rozhodnutí, pid bota).
async function readAgentJson(file: string, fallback: any) {
  try {
    return JSON.parse(await readFile(lopatinkaFile(file), 'utf8'))
  } catch {
    return fallback
  }
}

async function writeAgentJson(file: string, data: any) {
  await writeFileFs(lopatinkaFile(file), JSON.stringify(data, null, 2), 'utf8')
}

function pidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ---------- Mary Jane: jediný Telegram bot celého systému ----------
const MARY_DIR = join(AGENTS_DIR, 'mary-jane')

async function maryBotStatus() {
  const raw = await readFile(join(MARY_DIR, 'mary-telegram.pid'), 'utf8').catch(() => '')
  const pid = Number(raw.trim()) || null
  const configured =
    (await telegramConfigured(['TELEGRAM_MARY_BOT_TOKEN'])) ||
    (await telegramConfigured(['TELEGRAM_BOT_TOKEN']))
  return { running: !!pid && pidAlive(pid), pid, configured }
}

async function startDetachedNodeBot(dir: string, script: string, logName: string) {
  const logDir = join(DATA_DIR, 'logs')
  await mkdir(logDir, { recursive: true })
  const logPath = join(logDir, logName)
  const fd = openSync(logPath, 'a')
  try {
    const child = spawn(process.execPath, [join(dir, script)], {
      cwd: dir,
      env: process.env,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
    })
    child.unref()
  } finally {
    closeSync(fd)
  }
  return logPath
}

// Co má agent „připnuto“: MCP (dependencies) je v manifestu, ale skilly / nástroje / loopy
// připnuté v UI ukládá Tauri do agents/index.json — bez sloučení by se v UI po obnovení ztratily.
async function withAttachments(agents: any[]): Promise<any[]> {
  let idx: any[] = []
  try { idx = JSON.parse(await readFile(join(AGENTS_DIR, 'index.json'), 'utf8')).agents ?? [] } catch {}
  const byId = new Map(idx.map((x: any) => [x.id, x]))
  const union = (...lists: any[]) => [...new Set(lists.flatMap((l) => (Array.isArray(l) ? l : [])).filter((x) => typeof x === 'string' && x))]
  return agents.map((a: any) => {
    const rec: any = byId.get(a.id) ?? {}
    return {
      ...a,
      skills: union(a.skills, rec.skills),
      tools: union(a.tools, rec.tools),
      loops: union(a.loops, rec.loops),
      dependencies: union(a.dependencies, rec.dependencies),
    }
  })
}

// Při startu API zapne Mary Telegram bota (když je token a bot ještě neběží).
// Vypnout jde přes MARY_TELEGRAM_AUTOSTART=0 v .env.
export async function ensureMaryBot(): Promise<string> {
  const off = process.env.MARY_TELEGRAM_AUTOSTART === '0' ||
    (await readFile(resolve(DATA_DIR, '..', '.env'), 'utf8').catch(() => '')).split(/\r?\n/).some((l) => /^\s*MARY_TELEGRAM_AUTOSTART\s*=\s*['"]?0['"]?\s*$/.test(l))
  if (off) return 'autostart vypnutý (MARY_TELEGRAM_AUTOSTART=0)'
  const status = await maryBotStatus()
  if (status.running) return `už běží (pid ${status.pid})`
  if (!status.configured) return 'chybí TELEGRAM_BOT_TOKEN v .env'
  await startDetachedNodeBot(MARY_DIR, 'telegram-bot.mjs', 'mary-telegram-bot.log')
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250))
    const next = await maryBotStatus()
    if (next.running) {
      await logActivity({ agent: 'Mary Jane', type: 'system', action: 'Telegram bot spuštěn se startem API' }).catch(() => {})
      return `spuštěn (pid ${next.pid})`
    }
  }
  return 'nespustil se — viz data/logs/mary-telegram-bot.log'
}

async function telegramConfigured(keys: string[] = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']): Promise<boolean> {
  if (keys.every((key) => !!process.env[key])) return true
  try {
    const raw = await readFile(resolve(DATA_DIR, '..', '.env'), 'utf8')
    const has = (key: string) =>
      raw.split(/\r?\n/).some((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        return m?.[1] === key && m[2].trim().replace(/^['"]|['"]$/g, '') !== ''
      })
    return keys.every(has)
  } catch {
    return false
  }
}

export default async function agentRoutes(app: FastifyInstance) {
  // GET /api/agents → SQLite SELECT * za ~2ms + FTS5 search
  // ---------- Luuu (mailař) — panel v UI ----------
  app.get('/agents/luuu/state', async () => {
    const { luuuStatus } = await import('../services/luuu.js')
    return luuuStatus()
  })
  app.post('/agents/luuu/run', async (req, reply) => {
    const { days } = (req.body as { days?: number }) || {}
    try {
      const { runLuuu } = await import('../services/luuu.js')
      const r = await runLuuu(Number(days) || null)
      await saveChatMessage('mary', r.text).catch(() => {})
      return { ok: true, ...r }
    } catch (e: any) { reply.code(500); return { ok: false, error: e?.message ?? String(e) } }
  })
  app.post('/agents/luuu/trash', async (req, reply) => {
    const { category, days } = (req.body as { category?: string; days?: number }) || {}
    try {
      const { trashCategory } = await import('../services/luuu.js')
      const r = await trashCategory(category as any, Number(days) || 7)
      await saveChatMessage('mary', r.text).catch(() => {})
      return { ok: true, ...r }
    } catch (e: any) { reply.code(500); return { ok: false, error: e?.message ?? String(e) } }
  })
  app.put('/agents/luuu/lists', async (req) => {
    const { important, del } = (req.body as { important?: string[]; del?: string[] }) || {}
    const { saveLists, luuuStatus } = await import('../services/luuu.js')
    await saveLists({ important, del })
    return luuuStatus()
  })

  // GET /api/commands → všechny příkazy Mary (commands.json) — našeptávač v chatu, přehledy v UI
  app.get('/commands', async () => {
    const data = await readFile(join(MARY_DIR, 'commands.json'), 'utf8').then(JSON.parse).catch(() => ({ commands: [] }))
    const commands = (Array.isArray(data.commands) ? data.commands : [])
      .filter((c: any) => c?.name)
      .map((c: any) => ({ name: c.name, description: c.description ?? '', enabled: c.enabled !== false, schedule: c.schedule ?? null }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
    return { commands, count: commands.length }
  })

  app.get('/agents', async (req) => {
    const { search, stats } = (req.query as any) || {}
    if (stats === 'true' || stats === '1') {
      return {...getDbStats(), agents: await getAgents() }
    }
    if (search) {
      const agents = searchFromDb(String(search), 'agent')
      return { agents, count: agents.length, query: search }
    }
    const agents = await withAttachments(await getAgents())
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

  // GET /api/agents/lopatinka/state → poslední běh, tipy a nastavení pro panel v UI
  app.get('/agents/lopatinka/state', async () => {
    const agentDir = join(AGENTS_DIR, 'lopatinka')
    const readJson = async (file: string, fallback: any) => {
      try {
        return JSON.parse(await readFile(join(agentDir, file), 'utf8'))
      } catch {
        return fallback
      }
    }
    const config = await readJson('config.json', {})
    const state = await readJson('state.json', { lastRun: null, lastResult: '', lastPicks: [] })
    const watchlist = await readAgentJson('watchlist.json', { items: [] })
    const feedback = await readAgentJson('feedback.json', { ratings: [] })
    const decisions = await readAgentJson('decisions.json', { decisions: [] })
    return {
      config: {
        budgetCzk: config.budgetCzk ?? 3500,
        preferredPriceCzk: config.preferredPriceCzk,
        pickCount: config.pickCount ?? 3,
        bonusPickCount: config.bonusPickCount ?? 0,
        queries: config.queries ?? [],
        profit: config.profit ?? null,
      },
      state: {
        lastRun: state.lastRun ?? null,
        lastResult: state.lastResult ?? '',
        lastReport: state.lastReport,
        lastErrors: state.lastErrors ?? [],
        lastPicks: Array.isArray(state.lastPicks) ? state.lastPicks : [],
      },
      watchlist: Array.isArray(watchlist.items) ? watchlist.items : [],
      feedback: {
        up: (feedback.ratings ?? []).filter((r: any) => r.verdict === 'up').length,
        down: (feedback.ratings ?? []).filter((r: any) => r.verdict === 'down').length,
      },
      decisions: Array.isArray(decisions.decisions) ? decisions.decisions.slice(-10) : [],
      telegramConfigured: await telegramConfigured(),
    }
  })

  // POST /api/agents/lopatinka/run → spustí hledání nabídek (body: { dryRun?: boolean })
  // Agent je bez závislostí (run.mjs), takže stejný skript běží i jako cloudový cron.
  app.post('/agents/lopatinka/run', async (req, reply) => {
    const { dryRun } = (req.body as { dryRun?: boolean }) || {}
    const agentDir = join(AGENTS_DIR, 'lopatinka')
    const script = join(agentDir, 'run.mjs')
    await logActivity({ agent: 'Lopatinka', type: 'system', action: `běh spuštěn z UI${dryRun ? ' (dry-run)' : ''}` }).catch(() => {})

    return await new Promise((resolvePromise) => {
      const child = spawn(process.execPath, [script, ...(dryRun ? ['--dry-run'] : [])], {
        cwd: agentDir,
        env: process.env,
        windowsHide: true,
      })

      let output = ''
      child.stdout?.on('data', (chunk) => { output += chunk.toString() })
      child.stderr?.on('data', (chunk) => { output += chunk.toString() })
      child.on('error', (err) => {
        reply.code(500)
        resolvePromise({ ok: false, error: err.message })
      })
      child.on('close', async (code) => {
        if (code === 0) {
          try {
            const state = JSON.parse(await readFile(join(agentDir, 'state.json'), 'utf8'))
            await saveChatMessage('mary', lopatinkaChatMessage(state, !!dryRun), {
              kind: 'lopatinka-tips',
              runId: state.lastRun,
              report: state.lastReport,
              picks: Array.isArray(state.lastChatPicks) ? state.lastChatPicks : [],
              // ostrý běh posílá tipy do Telegramu sám (i s 👍/👎) → nezdvojovat
              mirror: !!dryRun,
            })
          } catch {
            // chat je jen doplněk — běh agenta kvůli němu nesmí selhat
          }
        }
        await logActivity({
          agent: 'Lopatinka',
          type: code === 0 ? 'system' : 'error',
          action: code === 0
            ? `běh dokončen${dryRun ? ' (dry-run)' : ''}`
            : `běh selhal (exit ${code})`,
        }).catch(() => {})
        resolvePromise({ ok: code === 0, exitCode: code, dryRun: !!dryRun, output: output.slice(-4000) })
      })
    })
  })

  // GET /api/agents/stepan/state → poslední ocenění a inzerát pro panel v UI
  app.get('/agents/stepan/state', async () => {
    const agentDir = join(AGENTS_DIR, 'stepan')
    const readJson = async (file: string, fallback: any) => {
      try {
        return JSON.parse(await readFile(join(agentDir, file), 'utf8'))
      } catch {
        return fallback
      }
    }
    const config = await readJson('config.json', {})
    const state = await readJson('state.json', { lastRun: null })
    return {
      config: {
        conditions: Object.entries(config.conditions ?? {}).map(([id, c]: any) => ({ id, label: c.label, factor: c.factor })),
        defaultCondition: config.defaultCondition ?? 'dobry',
        minComparableCount: config.minComparableCount ?? 3,
        portals: config.portals ?? ['sbazar', 'aukro'],
      },
      state,
    }
  })

  // POST /api/agents/stepan/run → ocení věc a napíše inzerát (body: { item, condition? })
  // Vstup jde přes ENV, aby se nemusely escapovat argumenty (Windows).
  app.post('/agents/stepan/run', async (req, reply) => {
    const { item, condition } = (req.body as { item?: string; condition?: string }) || {}
    const text = String(item ?? '').trim()
    if (!text) { reply.code(400); return { ok: false, error: 'Chybí věc k ocenění (body.item)' } }
    if (text.length > 500) { reply.code(400); return { ok: false, error: 'Popis věci je moc dlouhý (max 500 znaků)' } }

    const agentDir = join(AGENTS_DIR, 'stepan')
    const script = join(agentDir, 'run.mjs')
    await logActivity({ agent: 'Stěpán', type: 'system', action: `ocenění spuštěno: "${text.slice(0, 80)}"` }).catch(() => {})
    return await new Promise((resolvePromise) => {
      const child = spawn(process.execPath, [script], {
        cwd: agentDir,
        env: { ...process.env, STEPAN_ITEM: text, STEPAN_CONDITION: String(condition ?? '') },
        windowsHide: true,
      })

      let output = ''
      child.stdout?.on('data', (chunk) => { output += chunk.toString() })
      child.stderr?.on('data', (chunk) => { output += chunk.toString() })
      child.on('error', (err) => {
        reply.code(500)
        resolvePromise({ ok: false, error: err.message })
      })
      child.on('close', async (code) => {
        let state: any = null
        if (code === 0) {
          try {
            state = JSON.parse(await readFile(join(agentDir, 'state.json'), 'utf8'))
            if (typeof state?.lastChatText === 'string' && state.lastChatText.trim()) {
              await saveChatMessage('mary', state.lastChatText.trim())
            }
          } catch {
            // chat je jen doplněk — běh agenta kvůli němu nesmí selhat
          }
        }
        await logActivity({
          agent: 'Stěpán',
          type: code === 0 ? 'system' : 'error',
          action: code === 0
            ? `oceněno: "${text.slice(0, 60)}" → ${state?.price?.recommended ?? 'bez ceny'} Kč`
            : `ocenění selhalo (exit ${code})`,
        }).catch(() => {})
        resolvePromise({ ok: code === 0, exitCode: code, output: output.slice(-4000), state })
      })
    })
  })

  // ---------- Lopatinka: hlídané dotazy, rozhodnutí z chatu, Telegram bot ----------

  // POST /api/agents/lopatinka/watchlist → přidá hlídaný dotaz (body: { query, maxPrice? })
  app.post('/agents/lopatinka/watchlist', async (req, reply) => {
    const { query, maxPrice, label } = (req.body as any) || {}
    const q = String(query ?? '').trim()
    if (q.length < 2 || q.length > 120) {
      reply.code(400); return { ok: false, error: 'Dotaz musí mít 2–120 znaků' }
    }
    const price = maxPrice === '' || maxPrice === null || maxPrice === undefined ? null : Number(maxPrice)
    if (price !== null && (!Number.isFinite(price) || price < 100 || price > 500000)) {
      reply.code(400); return { ok: false, error: 'Maximální cena musí být 100–500 000 Kč' }
    }

    const data = await readAgentJson('watchlist.json', { items: [] })
    data.items = Array.isArray(data.items) ? data.items : []
    const existing = data.items.find((i: any) => i.active !== false && String(i.query).toLowerCase() === q.toLowerCase())
    if (existing) {
      existing.maxPrice = price ?? existing.maxPrice
      await writeAgentJson('watchlist.json', data)
      reply.code(409)
      return { ok: false, error: 'Tenhle dotaz už hlídám', items: data.items }
    }

    const item = {
      id: `w-${Date.now().toString(36)}`,
      query: q,
      label: String(label ?? q).trim() || q,
      maxPrice: price,
      active: true,
      created: new Date().toISOString(),
      seen: [],
      lastRun: null,
      lastCount: null,
      lastBest: null,
    }
    data.items.push(item)
    await writeAgentJson('watchlist.json', data)
    await logActivity({ agent: 'Lopatinka', type: 'system', action: `hlídám nový dotaz: "${q}"${price ? ` do ${price} Kč` : ''}` }).catch(() => {})
    return { ok: true, item, items: data.items }
  })

  // POST /api/agents/lopatinka/watchlist/remove → odebere hlídaný dotaz (body: { id })
  app.post('/agents/lopatinka/watchlist/remove', async (req, reply) => {
    const { id } = (req.body as any) || {}
    const data = await readAgentJson('watchlist.json', { items: [] })
    const items = Array.isArray(data.items) ? data.items : []
    const next = items.filter((i: any) => i.id !== id)
    if (next.length === items.length) {
      reply.code(404); return { ok: false, error: 'Takový hlídaný dotaz neexistuje' }
    }
    data.items = next
    await writeAgentJson('watchlist.json', data)
    await logActivity({ agent: 'Lopatinka', type: 'system', action: `přestal hlídat dotaz ${id}` }).catch(() => {})
    return { ok: true, items: next }
  })

  // POST /api/agents/lopatinka/tips/action → KOUPENO / IGNOROVAT z karty v chatu
  // IGNOROVAT se propíše do feedback.json, takže se nabídka už nikdy nepošle.
  app.post('/agents/lopatinka/tips/action', async (req, reply) => {
    const { url, title, price, action } = (req.body as any) || {}
    if (action !== 'bought' && action !== 'ignored') {
      reply.code(400); return { ok: false, error: 'action musí být bought nebo ignored' }
    }
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      reply.code(400); return { ok: false, error: 'Chybí url nabídky' }
    }

    const data = await readAgentJson('decisions.json', { decisions: [] })
    data.decisions = Array.isArray(data.decisions) ? data.decisions : []
    data.decisions.push({
      ts: new Date().toISOString(),
      action,
      url,
      title: String(title ?? ''),
      price: Number(price) || null,
    })
    await writeAgentJson('decisions.json', { decisions: data.decisions.slice(-500) })

    if (action === 'ignored') {
      const feedback = await readAgentJson('feedback.json', { ratings: [] })
      feedback.ratings = Array.isArray(feedback.ratings) ? feedback.ratings : []
      feedback.ratings.push({
        ts: new Date().toISOString(),
        verdict: 'down',
        url,
        title: String(title ?? ''),
        price: Number(price) || null,
        source: 'chat',
      })
      await writeAgentJson('feedback.json', { ratings: feedback.ratings.slice(-200) })
    }

    await logActivity({
      agent: 'Lopatinka',
      type: 'system',
      action: `${action === 'bought' ? 'KOUPENO' : 'IGNOROVAT'}: ${String(title ?? url).slice(0, 70)}`,
      meta: { url, price: Number(price) || null },
    }).catch(() => {})
    return { ok: true, action }
  })

  // Lopatinka už vlastního Telegram bota nemá — jeden bot (Mary Jane) obsluhuje celý systém.
  // Tipy, které Lopatinka pošle přes sendMessage, používají stejný token; polling drží jen Mary.

  // ---------- Mary Jane: řídicí Telegram bot ----------

  // GET /api/agents/mary-jane/telegram → stav bota a jestli je token v .env
  app.get('/agents/mary-jane/telegram', async () => {
    return { ...(await maryBotStatus()), apiUrl: 'http://localhost:3001' }
  })

  // POST /api/agents/mary-jane/telegram/start → spustí bota na pozadí
  app.post('/agents/mary-jane/telegram/start', async (req, reply) => {
    const status = await maryBotStatus()
    if (status.running) return { ok: true, ...status, started: false }
    if (!status.configured) {
      reply.code(400)
      return {
        ok: false,
        error: 'Chybí TELEGRAM_BOT_TOKEN v .env — vlož token bota z @BotFather.',
      }
    }

    const logPath = await startDetachedNodeBot(MARY_DIR, 'telegram-bot.mjs', 'mary-telegram-bot.log')
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250))
      const next = await maryBotStatus()
      if (next.running) {
        await logActivity({ agent: 'Mary Jane', type: 'system', action: 'Telegram bot spuštěn' }).catch(() => {})
        return { ok: true, ...next, started: true, log: logPath }
      }
    }
    reply.code(502)
    return { ok: false, error: `Bot se nespustil. Podívej se do ${logPath}` }
  })

  // POST /api/agents/mary-jane/telegram/stop → zastaví bota
  app.post('/agents/mary-jane/telegram/stop', async () => {
    const status = await maryBotStatus()
    if (status.pid && status.running) {
      try {
        process.kill(status.pid)
        await new Promise((r) => setTimeout(r, 300))
      } catch {
        // už skončil
      }
    }
    await writeFileFs(join(MARY_DIR, 'mary-telegram.pid'), '', 'utf8').catch(() => {})
    await logActivity({ agent: 'Mary Jane', type: 'system', action: 'Telegram bot zastaven' }).catch(() => {})
    return { ok: true, running: false }
  })

  // POST /api/agents/:id/demo -> spusti ukazku agenta (kdyz nebezi) a vrati URL
  const demoStarting = new Set<string>()
  // TCP probe - spolehlivejsi nez fetch na localhost (DNS/IPv6 muze zlobit)
  const portOpen = (host: string, port: number, timeoutMs = 800) =>
    new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port })
      let done = false
      const finish = (ok: boolean) => { if (done) return; done = true; socket.destroy(); resolve(ok) }
      socket.setTimeout(timeoutMs)
      socket.once('connect', () => finish(true))
      socket.once('timeout', () => finish(false))
      socket.once('error', () => finish(false))
    })

  const healthOk = async (url: string) => {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname
      const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80))
      return await portOpen(host, port)
    } catch {
      return false
    }
  }

  app.post('/agents/:id/demo', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = (await getCapabilityById(id)) as any
    if (!agent) { reply.code(404); return { ok: false, error: `Agent ${id} neexistuje` } }

    const manifestPath: string = agent._filePath || join(AGENTS_DIR, agent.folder || id, 'manifest.json')
    let manifest: any = agent
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) } catch {}

    const url: string | undefined = manifest?.endpoints?.demo
    if (!url) { reply.code(404); return { ok: false, error: 'Agent nema ukazku (endpoints.demo v manifestu)' } }

    if (await healthOk(url)) return { ok: true, url, running: true, started: false }
    if (demoStarting.has(id)) { reply.code(409); return { ok: false, error: 'Ukazka se uz spousti' } }

    demoStarting.add(id)
    try {
      const dir = dirname(manifestPath)
      const start = String(manifest.start || 'node server.js').trim()
      const parts = start.split(/\s+/)
      if (parts.length < 2) throw new Error(`manifest.start nevi co spustit: ${start}`)
      const cmd = parts[0] === 'node' ? process.execPath : parts[0]
      const child = spawn(cmd, parts.slice(1), { cwd: dir, detached: true, stdio: 'ignore', windowsHide: true })
      child.unref()

      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500))
        if (await healthOk(url)) return { ok: true, url, running: true, started: true }
      }
      reply.code(502)
      return { ok: false, url, running: false, error: `Server neodpovida. Zkus rucne: "${start}" ve slozce ${dir}` }
    } catch (err: any) {
      reply.code(500)
      return { ok: false, url, error: err?.message ?? String(err) }
    } finally {
      demoStarting.delete(id)
    }
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
