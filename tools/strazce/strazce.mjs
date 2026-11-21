#!/usr/bin/env node
// tools/strazce/strazce.mjs — STRÁŽCE LoYo OS
// Samostatný hlídač (nezávisí na LoYo API, přežije jeho pád):
//   • každých 30 s: běží API (:3001)? běží Mary Telegram bot?
//   • API spadlo 2× po sobě → Telegram „⚠ LoYo spadlo, nahazuju…“ → spustí API (minimalizované)
//     → počká → API samo nahodí Mary bota → Telegram „Jsem nahozená!!! :D“
//   • API běží, bot ne → nahodí bota
//   • pauza: soubor data/strazce/pauza (Q ve spouštěči, /strazce pauza) → nic neobnovuje
//   • stránka pro telefon: http://<tailscale-ip>:3099/?token=… (stav + tlačítko Nahodit)
//
// Spuštění: node tools/strazce/strazce.mjs  (autostart: tools/strazce/install.ps1)
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(ROOT, 'data', 'strazce')
const PAUSE = join(DIR, 'pauza')
const STATE = join(DIR, 'state.json')
const LOG = join(ROOT, 'data', 'logs', 'strazce.log')
const PID = join(DIR, 'strazce.pid')
// „localhost“, ne 127.0.0.1: API v Node 22 poslouchá často jen na IPv6 (::1)
const API = 'http://localhost:3001'
const CHECK_MS = 30_000
const START_WAIT_MS = 150_000
const PORT = Number(process.env.STRAZCE_PORT) || 3099

mkdirSync(DIR, { recursive: true })
mkdirSync(dirname(LOG), { recursive: true })

function log(msg) {
  const line = `[${new Date().toLocaleString('cs-CZ')}] ${msg}`
  console.log(line)
  try { appendFileSync(LOG, line + '\n', 'utf8') } catch {}
}

// ---------- .env (token Telegramu, token Strážce) ----------
function env() {
  const out = {}
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  } catch {}
  return { ...out, ...process.env }
}

// token pro stránku na telefonu: vygeneruje se jednou a uloží do .env
function strazceToken() {
  const e = env()
  if (e.LOYO_STRAZCE_TOKEN) return e.LOYO_STRAZCE_TOKEN
  const token = randomBytes(12).toString('base64url')
  try {
    const p = join(ROOT, '.env')
    const raw = existsSync(p) ? readFileSync(p, 'utf8') : ''
    writeFileSync(p, `${raw.replace(/\s*$/, '')}\n# Strážce: token pro stránku na telefonu (http://<tailscale-ip>:${PORT}/?token=…)\nLOYO_STRAZCE_TOKEN=${token}\n`, 'utf8')
    log('vygenerován LOYO_STRAZCE_TOKEN do .env')
  } catch {}
  return token
}

async function telegram(text) {
  const e = env()
  const token = e.TELEGRAM_MARY_BOT_TOKEN || e.TELEGRAM_BOT_TOKEN
  const chat = e.TELEGRAM_MARY_CHAT_ID || e.TELEGRAM_CHAT_ID
  if (!token || !chat || e.MARY_TELEGRAM_NOTIFY === '0') return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) { log(`telegram: ${err?.message ?? err}`) }
}

async function apiUp() {
  try { const r = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(5000) }); return r.ok } catch { return false }
}
async function botStatus() {
  try { const r = await fetch(`${API}/api/agents/mary-jane/telegram`, { signal: AbortSignal.timeout(5000) }); return r.ok ? await r.json() : null } catch { return null }
}
async function startBot() {
  try { await fetch(`${API}/api/agents/mary-jane/telegram/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30_000) }) } catch {}
}

function startApi() {
  // stejně jako spouštěč: klasický conhost, minimalizovaný, titulek „LoYo OS - API“
  spawn('taskkill', ['/F', '/T', '/FI', 'WINDOWTITLE eq LoYo OS - API*'], { windowsHide: true }).on('error', () => {})
  // přes start-api.cmd: Node → PowerShell s vnořenými uvozovkami okno nespustil
  spawn('cmd.exe', ['/d', '/c', join(ROOT, 'tools', 'strazce', 'start-api.cmd')], { windowsHide: true, detached: true, stdio: 'ignore' }).unref()
}

const state = { since: new Date().toISOString(), lastCheck: null, api: null, bot: null, failures: 0, restarts: 0, lastRestart: null, busy: false }
function save() { try { writeFileSync(STATE, JSON.stringify({ ...state, paused: existsSync(PAUSE) }, null, 2)) } catch {} }

async function restore(reason) {
  if (state.busy) return
  state.busy = true
  try {
    log(`nahazuju LoYo API (${reason})`)
    await telegram(`⚠ LoYo OS spadlo (${reason}) — Strážce ho nahazuje…`)
    startApi()
    const t0 = Date.now()
    while (Date.now() - t0 < START_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 3000))
      if (await apiUp()) break
    }
    if (!(await apiUp())) {
      log('API se nenahodilo do 150 s')
      await telegram('❌ Strážce: LoYo API se nenahodilo do 2,5 min. Mrkni na PC (okno „LoYo OS - API“).')
      return
    }
    // API po startu samo zapne bota; kdyby ne, pomůžeme
    for (let i = 0; i < 10; i++) {
      const b = await botStatus()
      if (b?.running || b?.configured === false) break
      if (i === 3) await startBot()
      await new Promise((r) => setTimeout(r, 2000))
    }
    state.restarts++
    state.lastRestart = new Date().toISOString()
    state.failures = 0
    log(`nahozeno za ${Math.round((Date.now() - t0) / 1000)} s`)
    await telegram('💃 Jsem nahozená!!! :D\n— Mary (díky Strážci)')
    // oznámení NUTNÉ v horní liště LoYo
    await fetch(`${API}/api/notifications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'urgent', command: 'Strážce', message: `LoYo OS spadlo (${reason}) — Strážce ho nahodil za ${Math.round((Date.now() - t0) / 1000)} s` }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})
  } finally {
    state.busy = false
    save()
  }
}

async function check() {
  state.lastCheck = new Date().toISOString()
  if (existsSync(PAUSE)) { save(); return }
  state.api = await apiUp()
  if (!state.api) {
    state.failures++
    log(`API neodpovídá (${state.failures}×)`)
    if (state.failures >= 2) await restore('API neodpovídá')
  } else {
    state.failures = 0
    const b = await botStatus()
    state.bot = b?.running ?? null
    // bot nahodit, až když neběží 2 kontroly po sobě (jinak by se střetl s ručním restartem → dva boti)
    state.botDown = b && b.configured && !b.running ? (state.botDown ?? 0) + 1 : 0
    if (state.botDown >= 2 && !state.busy) {
      state.botDown = 0
      log('Mary bot neběží → nahazuju bota')
      await startBot()
      await new Promise((r) => setTimeout(r, 4000))
      if ((await botStatus())?.running) await telegram('💃 Jsem nahozená!!! :D\n— Mary (bot znovu běží, díky Strážci)')
    }
  }
  save()
}

// ---------- stránka pro telefon (jen Tailscale + localhost, s tokenem) ----------
function listenAddresses() {
  const addrs = ['127.0.0.1']
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && a.address.startsWith('100.')) addrs.push(a.address) // Tailscale CGNAT
  }
  return [...new Set(addrs)]
}

function page(token) {
  const s = { ...state, paused: existsSync(PAUSE) }
  const dot = (v) => (v === true ? '🟢' : v === false ? '🔴' : '⚪')
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Strážce LoYo OS</title><style>
body{font-family:system-ui,sans-serif;background:#0b0b10;color:#eee;margin:0;padding:22px;max-width:520px}
h1{font-size:22px;background:linear-gradient(90deg,#12a4ff,#ff2e97);-webkit-background-clip:text;color:transparent;margin:0 0 14px}
.row{display:flex;justify-content:space-between;padding:12px 14px;margin:8px 0;background:#16161f;border:1px solid #2a2a38;border-radius:12px}
button{width:100%;padding:15px;margin-top:12px;border:0;border-radius:12px;font-weight:800;font-size:15px;color:#fff;background:linear-gradient(90deg,#12a4ff,#ff2e97)}
.sec{background:#2a2a38}small{color:#888}</style></head><body>
<h1>STRÁŽCE · LoYo OS</h1>
<div class="row"><span>API (Mary)</span><b>${dot(s.api)}</b></div>
<div class="row"><span>Telegram bot</span><b>${dot(s.bot)}</b></div>
<div class="row"><span>Hlídání</span><b>${s.paused ? '⏸ pauza' : '▶ běží'}</b></div>
<div class="row"><span>Nahozeno</span><b>${s.restarts}×</b></div>
<small>Kontrola: ${s.lastCheck ? new Date(s.lastCheck).toLocaleString('cs-CZ') : '—'} · poslední nahození: ${s.lastRestart ? new Date(s.lastRestart).toLocaleString('cs-CZ') : '—'}</small>
<form method="post" action="/nahodit?token=${encodeURIComponent(token)}"><button>⚡ NAHODIT LOYO</button></form>
<form method="post" action="/${s.paused ? 'zapni' : 'pauza'}?token=${encodeURIComponent(token)}"><button class="sec">${s.paused ? '▶ ZAPNOUT HLÍDÁNÍ' : '⏸ POZASTAVIT HLÍDÁNÍ'}</button></form>
<script>setTimeout(()=>location.replace('/?token=${encodeURIComponent(token)}'),30000)</script></body></html>`
}

function serve(token) {
  const handler = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (url.searchParams.get('token') !== token) { res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Chybí nebo nesedí token.'); return }
    const back = () => { res.writeHead(303, { Location: `/?token=${encodeURIComponent(token)}` }); res.end() }
    if (req.method === 'POST' && url.pathname === '/nahodit') { restore('ručně z telefonu'); return back() }
    if (req.method === 'POST' && url.pathname === '/pauza') { writeFileSync(PAUSE, new Date().toISOString()); log('pauza (z telefonu)'); return back() }
    if (req.method === 'POST' && url.pathname === '/zapni') { rmSync(PAUSE, { force: true }); log('hlídání zapnuto (z telefonu)'); check(); return back() }
    if (url.pathname === '/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ...state, paused: existsSync(PAUSE) })); return }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page(token))
  }
  for (const host of listenAddresses()) {
    createServer(handler).listen(PORT, host, () => log(`stránka: http://${host}:${PORT}/?token=…`)).on('error', (e) => log(`server ${host}: ${e.message}`))
  }
}

// ---------- jen jeden Strážce naráz ----------
try {
  const old = Number(readFileSync(PID, 'utf8'))
  if (old && old !== process.pid) { process.kill(old, 0); console.log(`Strážce už běží (pid ${old}).`); process.exit(0) }
} catch {}
writeFileSync(PID, String(process.pid))
process.on('exit', () => { try { if (readFileSync(PID, 'utf8') === String(process.pid)) rmSync(PID) } catch {} })
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0))

const token = strazceToken()
log(`Strážce běží (pid ${process.pid}) · kontrola každých ${CHECK_MS / 1000} s`)
serve(token)
await check()
setInterval(() => { check().catch((e) => log(`chyba kontroly: ${e?.message ?? e}`)) }, CHECK_MS)
