#!/usr/bin/env node
// data/capabilities/agents/mary-jane/telegram-bot.mjs
// Mary Jane — řídicí Telegram bot LOYO OS.
// Veškerý text jde do API /api/run, takže z telefonu ovládáš celý systém:
// poznámky, úkoly, agenty (/lopatinka, /stepan, /kosterad, /julia), activity feed…
//
// Použití:
//   node telegram-bot.mjs              → běží do zastavení (Ctrl+C nebo API)
//   node telegram-bot.mjs --once       → zpracuje frontu a skončí
//   node telegram-bot.mjs --self-test  → offline test (bez Telegramu)
//
// ENV (v .env v rootu projektu):
//   TELEGRAM_BOT_TOKEN        jeden bot pro celý systém (Mary ho používá defaultně)
//   TELEGRAM_MARY_BOT_TOKEN   volitelný override, kdybys chtěl MarySeparátního bota
//   TELEGRAM_MARY_CHAT_ID     tvůj chat id (když chybí, použije se TELEGRAM_CHAT_ID)

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../../..')
const PID_PATH = join(__dirname, 'mary-telegram.pid')
const LOPATINKA_STATE = join(__dirname, '..', 'lopatinka', 'state.json')
const LOPATINKA_FEEDBACK = join(__dirname, '..', 'lopatinka', 'feedback.json')
const JULIA_INDEX = join(__dirname, 'julia-index.json')

const API_URL = (process.env.LOYO_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loadDotEnv() {
  const envPath = join(PROJECT_ROOT, '.env')
  if (!existsSync(envPath)) return
  const raw = await readFile(envPath, 'utf8').catch(() => '')
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}

async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(40_000),
  })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(`${method}: ${data?.description ?? `HTTP ${res.status}`}`)
  return data.result
}

// Telegram má limit 4096 znaků — rozdělit po řádcích.
export function splitText(text, max = 3800) {
  const chunks = []
  let current = ''
  for (const line of String(text ?? '').split('\n')) {
    if ((current + '\n' + line).length > max) {
      if (current) chunks.push(current)
      current = line.length > max ? line.slice(0, max) : line
    } else {
      current = current ? `${current}\n${line}` : line
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function sendLong(token, chatId, text, replyMarkup = null) {
  const clean = String(text ?? '').trim()
  if (!clean) return
  const chunks = splitText(clean)
  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
      ...(last && replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
  }
}

// Telegram neumí našeptávat další slovo → u příkazu bez argumentu nabídne možnosti tlačítky
// (stejné „args“ z commands.json jako našeptávač v UI). Klepnutí rovnou pošle např. „/new agent“.
async function optionsKeyboard(text) {
  // „/new“ i „/new ?“ (nápověda) → tlačítka s možnostmi
  const m = String(text).trim().match(/^(\/[^\s@?]+)(?:@\S+)?(?:\s*\?)?$/)
  if (!m) return null
  const data = await readJson(join(__dirname, 'commands.json'), { commands: [] })
  const cmd = (Array.isArray(data.commands) ? data.commands : []).find((c) => c?.name?.toLowerCase() === m[1].toLowerCase())
  const args = Array.isArray(cmd?.args) ? cmd.args.filter((a) => a?.value && !/^https?:\/\/$/.test(a.value)) : []
  if (!args.length) return null
  const buttons = args.slice(0, 12).map((a) => ({ text: `${cmd.name} ${a.value}` }))
  const rows = []
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2))
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true, input_field_placeholder: `${cmd.name} …` }
}

// pošle text (klidně na části) a tlačítko přilepí k poslední zprávě
async function sendWithButton(token, chatId, text, button) {
  const chunks = splitText(String(text ?? '').trim() || 'Hotovo.')
  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
      ...(last ? { reply_markup: { inline_keyboard: [[button]] } } : {}),
    })
  }
}

// Julia reporty: id → soubor, aby tlačítko mohlo text kdykoli otevřít
async function rememberJulia(file, query) {
  const id = Date.now().toString(36)
  const index = await readJson(JULIA_INDEX, { items: [] })
  const items = Array.isArray(index.items) ? index.items : []
  items.unshift({ id, file, query, ts: new Date().toISOString() })
  await writeJson(JULIA_INDEX, { items: items.slice(0, 20) })
  return id
}

const HELP = [
  '🤖 Mary Jane — řízení LOYO OS z Telegramu',
  '',
  'Piš normálně, rozumím celému systému. Povely:',
  '/agents — seznam agentů',
  '/zapni vše — spustí celou sestavu (Lopatinka + Koštěrad)',
  '/lopatinka [rozpočet] — hledat výhodnou elektroniku',
  '/stepan <co prodáváš> — ocenění + inzerát',
  '/kosterad — zkontrolovat a opravit agenty',
  '/julia <téma> — hloubkový research (výsledek otevřeš tlačítkem 📄)',
  '/activity — poslední akce agentů',
  '/boty — stav Telegram botů',
  '/cv — ControlVision server (ovládání PC z mobilu)',
  '/terminal · /ps — terminál na PC, každá zpráva = příkaz, /exit konec',
  '/new agent|team|workflow|cli … — založí novou věc (/new = návod)',
  '/grill <téma> — brainstorming (grill-me), /grill stop = shrnutí',
  '/luuu smaž spam — všechen spam z celého Gmailu do Koše (potvrdíš /ano)',
  '/luuu — Luuu roztřídí nové maily · /fetch <url> · /web <url> · /screenshot <url>',
  '/ano · /ne — potvrdit / zrušit riskantní příkaz',
  '/ls [plocha|stažené|dokumenty] · /cat <soubor> · /najdi <název> — soubory na PC',
  '/py <soubor.py> - <zadání> — napíšu Python skript (bez cesty = plocha)',
  '/skript <soubor> · /spust <agent> — spustí skript / agenta',
  'nebo větou: „udělej kurzy.py na plochu … a vytvoř agenta Joozina, ať ho použije“',
  '/vse — seznam všech povelů',
  '/note, /task, /status, /find, /research… — zbytek systému',
  '/id — chat id pro .env',
  '',
  'Jeden bot pro celý systém — Lopatinka už vlastního bota nemá, její 👍/👎 obsluhuju já.',
].join('\n')

// Zavolá orchestrátor; ten zprávu uloží do chat historie i run logu.
async function askMary(text) {
  const res = await fetch(`${API_URL}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, source: 'telegram' }),
    signal: AbortSignal.timeout(280_000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `API HTTP ${res.status}`)
  let reply = String(data?.reply ?? '').trim()
  // interní značky pro Builder v UI nemají v Telegramu co dělat
  const builder = /OPEN_BUILDER:/.test(reply)
  reply = reply.replace(/OPEN_BUILDER:[^\n]*\n?/g, '').replace(/PICKER:[^\n]*\n?/g, '').trim()
  if (builder) reply += '\n\n🧩 Builder je připravený v LOYO OS (UI) — doladíš a uložíš ho tam.'
  return {
    reply: reply || 'Hotovo. (odpověď byla prázdná — koukni do UI)',
    julia: data?.julia ?? null,
  }
}

// 👍/👎 u tipů Lopatinky chodí jako callback_query — obsluhuje ho tenhle jediný bot.
async function handleCallback(query, token, allowedChatId) {
  const [prefix, verdict, indexRaw] = String(query?.data ?? '').split(':')
  const chatId = query.message?.chat?.id

  // ✅ / ❌ u potvrzení (skill Bezpečný shell, Luuu mazání…) → /ano <kód> nebo /ne <kód>
  if (prefix === 'ok' || prefix === 'no') {
    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Tenhle bot patří k jinému chatu.' })
      return
    }
    const yes = prefix === 'ok'
    await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: yes ? 'Potvrzeno, dělám to…' : 'Zrušeno' }).catch(() => {})
    // tlačítka pryč, ať nejde kliknout dvakrát
    const original = String(query.message?.text ?? '')
    await tg(token, 'editMessageText', {
      chat_id: chatId,
      message_id: query.message.message_id,
      text: `${original}\n\n${yes ? '✅ potvrzeno' : '❌ zrušeno'}`,
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {})
    await tg(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {})
    try {
      const result = await askMary(`${yes ? '/ano' : '/ne'} ${verdict}`)
      await sendLong(token, chatId, result.reply)
    } catch (err) {
      await sendLong(token, chatId, `❌ Nepodařilo se spojit s LOYO API: ${String(err?.message ?? err)}`)
    }
    return
  }

  // 📄 tlačítko u Julie — pošle celý report jako text
  if (prefix === 'ju') {
    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Tenhle bot patří k jinému chatu.' })
      return
    }
    const index = await readJson(JULIA_INDEX, { items: [] })
    const entry = (Array.isArray(index.items) ? index.items : []).find((x) => x.id === verdict)
    if (!entry) {
      await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Report už nemám v paměti.' })
      return
    }
    const report = await readFile(entry.file, 'utf8').catch(() => '')
    if (!report.trim()) {
      await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Soubor s reportem chybí.' })
      return
    }
    await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Posílám celý report 📄' })
    await sendLong(token, chatId, `📄 ${entry.query}\n\n${report}`)
    return
  }
  if (prefix !== 'fb' || (verdict !== 'up' && verdict !== 'down')) return

  const state = await readJson(LOPATINKA_STATE, null)
  const pick = state?.lastPicks?.[Number(indexRaw)]
  if (!pick) {
    await tg(token, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Tip už nemám v paměti.' })
    return
  }

  const feedback = await readJson(LOPATINKA_FEEDBACK, { ratings: [] })
  feedback.ratings = Array.isArray(feedback.ratings) ? feedback.ratings : []
  feedback.ratings.push({
    ts: new Date().toISOString(),
    verdict,
    url: pick.url,
    title: pick.title,
    price: pick.price,
    portal: pick.portal,
    source: 'telegram',
  })
  await writeJson(LOPATINKA_FEEDBACK, { ratings: feedback.ratings.slice(-200) })

  await tg(token, 'answerCallbackQuery', {
    callback_query_id: query.id,
    text: verdict === 'up' ? 'Zapsáno 👍' : 'Už ti to nepošlu 👎',
  })

  const original = String(query.message?.text ?? '')
  const suffix = verdict === 'up' ? '\n\n👍 označeno jako zajímavé' : '\n\n👎 už ti to nepošlu'
  if (original && !original.includes(suffix.trim())) {
    try {
      await tg(token, 'editMessageText', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        text: original + suffix,
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [] },
      })
    } catch (err) {
      console.warn(`[mary-bot] editMessageText: ${err?.message ?? err}`)
    }
  }
}

async function handleMessage(message, token, allowedChatId) {
  const chatId = message?.chat?.id
  const text = String(message?.text ?? '').trim()
  if (!chatId || !text) return

  if (allowedChatId && String(chatId) !== String(allowedChatId)) {
    await sendLong(token, chatId, 'Tenhle bot patří k jinému chatu. Tvoje chat id je ' + chatId)
    return
  }

  if (text === '/id' || text === '/chatid') {
    await sendLong(token, chatId, `Tvoje chat id je ${chatId}`)
    return
  }
  if (text === '/start' || text === '/tg-help') {
    await sendLong(token, chatId, HELP)
    return
  }
  // terminál = plný přístup k PC → jen když je bot zamčený na tvoje chat id
  if (!allowedChatId && /^\/(terminal|terminál|cmd|ps|powershell)(\s|$)/i.test(text)) {
    await sendLong(
      token,
      chatId,
      `🔒 Terminál přes Telegram povolím, až bude bot zamčený na tvůj chat.\nDej do .env: TELEGRAM_MARY_CHAT_ID=${chatId} a restartuj bota.`,
    )
    return
  }

  await tg(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {})
  try {
    const result = await askMary(text)
    const julia = result?.julia
    if (julia?.file) {
      const id = await rememberJulia(julia.file, julia.query ?? '')
      await sendWithButton(token, chatId, result.reply, {
        text: '📄 Otevřít celý výsledek',
        callback_data: `ju:${id}`,
      })
    } else {
      // čeká se na potvrzení → tlačítka ✅ / ❌ (mají přednost před nabídkou možností)
      const code = String(result?.reply ?? '').match(/\/ano ([a-z0-9]{4})\b/)?.[1]
      const keyboard = code
        ? { inline_keyboard: [[{ text: '✅ Potvrdit', callback_data: `ok:${code}` }, { text: '❌ Zrušit', callback_data: `no:${code}` }]] }
        : await optionsKeyboard(text).catch(() => null)
      await sendLong(token, chatId, result?.reply ?? '', keyboard)
    }
  } catch (err) {
    await sendLong(
      token,
      chatId,
      `❌ Nepodařilo se spojit s LOYO API (${API_URL}).\n${String(err?.message ?? err)}\n\nBěží API na :3001?`,
    )
  }
}

// Telegram bere jen názvy a-z, 0-9, _ (max 32 znaků), popis max 256, nejvýš 100 příkazů
async function syncTelegramCommands(token) {
  const data = await readJson(join(__dirname, 'commands.json'), { commands: [] })
  const seen = new Set()
  const commands = []
  for (const c of Array.isArray(data.commands) ? data.commands : []) {
    if (c?.enabled === false) continue
    const name = String(c?.name ?? '').replace(/^\//, '').toLowerCase()
    if (!/^[a-z0-9_]{1,32}$/.test(name) || seen.has(name)) continue
    seen.add(name)
    commands.push({ command: name, description: String(c.description || name).slice(0, 256) })
  }
  commands.sort((a, b) => a.command.localeCompare(b.command))
  await tg(token, 'setMyCommands', { commands: commands.slice(0, 100) })
  console.log(`[mary-bot] menu příkazů: ${Math.min(commands.length, 100)}`)
}

let stopping = false

async function cleanupPid() {
  const current = await readFile(PID_PATH, 'utf8').catch(() => '')
  if (String(current).trim() === String(process.pid)) {
    await writeFile(PID_PATH, '', 'utf8').catch(() => {})
  }
}

async function selfTest() {
  const cases = [
    ['a'.repeat(50), 100, 1],
    [Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n'), 200, null],
  ]
  let failed = 0
  for (const [text, max, expected] of cases) {
    const parts = splitText(text, max)
    const ok = expected === null ? parts.every((p) => p.length <= max) && parts.join('\n') === text : parts.length === expected
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} splitText (${text.length} znaků, max ${max}) → ${parts.length} částí`)
  }
  console.log(failed ? `✗ ${failed} testů selhalo` : '✓ self-test OK')
  process.exitCode = failed ? 1 : 0
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--self-test')) return selfTest()

  await loadDotEnv()

  // Jeden bot pro celý systém. Lopatinka už vlastního bota nemá.
  const token = process.env.TELEGRAM_MARY_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('❌ Chybí TELEGRAM_BOT_TOKEN (nebo TELEGRAM_MARY_BOT_TOKEN).')
    console.error('   1) V Telegramu otevři @BotFather a použij token svého existujícího bota')
    console.error('   2) Vlož ho do .env v rootu projektu: TELEGRAM_BOT_TOKEN=123456:AAF...')
    console.error('   3) Nepovinně TELEGRAM_MARY_CHAT_ID=... (jinak se použije TELEGRAM_CHAT_ID)')
    process.exitCode = 1
    return
  }

  const allowedChatId = process.env.TELEGRAM_MARY_CHAT_ID || process.env.TELEGRAM_CHAT_ID || ''

  const me = await tg(token, 'getMe').catch((err) => {
    console.error(`❌ Token nefunguje: ${err?.message ?? err}`)
    return null
  })
  if (!me) {
    process.exitCode = 1
    return
  }

  // getUpdates funguje jen bez webhooku
  await tg(token, 'deleteWebhook', { drop_pending_updates: false }).catch((err) =>
    console.warn(`[mary-bot] deleteWebhook: ${err?.message ?? err}`),
  )

  // menu příkazů v Telegramu (po napsání „/“) = commands.json, stejně jako našeptávač v UI
  await syncTelegramCommands(token).catch((err) => console.warn(`[mary-bot] setMyCommands: ${err?.message ?? err}`))

  await writeFile(PID_PATH, String(process.pid), 'utf8')
  console.log(`[mary-bot] @${me.username} spuštěn (pid ${process.pid}) · API ${API_URL} · chat ${allowedChatId || 'jakýkoli'}`)

  const once = args.has('--once')
  let offset = 0
  while (!stopping) {
    let updates
    try {
      updates = await tg(token, 'getUpdates', {
        offset,
        timeout: once ? 0 : 25,
        allowed_updates: ['message', 'callback_query'],
      })
    } catch (err) {
      console.warn(`[mary-bot] getUpdates: ${err?.message ?? err}`)
      if (once) break
      await sleep(3000)
      continue
    }

    for (const update of updates ?? []) {
      offset = update.update_id + 1
      try {
        if (update.message) await handleMessage(update.message, token, allowedChatId)
        else if (update.callback_query) await handleCallback(update.callback_query, token, allowedChatId)
      } catch (err) {
        console.error(`[mary-bot] update ${update.update_id}: ${err?.message ?? err}`)
      }
    }

    if (once) break
  }

  await cleanupPid()
  console.log('[mary-bot] ukončen')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true
    cleanupPid().finally(() => process.exit(0))
  })
}

main().catch((err) => {
  console.error(`❌ Mary bot spadl: ${err?.stack ?? err}`)
  process.exit(1)
})
