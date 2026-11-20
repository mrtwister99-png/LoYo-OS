#!/usr/bin/env node
// data/capabilities/agents/lopatinka/telegram-check.mjs
// Diagnostika Telegramu pro Lopatinku — zjistí, proč getUpdates nic nevrací,
// a vypíše chat ID, které patří do TELEGRAM_CHAT_ID.
//
// Použití:
//   node telegram-check.mjs                  → kdo je bot, je nastavený webhook, jaké chaty vidí
//   node telegram-check.mjs --delete-webhook → zruší webhook (jinak getUpdates nefunguje)
//   node telegram-check.mjs --reply          → pošle do nalezeného chatu testovací zprávu
//
// Token se bere z ENV nebo z .env v rootu projektu. Nikdy se nevypisuje.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../../..')

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

const args = new Set(process.argv.slice(2))
const line = (s = '') => console.log(s)

async function api(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok && data?.ok === true, data }
}

function describeChat(chat) {
  const name =
    [chat.title, [chat.first_name, chat.last_name].filter(Boolean).join(' '), chat.username]
      .filter(Boolean)[0] ?? '(bez jména)'
  return `${chat.id}  —  ${chat.type}: ${name}`
}

async function main() {
  await loadDotEnv()

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    line('✗ V .env (root projektu) ani v ENV není TELEGRAM_BOT_TOKEN.')
    line('  Vlož tam token z @BotFather: TELEGRAM_BOT_TOKEN=1234567890:AAE...')
    process.exitCode = 1
    return
  }

  // 1) Platnost tokenu
  const me = await api(token, 'getMe')
  if (!me.ok) {
    line(`✗ Token je neplatný (HTTP ${me.status}: ${me.data?.description ?? 'bez popisu'}).`)
    line('  Zkontroluj, že jsi zkopíroval celý token z BotFather a nic na konci neuřízl.')
    process.exitCode = 1
    return
  }
  const bot = me.data.result
  line(`✓ Bot: @${bot.username} (id ${bot.id})`)
  if (!bot.can_join_groups) line('  (bot nesmí do skupin — pro skupinový chat ho musíš povolit v BotFather)')

  // 2) Webhook — když je nastavený, getUpdates vrací prázdno
  const hook = await api(token, 'getWebhookInfo')
  const hookUrl = hook.data?.result?.url ?? ''
  if (hookUrl) {
    line(`! Je nastavený webhook: ${hookUrl}`)
    line('  Telegram kvůli tomu zprávy přes getUpdates nevydá.')
    if (args.has('--delete-webhook')) {
      const del = await api(token, 'deleteWebhook', { drop_pending_updates: false })
      line(del.ok ? '✓ Webhook zrušen.' : `✗ Webhook se nepodařilo zrušit: ${del.data?.description}`)
    } else {
      line('  Spusť: node data/capabilities/agents/lopatinka/telegram-check.mjs --delete-webhook')
    }
  } else {
    line('✓ Webhook není nastavený (getUpdates tedy funguje).')
  }

  // 3) Zprávy, které bot dostal
  const updates = await api(token, 'getUpdates')
  if (updates.status === 409) {
    line('✗ HTTP 409: zprávy čte i někdo jiný (getUpdates běží jinde nebo je nastavený webhook).')
    line('  Zastav druhý proces / zruš webhook a zkus to znovu.')
    process.exitCode = 1
    return
  }
  if (!updates.ok) {
    line(`✗ getUpdates selhal (HTTP ${updates.status}: ${updates.data?.description ?? 'bez popisu'}).`)
    process.exitCode = 1
    return
  }

  const list = updates.data.result ?? []
  if (list.length === 0) {
    line('')
    line('✗ getUpdates je prázdné → bot od nikoho žádnou zprávu nemá.')
    line('  Nejčastější příčiny:')
    line('   1. Napsal jsi jinému botovi (porovnej @username výše s tím, kterého máš otevřeného).')
    line('   2. Zpráva se neodeslala — otevři chat, zmáčkni /start a pošli „ahoj“ znovu.')
    line('   3. Bot je zablokovaný nebo smazaný chat — odblokuj ho.')
    line('  Pak spusť tento skript znovu.')
    return
  }

  line('')
  line('Nalezené chaty (první číslo je TELEGRAM_CHAT_ID):')
  const seen = new Map()
  for (const u of list) {
    const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat ?? u.edited_message?.chat
    if (chat && !seen.has(chat.id)) {
      seen.set(chat.id, chat)
      line(`  ${describeChat(chat)}`)
    }
  }
  if (seen.size === 0) {
    line('  (zprávy dorazily, ale bez chatu — zkus napsat botovi normální text)')
    return
  }

  const chatId = process.env.TELEGRAM_CHAT_ID
  line('')
  if (chatId) {
    const known = [...seen.keys()].map(String).includes(String(chatId))
    line(known ? `✓ TELEGRAM_CHAT_ID=${chatId} odpovídá některému z chatů.` : `! TELEGRAM_CHAT_ID=${chatId} v seznamu není — přepiš ho podle výpisu výše.`)
  } else {
    line('! V .env chybí TELEGRAM_CHAT_ID — vlož tam číslo z výpisu výše.')
  }

  // 4) Ověření, že bot umí do chatu psát
  if (args.has('--reply')) {
    const target = chatId ?? String([...seen.keys()][0])
    const sent = await api(token, 'sendMessage', {
      chat_id: target,
      text: '✅ Lopatinka: test spojení. Tuhle zprávu poslal tvůj bot.',
      disable_web_page_preview: true,
    })
    line(sent.ok ? `✓ Testovací zpráva odeslána do chatu ${target}.` : `✗ Odeslání selhalo: ${sent.data?.description}`)
    if (!sent.ok) process.exitCode = 2
  } else {
    line('')
    line('Chceš si ověřit doručení? Spusť: node data/capabilities/agents/lopatinka/telegram-check.mjs --reply')
  }
}

main().catch((err) => {
  console.error('✗ Chyba:', err.message)
  process.exitCode = 1
})
