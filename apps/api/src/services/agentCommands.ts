// apps/api/src/services/agentCommands.ts
// LOYO OS // MARY JANE — přímé povely na agenty z UI chatu i z Telegramu.
// Vrací null, když zpráva není povel na agenta (pak si ji vezme orchestrátor).
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { AGENTS_DIR, DATA_DIR } from '../lib/dataPaths.js'
import { getAgents } from '../lib/manifestLoader.js'
import { logActivity } from '../routes/activity.js'

type CommandResult = { reply: string; steps: string[] }

const RUN_TIMEOUT_MS = 180_000

async function readJson(path: string, fallback: any) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
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

function runNode(
  script: string,
  cwd: string,
  args: string[] = [],
  extraEnv: Record<string, string> = {},
): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: { ...process.env, ...extraEnv },
      windowsHide: true,
    })
    let output = ''
    let done = false
    const finish = (code: number) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolvePromise({ code, output })
    }
    const timer = setTimeout(() => {
      output += '\n[timeout]'
      try { child.kill() } catch {}
      finish(124)
    }, RUN_TIMEOUT_MS)
    child.stdout?.on('data', (chunk) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk) => { output += chunk.toString() })
    child.on('error', (err) => { output += `\n${err.message}`; finish(1) })
    child.on('close', (code) => finish(code ?? 1))
  })
}

function activity(agent: string, action: string, meta?: Record<string, unknown>) {
  return logActivity({ agent, type: 'system', action, meta }).catch(() => {})
}

// ---------- /agents ----------
async function listAgents(): Promise<CommandResult> {
  const agents = await getAgents()
  const lines = agents.map((a: any) => {
    const name = a.displayName ?? a.name ?? a.id
    const role = a.role ?? a.description ?? ''
    return `${a.number ?? '?'}) ${name} — ${a.id}${role ? ` · ${String(role).slice(0, 70)}` : ''}`
  })
  return {
    reply: [
      `🤖 Agenti LOYO OS (${agents.length})`,
      ...lines,
      '',
      'Spuštění: /lopatinka [rozpočet] · /stepan <co prodáváš> · /kosterad · /julia <téma>',
      'Stav botů: /boty · Poslední akce: /activity',
    ].join('\n'),
    steps: ['Mary Jane: /agents'],
  }
}

// ---------- /lopatinka ----------
async function runLopatinka(args: string): Promise<CommandResult> {
  const sendToTelegram = /--send|--ostre|--ostrý/i.test(args)
  const budget = args.match(/\b(\d{3,6})\b/)?.[1]
  const dir = join(AGENTS_DIR, 'lopatinka')
  const steps = [`Mary Jane: /lopatinka${budget ? ` ${budget}` : ''}${sendToTelegram ? '' : ' (dry-run)'}`]

  await activity('Mary Jane', `spouští Lopatinku${sendToTelegram ? '' : ' (dry-run)'}`, { budget: budget ?? null })
  const { code, output } = await runNode(
    join(dir, 'run.mjs'),
    dir,
    sendToTelegram ? [] : ['--dry-run'],
    budget ? { LOPATINKA_BUDGET: budget } : {},
  )
  const state = await readJson(join(dir, 'state.json'), null)
  const picks = Array.isArray(state?.lastPicks) ? state.lastPicks.length : 0

  await activity('Lopatinka', `běh ${code === 0 ? 'OK' : `selhal (${code})`} → ${picks} tipů`, { picks })
  return {
    reply: state?.lastChatText
      || `🛒 Lopatinka doběhla (exit ${code}), ale neuložila stav.\n${output.slice(-700)}`,
    steps,
  }
}

// ---------- /stepan ----------
async function runStepan(args: string): Promise<CommandResult> {
  const condition = args.match(/--stav\s+([a-z-]+)/i)?.[1] ?? ''
  const item = args.replace(/--stav\s+[a-z-]+/i, '').trim()
  const dir = join(AGENTS_DIR, 'stepan')
  const steps = ['Mary Jane: /stepan']

  if (!item) {
    return {
      reply: 'Napiš, co prodáváš: `/stepan iPhone 13 128 GB, baterie 89 %, drobné škrábance`\nVolitelně stav: `--stav novy|jako-novy|velmi-dobry|dobry|opotrebovany|na-dily`',
      steps,
    }
  }

  await activity('Mary Jane', `spouští Stěpána: "${item.slice(0, 70)}"`, { condition: condition || null })
  const { code } = await runNode(join(dir, 'run.mjs'), dir, [], {
    STEPAN_ITEM: item,
    STEPAN_CONDITION: condition,
  })
  const state = await readJson(join(dir, 'state.json'), null)

  await activity(
    'Stěpán',
    `ocenění ${code === 0 ? 'OK' : `selhalo (${code})`}: ${item.slice(0, 50)} → ${state?.price?.recommended ?? 'bez ceny'} Kč`,
    { recommended: state?.price?.recommended ?? null },
  )
  return {
    reply: state?.lastChatText || `🏷️ Stěpán doběhl (exit ${code}), ale neuložil stav.`,
    steps,
  }
}

// ---------- /kosterad ----------
async function runKosteradCommand(): Promise<CommandResult> {
  await activity('Mary Jane', 'spouští Koštěrada')
  const { runKosterad } = await import('./kosterad.js')
  const result = await runKosterad()
  return {
    reply: `🧹 Koštěrad: zkontrolováno ${result.scanned} failed runs, opraveno ${result.fixed} manifestů.`,
    steps: ['Mary Jane: /kosterad'],
  }
}

// ---------- /activity ----------
async function recentActivity(args: string): Promise<CommandResult> {
  const limit = Math.min(30, Math.max(1, Number(args) || 8))
  const feed = await readJson(join(DATA_DIR, 'activity', 'feed.json'), [])
  if (!Array.isArray(feed) || !feed.length) {
    return { reply: '📋 Activity feed je prázdný.', steps: ['Mary Jane: /activity'] }
  }
  const lines = feed.slice(0, limit).map((e: any) => {
    const when = new Date(e.ts).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
    return `${when} · ${e.agent ?? 'SYSTEM'} — ${e.action ?? e.type ?? ''}`
  })
  return { reply: ['📋 Poslední akce agentů', ...lines].join('\n'), steps: ['Mary Jane: /activity'] }
}

// ---------- /boty ----------
async function botStatus(): Promise<CommandResult> {
  const raw = await readFile(join(AGENTS_DIR, 'mary-jane', 'mary-telegram.pid'), 'utf8').catch(() => '')
  const pid = Number(String(raw).trim()) || null
  const running = !!pid && pidAlive(pid)
  return {
    reply: [
      '🤖 Telegram bot',
      `${running ? '● běží' : '○ vypnutý'} — Mary Jane (jeden bot pro celý systém)${pid ? ` · pid ${pid}` : ''}`,
      '',
      'Lopatinka vlastního bota nemá — tipy posílá přes stejný token a 👍/👎 obsluhuje Mary.',
      'Zapnutí/vypnutí: Agents → Mary Jane → Mary Jane · Telegram.',
    ].join('\n'),
    steps: ['Mary Jane: /boty'],
  }
}

// ---------- /controlvision — spustí ControlVision server přes PowerShell ----------
const CONTROLVISION_LNK = 'C:\\Users\\loyo-\\Desktop\\ControlVision server.lnk'

function runPowerShell(command: string): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
    })
    let output = ''
    child.stdout?.on('data', (c) => { output += c.toString() })
    child.stderr?.on('data', (c) => { output += c.toString() })
    child.on('error', (err) => resolvePromise({ code: 1, output: err.message }))
    child.on('close', (code) => resolvePromise({ code: code ?? 1, output: output.trim() }))
  })
}

async function controlVisionPid(): Promise<number | null> {
  const { output } = await runPowerShell(
    "(Get-Process -Name 'controlvision-server' -ErrorAction SilentlyContinue | Select-Object -First 1).Id",
  )
  const pid = Number(output.split(/\s+/).pop())
  return Number.isFinite(pid) && pid > 0 ? pid : null
}

// Totéž, co server vypisuje do svého okna: token, adresy do aplikace a odkaz.
async function controlVisionInfo(): Promise<string> {
  const configPath = join(process.env.APPDATA ?? '', 'controlvision', 'config.json')
  const config = await readJson(configPath, {})
  const port = Number(config?.port) || 8765
  const token = typeof config?.token === 'string' ? config.token : ''

  const ips: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) ips.push(a.address)
    }
  }
  // LAN napřed, Tailscale (100.x) za ní — stejně jako v okně serveru
  ips.sort((a, b) => Number(a.startsWith('100.')) - Number(b.startsWith('100.')))

  const lines = [`ControlVision server běží (port ${port})`]
  if (token) lines.push(`Token: ${token}`)
  lines.push(`Konfigurace: ${configPath}`, '')
  for (const ip of ips) lines.push(`Adresa do aplikace:  ${ip}:${port}`)
  if (ips.length && token) lines.push('', `http://${ips[0]}:${port}/?token=${token}`)
  return lines.join('\n')
}

async function runControlVision(): Promise<CommandResult> {
  const steps = ['Mary Jane: /controlvision']
  const running = await controlVisionPid()
  if (running) {
    return {
      reply: `🖥️ Už běží (pid ${running})\n\n${await controlVisionInfo()}`,
      steps,
    }
  }

  await activity('Mary Jane', 'spouští ControlVision server')
  const lnk = CONTROLVISION_LNK.replace(/'/g, "''")
  const { code, output } = await runPowerShell(`Start-Process -FilePath '${lnk}'`)
  if (code !== 0) {
    return { reply: `❌ ControlVision se nepodařilo spustit (exit ${code}).\n${output.slice(-500)}`, steps }
  }

  // run.cmd → run.ps1 → controlvision-server.exe, chvíli to trvá
  let pid: number | null = null
  for (let i = 0; i < 10 && !pid; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    pid = await controlVisionPid()
  }
  await activity('Mary Jane', `ControlVision ${pid ? `běží (pid ${pid})` : 'spuštěn, proces zatím nevidím'}`)
  return {
    reply: pid
      ? `🖥️ Spuštěno (pid ${pid})\n\n${await controlVisionInfo()}`
      :'🖥️ Zástupce ControlVision spuštěn, ale server zatím nevidím — mrkni na okno „ControlVision“ v hlavním panelu.',
    steps,
  }
}

// ---------- /vse — seznam všech povelů ----------
function listCommands(): CommandResult {
  return {
    reply: [
      '📖 Všechny povely Mary Jane',
      '',
      'AGENTI',
      '/agents — seznam agentů',
      '/zapni vše — Koštěrad + Lopatinka (dry-run)',
      '/zapni lopatinka · /zapni kosterad — jednotlivě',
      '/lopatinka [rozpočet] [--send] — hledání nabídek',
      '/stepan <věc> [--stav novy|jako-novy|velmi-dobry|dobry|opotrebovany|na-dily]',
      '/kosterad — údržba manifestů a failed runs',
      '/julia <téma> — hloubkový research',
      '/activity [n] — poslední akce agentů',
      '',
      'PC',
      '/controlvision (/cv) — spustí ControlVision server (ovládání PC z telefonu)',
      '',
      'SYSTÉM',
      '/vse — tento seznam',
      '/boty — stav Telegram bota',
      '/id — chat id pro .env',
      '/tg-help — nastavení bota',
      '',
      'Cokoliv jiného → Mary to pošle orchestrátoru.',
    ].join('\n'),
    steps: ['Mary Jane: /vse'],
  }
}

// ---------- /zapni vše ----------
async function runAllAgents(): Promise<CommandResult> {
  const steps = ['Mary Jane: /zapni vše']
  await activity('Mary Jane', 'spouští celou sestavu agentů')

  const kosterad = await runKosteradCommand()
  const lopatinka = await runLopatinka('')

  return {
    reply: [
      '⚡ Zapnuto: celá sestava',
      '',
      '— Koštěrad —',
      kosterad.reply,
      '',
      '— Lopatinka —',
      lopatinka.reply,
      '',
      'Stěpán čeká na věc: /stepan <co prodáváš> · Julia na téma: /julia <téma>',
    ].join('\n'),
    steps: [...steps, ...kosterad.steps, ...lopatinka.steps],
  }
}

async function runAgentsCommand(args: string): Promise<CommandResult> {
  const target = args.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!target || /vse|vsechno|all/.test(target)) return runAllAgents()
  if (/lopatinka|lopa/.test(target)) return runLopatinka('')
  if (/kosterad|kostrad/.test(target)) return runKosteradCommand()
  if (/julia/.test(target)) {
    return { reply: 'Julii spustíš tématem: /julia <téma>', steps: ['Mary Jane: /zapni julia'] }
  }
  if (/stepan/.test(target)) {
    return { reply: 'Stěpán potřebuje věc: /stepan iPhone 13 128 GB, baterie 89 %', steps: ['Mary Jane: /zapni stepan'] }
  }
  return {
    reply: 'Umím zapnout: /zapni vše · /zapni lopatinka · /zapni kosterad\nJulii: /julia <téma> · Stěpána: /stepan <věc>',
    steps: ['Mary Jane: /zapni'],
  }
}

// ---------- router ----------
export async function tryAgentCommand(message: string): Promise<CommandResult | null> {
  const trimmed = message.trim()
  const match = trimmed.match(/^\/([A-Za-zÀ-ž0-9-]+)(?:\s+([\s\S]*))?$/)
  if (!match) return null

  const name = match[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const args = (match[2] ?? '').trim()

  switch (name) {
    case 'agents':
    case 'agenti':
      return listAgents()
    case 'lopatinka':
    case 'lopa':
      return runLopatinka(args)
    case 'stepan':
      return runStepan(args)
    case 'kosterad':
    case 'kostrad':
      return runKosteradCommand()
    case 'vse':
    case 'povely':
    case 'prikazy':
    case 'help':
    case 'pomoc':
      return listCommands()
    case 'zapni':
    case 'all':
      return runAgentsCommand(args)
    case 'activity':
    case 'aktivita':
      return recentActivity(args)
    case 'boty':
    case 'bots':
      return botStatus()
    case 'controlvision':
    case 'cv':
      return runControlVision()
    default:
      return null
  }
}
