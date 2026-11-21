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
import { newUsage, parseNewKind, runNewCapability } from './capabilityCreate.js'
import { askConfirm, cancelPending, confirmPending, guarded, pendingCodes } from './shellPolicy.js'
import { continueGrill, grillActive, startGrill, stopGrill } from './grillSession.js'
import { fetchCommand, mcpCommand, screenshotCommand, tryNaturalMcpIntent, webCommand } from './mcpCommands.js'
import { findFiles, listDirectory, readFileCommand, tryNaturalFileIntent } from './fileCommands.js'
import { pyCommand, runAgentCommand, scriptCommand, tryNaturalScriptIntent } from './scriptCommands.js'
import { runInShell, SHELL_LABEL, shellStatus, startShell, stopShell, type ShellKind } from './shellSession.js'

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

// ---------- /terminal (cmd) a /ps (PowerShell) ----------
async function shellCommand(kind: ShellKind, args: string): Promise<CommandResult> {
  const name = kind === 'cmd' ? '/terminal' : '/ps'
  const steps = [`Mary Jane: ${name}${args ? ` ${args.slice(0, 60)}` : ''}`]
  if (/^(off|stop|exit|konec|vypni)$/i.test(args)) return exitShell()

  const { started, cwd } = await startShell(kind)
  if (started) await activity('Mary Jane', `zapnula ${SHELL_LABEL[kind]}`)
  if (!args) {
    return {
      reply: [
        `💻 ${SHELL_LABEL[kind]} ${started ? 'zapnutý' : 'už běží'} · ${cwd}`,
        '',
        'Teď každá tvoje zpráva = příkaz do terminálu (cd a proměnné zůstávají).',
        `Jednorázově: ${name} <příkaz> · přepnout: ${kind === 'cmd' ? '/ps' : '/terminal'} · konec: /exit`,
        'Povely s / (třeba /cv, /boty) fungují dál normálně.',
      ].join('\n'),
      steps,
    }
  }
  const label = `💻 ${kind === 'cmd' ? '>' : 'PS>'} ${args}`
  return { reply: await guarded(label, args, async () => `${label}\n\n${await runInShell(args)}`), steps }
}

function exitShell(): CommandResult {
  const status = shellStatus()
  const stopped = stopShell()
  if (stopped && status) activity('Mary Jane', `vypnula ${SHELL_LABEL[status.kind]}`)
  return {
    reply: stopped && status ? `🔌 ${SHELL_LABEL[status.kind]} vypnutý. Zase si povídáme normálně.` : 'Žádný terminál neběží.',
    steps: ['Mary Jane: /exit'],
  }
}

const SHELL_COMMANDS = /^\/(terminal|terminál|cmd|ps|powershell|exit|ano|ne)(\s|$)/i

// Zprávy pro terminál jdou mimo frontu orchestrátoru — jinak by čekaly za dlouhým researchem.
export function isShellMessage(message: string): boolean {
  const t = message.trim()
  const yesNo = /^(ano|jo|jj|potvrzuji|potvrd|potvrdit|ok|yes|y|ne|nee|zrus|zrusit|no|n)$/.test(
    t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.!?\s]+$/, ''),
  )
  return SHELL_COMMANDS.test(t) || (!!shellStatus() && !!t && !t.startsWith('/')) || (yesNo && pendingCodes().length > 0)
}

// ---------- /strazce — hlídač LoYo OS (tools/strazce/strazce.mjs) ----------
async function strazceCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /strazce']
  const dir = join(DATA_DIR, 'strazce')
  const pause = join(dir, 'pauza')
  const a = args.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const { writeFile: wf, rm, mkdir: mk } = await import('node:fs/promises')
  if (/^(pauza|stop|vypni)$/.test(a)) {
    await mk(dir, { recursive: true }); await wf(pause, new Date().toISOString(), 'utf8')
    return { reply: '⏸ Strážce pozastaven — když LoYo spadne, nenahodí ho. Zapneš: /strazce zapni', steps }
  }
  if (/^(zapni|start|on)$/.test(a)) {
    await rm(pause, { force: true })
    return { reply: '▶ Strážce zase hlídá (API + Mary bot každých 30 s).', steps }
  }
  const st = await readJson(join(dir, 'state.json'), null)
  const pidRaw = await readFile(join(dir, 'strazce.pid'), 'utf8').catch(() => '')
  const alive = pidAlive(Number(pidRaw))
  const { envValue } = await import('./telegramNotify.js')
  const token = await envValue('LOYO_STRAZCE_TOKEN')
  const ts = Object.values(networkInterfaces()).flat().find((x) => x?.family === 'IPv4' && x.address.startsWith('100.'))?.address
  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('cs-CZ') : '—')
  return {
    reply: [
      `🛡️ Strážce ${alive ? `běží (pid ${Number(pidRaw)})` : 'NEBĚŽÍ — spusť: powershell -File tools\\strazce\\install.ps1'}`,
      ...(st ? [
        `hlídání: ${st.paused ? '⏸ pauza' : '▶ zapnuto'} · nahozeno: ${st.restarts ?? 0}× · poslední: ${fmt(st.lastRestart)}`,
        `poslední kontrola: ${fmt(st.lastCheck)}`,
      ] : []),
      '',
      ...(ts && token ? ['📱 Pro telefon (přes Tailscale):', `http://${ts}:3099/?token=${token}`] : ['📱 Odkaz pro telefon: chybí Tailscale nebo token (vznikne při prvním startu Strážce).']),
      '',
      '/strazce pauza · /strazce zapni',
    ].join('\n'),
    steps,
  }
}

// ---------- „/příkaz ?“ — popis a možnosti z commands.json ----------
async function commandHelp(name: string): Promise<CommandResult> {
  const steps = [`Mary Jane: ${name} ?`]
  const data = await readJson(join(AGENTS_DIR, 'mary-jane', 'commands.json'), { commands: [] })
  const all: any[] = Array.isArray(data?.commands) ? data.commands : []
  const want = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const cmd = all.find((c) => String(c.name).toLowerCase() === want)
  if (!cmd) {
    const similar = all.filter((c) => String(c.name).toLowerCase().startsWith(want.slice(0, 3))).map((c) => c.name).slice(0, 6)
    return { reply: `Příkaz ${name} neznám.${similar.length ? `\nMyslíš: ${similar.join(' · ')}?` : ''}\nVšechny: /vse`, steps }
  }
  const args: any[] = Array.isArray(cmd.args) ? cmd.args : []
  const when = cmd.schedule?.type === 'daily' ? `⏰ spouští se sám denně v ${cmd.schedule.at}` : cmd.schedule?.type === 'hourly' ? `⏰ spouští se sám každou hodinu ${cmd.schedule.from ?? 0}–${cmd.schedule.to ?? 23} h` : ''
  return {
    reply: [
      `📖 ${cmd.name}${cmd.enabled === false ? ' (pozastavený)' : ''}`,
      cmd.description ?? '',
      ...(when ? [when] : []),
      '',
      ...(args.length
        ? ['Co můžeš napsat za něj:', `${cmd.name} — bez ničeho`, ...args.map((a) => `${cmd.name} ${a.value} — ${a.desc ?? ''}`)]
        : ['Žádné pevné možnosti — piš normálně za příkaz (viz popis výše).']),
    ].join('\n'),
    steps,
  }
}

// ---------- Luuu: spam / newslettery z CELÉ schránky (s potvrzením /ano) ----------
// „/luuu smaž spam“, „Luuu, smaž všechny spamy z celého gmailu“, „vymaž newslettery z pošty“
function wholeMailboxWipe(text: string): Promise<CommandResult> | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!/(smaz|vymaz|zajeb|vyhod|vycist|uklid|trash|kos)/.test(t)) return null
  const cat = /(newslett|reklam|rozesil|letak)/.test(t) ? 'newsletter' : /spam/.test(t) ? 'spam' : null
  if (!cat) return null
  return (async () => {
    const steps = [`Luuu: celá schránka — ${cat}`]
    const L = await import('./luuu.js')
    if (!(await L.luuuConfigured())) return { reply: L.SETUP_HELP, steps }
    const scan = await L.scanWholeMailbox(cat).catch((e: any) => { throw new Error(`Luuu se nedostal do pošty: ${e?.message ?? e}`) })
    const total = L.scanTotal(scan)
    if (!total) return { reply: `${L.describeScan(scan)}\n\nNení co mazat. 🎉`, steps }
    return { reply: askConfirm(L.describeScan(scan), `${total} mailů do Koše`, () => L.trashWholeScan(scan)), steps }
  })().catch((e: any) => ({ reply: `❌ ${e?.message ?? e}`, steps: ['Luuu: celá schránka'] }))
}

// ---------- /vse — seznam všech povelů ----------
async function listCommands(): Promise<CommandResult> {
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
      '/grill <téma> — brainstorming podle skillu grill-me (otázky po kolech) · /grill stop = shrnutí',
      '/luuu [dny] — Luuu roztřídí nové maily (/maily) — souhrn je i v ranním /daily-brief',
      '/luuu smaž spam · /luuu smaž newslettery — z CELÉ schránky do Koše (nejdřív počet, pak /ano)',
      '/activity [n] — poslední akce agentů',
      '',
      'PC',
      '/controlvision (/cv) — spustí ControlVision server (ovládání PC z telefonu)',
      '/terminal [příkaz] — zapne terminál (cmd), pak každá zpráva = příkaz',
      '/ps [příkaz] — totéž v PowerShellu',
      '/exit — vypne terminál',
      '/strazce — hlídač LoYo OS (nahazuje po pádu) + odkaz pro telefon · /strazce pauza|zapni',
      '/napad <text> — nápad do panelu NÁPADY na dashboardu · /napady — seznam',
      '/ano [kód] · /ne [kód] — potvrdí / zruší riskantní příkaz (skill Bezpečný shell)',
      '/mcp — MCP servery · /mcp <id> nástroje · /mcp <id> <nástroj> {json}',
      '/fetch <url> — přečte stránku (Fetch MCP) · /web <url> — přes prohlížeč · /screenshot <url> (Playwright MCP)',
      '/ls [plocha|stažené|dokumenty|cesta] — co je ve složce (nebo větou: „vypiš soubory na ploše“)',
      '/cat <soubor> — přečte textový soubor · /najdi <název> [v složka] — hledá soubory',
      '/py <soubor.py> - <zadání> — Mary napíše Python skript (bez cesty = plocha)',
      '/skript <soubor> [argumenty] — spustí .py .ps1 .cmd .bat .mjs .js',
      '/spust <agent> [argumenty] — spustí skript / příkaz agenta',
      'nebo větou: „udělej kurzy.py na plochu, co … a vytvoř agenta Joozina, ať ho použije“',
      '',
      'NOVÉ VĚCI',
      '/new agent <jméno> - <co dělá>',
      '/new team <jméno> - <účel> | agenti: a, b',
      '/new workflow <jméno> - <popis> | kroky: a > b',
      '/new cli <jméno> - <co dělá>',
      '/new mcp <téma> · /new skill <téma> — s researchem',
      '',
      'SYSTÉM',
      '/vse — tento seznam',
      '/boty — stav Telegram bota',
      '/id — chat id pro .env',
      '/tg-help — nastavení bota',
      '',
      ...(await commandsJsonSection()),
      'Cokoliv jiného → Mary to pošle orchestrátoru.',
    ].join('\n'),
    steps: ['Mary Jane: /vse'],
  }
}

// Všechno z commands.json (poznámky, úkoly, připomínky, vlastní příkazy…) — nové se tu objeví samy.
const LISTED_ABOVE = new Set(['/vse', '/boty', '/new', '/terminal', '/ps', '/exit', '/cv', '/controlvision', '/py', '/skript', '/spust', '/ls', '/cat', '/najdi', '/ano', '/ne', '/mcp', '/fetch', '/web', '/screenshot', '/luuu'])
async function commandsJsonSection(): Promise<string[]> {
  const data = await readJson(join(AGENTS_DIR, 'mary-jane', 'commands.json'), { commands: [] })
  const cmds = (Array.isArray(data?.commands) ? data.commands : [])
    .filter((c: any) => c?.name && !LISTED_ABOVE.has(c.name))
  if (!cmds.length) return []
  const when = (s: any) =>
    s?.type === 'hourly' ? ` ⏰ každou hodinu ${s.from ?? 0}–${s.to ?? 23} h`
      : s?.type === 'daily' ? ` ⏰ denně ${s.at}`
        : ''
  return [
    'PŘÍKAZY (commands.json)',
    ...cmds.map((c: any) => `${c.name}${c.enabled === false ? ' ⏸' : ''} — ${c.description ?? ''}${when(c.schedule)}`),
    '',
  ]
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

  // „/luuu ?“ → co můžu napsat za příkaz · „?“ / „/?“ → všechny příkazy
  if (/^\/?\?$/.test(trimmed)) return listCommands()
  const helpFor = trimmed.match(/^(\/[^\s?]+)\s*\?$/)
  if (helpFor) return commandHelp(helpFor[1])

  // „ano“ / „ne“ bez kódu, když na potvrzení čeká právě jedna věc
  const yesNo = trimmed.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.!?\s]+$/, '')
  if (/^(ano|jo|jj|potvrzuji|potvrd|potvrdit|ok|yes|y|ne|nee|zrus|zrusit|no|n)$/.test(yesNo)) {
    const codes = pendingCodes()
    if (codes.length === 1) {
      const yes = /^(ano|jo|jj|potvrzuji|potvrd|potvrdit|ok|yes|y)$/.test(yesNo)
      return { reply: yes ? await confirmPending(codes[0]) : cancelPending(codes[0]), steps: [`Mary Jane: ${yes ? '/ano' : '/ne'}`] }
    }
    if (codes.length > 1) return { reply: await confirmPending(''), steps: ['Mary Jane: /ano'] }
  }

  // režim terminálu: obyčejný text (bez /) jde rovnou do shellu
  const shell = shellStatus()
  if (shell && trimmed && !trimmed.startsWith('/')) {
    // skill Bezpečný shell: zakázané odmítne, riskantní až po /ano
    const label = `💻 ${shell.kind === 'cmd' ? '>' : 'PS>'} ${trimmed}`
    const reply = await guarded(label, trimmed, async () => `${label}\n\n${await runInShell(trimmed)}`)
    return { reply, steps: [`${SHELL_LABEL[shell.kind]}: ${trimmed.slice(0, 60)}`] }
  }

  // běžící /grill: obyčejný text = odpověď do brainstormingu
  if (trimmed && !trimmed.startsWith('/') && grillActive()) {
    return { reply: await continueGrill(trimmed).catch((e: any) => `❌ Grill: ${e?.message ?? e}`), steps: ['Mary Jane: grill'] }
  }

  // „Luuu, smaž všechny spamy z celého gmailu“ (musí zmínit poštu / gmail / Luua)
  if (!trimmed.startsWith('/') && /(gmail|mail|post|schrank|luuu)/i.test(trimmed.normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
    const wipe = wholeMailboxWipe(trimmed)
    if (wipe) return wipe
  }

  // „udělej neco.py na plochu … a vytvoř agenta Joozina, ať ho použije“
  if (!trimmed.startsWith('/')) {
    const natural = await tryNaturalScriptIntent(trimmed).catch((e: any) => ({ reply: `❌ ${e?.message ?? e}`, steps: [] as string[] }))
    if (natural) return natural
    // „přečti stránku https://…“, „udělej screenshot seznam.cz“
    const web = await tryNaturalMcpIntent(trimmed).catch((e: any) => ({ reply: `❌ MCP: ${e?.message ?? e}`, steps: [] as string[] }))
    if (web) return web
    // „vypiš soubory na ploše“, „přečti plocha/x.txt“ — rovnou udělat, ne se vyptávat
    const files = await tryNaturalFileIntent(trimmed).catch((e: any) => ({ reply: `❌ ${e?.message ?? e}`, steps: [] as string[] }))
    if (files) return files
  }

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
    case 'terminal':
    case 'cmd':
      return shellCommand('cmd', args)
    case 'ps':
    case 'powershell':
      return shellCommand('ps', args)
    case 'exit':
      return exitShell()
    case 'mcp':
      return mcpCommand(args).catch((e: any) => ({ reply: `❌ MCP: ${e?.message ?? e}`, steps: ['Mary Jane: /mcp'] }))
    case 'fetch':
    case 'stahni':
      return fetchCommand(args).catch((e: any) => ({ reply: `❌ Fetch MCP: ${e?.message ?? e}`, steps: ['Mary Jane: /fetch'] }))
    case 'web':
      return webCommand(args).catch((e: any) => ({ reply: `❌ Playwright MCP: ${e?.message ?? e}`, steps: ['Mary Jane: /web'] }))
    case 'screenshot':
    case 'snimek':
      return screenshotCommand(args).catch((e: any) => ({ reply: `❌ Playwright MCP: ${e?.message ?? e}`, steps: ['Mary Jane: /screenshot'] }))
    case 'strazce':
    case 'strazc':
    case 'hlidac':
      return strazceCommand(args)
    case 'napad': {
      if (!args) return { reply: 'Jak na to: /napad <text>\nnapř. /napad agent, co hlídá ceny na Alze\nNápad se objeví na prvním dashboardu v panelu NÁPADY. Seznam: /napady', steps: ['Mary Jane: /napad'] }
      const { addNapad } = await import('../routes/napady.js')
      const n = await addNapad(args, 'chat')
      return { reply: `💡 Nápad uložen: „${n.title}“\nNajdeš ho na dashboardu v panelu NÁPADY (podrobnosti přidáš malým +). Všechny: /napady`, steps: ['Mary Jane: /napad'] }
    }
    case 'napady': {
      const { loadNapady } = await import('../routes/napady.js')
      const list = (await loadNapady()).filter((n) => !n.done)
      return {
        reply: list.length
          ? ['💡 NÁPADY', ...list.slice(0, 30).map((n, i) => `${i + 1}. ${n.title}${n.notes.length ? ` (+${n.notes.length})` : ''}`), ...(list.length > 30 ? [`… a dalších ${list.length - 30}`] : [])].join('\n')
          : '💡 Zatím žádné nápady. Přidej: /napad <text>',
        steps: ['Mary Jane: /napady'],
      }
    }
    case 'grill':
    case 'brainstorm': {
      const steps = ['Mary Jane: /grill (skill grill-me)']
      if (/^(stop|konec|hotovo|end)$/i.test(args)) return { reply: await stopGrill(), steps }
      if (!args) {
        return { reply: grillActive() ? 'Grill běží — odpovídej normálně, /grill stop = shrnutí a konec.' : 'Jak na to: /grill <téma>\nnapř. /grill spuštění e-shopu s hračkami\nMary se bude ptát po kolech (s doporučenými odpověďmi), /grill stop = shrnutí.', steps }
      }
      return { reply: await startGrill(args).catch((e: any) => `❌ Grill: ${e?.message ?? e}`), steps }
    }
    case 'luuu':
    case 'maily':
    case 'posta': {
      // /luuu smaž spam | newslettery → celá schránka, nejdřív spočítá a čeká na /ano
      const wipe = wholeMailboxWipe(args)
      if (wipe) return wipe
      // /luuu = nové od minula · /luuu 3 = posledních 3 dní
      const days = Number(args.match(/\d+/)?.[0]) || null
      const { runLuuu } = await import('./luuu.js')
      const { text } = await runLuuu(days)
      return { reply: text, steps: ['Mary Jane: /luuu → Luuu'] }
    }
    case 'ano':
      return { reply: await confirmPending(args), steps: ['Mary Jane: /ano'] }
    case 'ne':
      return { reply: cancelPending(args), steps: ['Mary Jane: /ne'] }
    case 'py':
    case 'python':
      return pyCommand(args)
    case 'skript':
    case 'script':
      return scriptCommand(args)
    case 'spust':
    case 'agent':
      return runAgentCommand(args)
    case 'ls':
    case 'dir':
    case 'soubory':
    case 'slozka':
      return listDirectory(args).catch((e: any) => ({ reply: `❌ ${e?.message ?? e}`, steps: ['Mary Jane: /ls'] }))
    case 'cat':
    case 'precti':
    case 'otevri':
      if (!args) return { reply: 'Jak na to: /cat <soubor> — např. /cat plocha/poznamky.txt', steps: ['Mary Jane: /cat'] }
      return readFileCommand(args).catch((e: any) => ({ reply: `❌ ${e?.message ?? e}`, steps: ['Mary Jane: /cat'] }))
    case 'najdi':
    case 'hledej':
      return findFiles(args).catch((e: any) => ({ reply: `❌ ${e?.message ?? e}`, steps: ['Mary Jane: /najdi'] }))
    case 'new': {
      if (!args) return { reply: newUsage(), steps: ['Mary Jane: /new'] }
      const parsed = parseNewKind(args)
      // mcp / skill bez tématu (třeba tlačítko v Telegramu) → jen návod, ať se nespustí research naslepo
      const bare = args.trim().toLowerCase()
      if (bare === 'mcp' || bare === 'skill' || bare === '3' || bare === '4') {
        const what = bare === 'mcp' || bare === '4' ? 'mcp' : 'skill'
        return { reply: `Napiš téma: /new ${what} <téma>\nnapř. /new ${what} ${what === 'mcp' ? 'počasí z ČHMÚ' : 'psaní inzerátů'}\nJulia k tomu udělá research a Koštěrad předvyplní manifest.`, steps: ['Mary Jane: /new'] }
      }
      // mcp / skill s tématem (a čísla 3, 4) dál řeší orchestrátor s researchem
      if (!parsed) return null
      return runNewCapability(parsed.kind, parsed.rest).catch((err) => ({
        reply: `❌ Založení selhalo: ${err?.message ?? err}`,
        steps: [`Mary Jane: /new ${parsed.kind}`],
      }))
    }
    default:
      return null
  }
}
