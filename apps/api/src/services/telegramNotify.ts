// apps/api/src/services/telegramNotify.ts
// LOYO OS // MARY JANE — API samo pošle zprávu do Telegram chatu Mary.
// Používá fronta (výsledky úkolů zadaných z Telegramu) a plánovač (/voda, /daily-brief…).
// Token a chat id bere z ENV nebo z .env v rootu (stejné klíče jako telegram-bot.mjs).
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths.js'

let envCache: Record<string, string> | null = null

export async function envValue(key: string): Promise<string> {
  if (process.env[key]) return process.env[key] as string
  if (!envCache) {
    envCache = {}
    const raw = await readFile(resolve(DATA_DIR, '..', '.env'), 'utf8').catch(() => '')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) envCache[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return envCache[key] ?? ''
}

function splitText(text: string, max = 3800): string[] {
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
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

// Interní značky pro Builder v UI do Telegramu nepatří.
export function telegramClean(text: string): string {
  return String(text ?? '')
    .replace(/OPEN_BUILDER:[^\n]*\n?/g, '')
    .replace(/PICKER:[^\n]*\n?/g, '')
    .trim()
}

/** Pošle text do Telegram chatu Mary. Vrací false, když Telegram není nastavený nebo selže. */
export async function sendTelegram(text: string): Promise<boolean> {
  if ((await envValue('MARY_TELEGRAM_NOTIFY')) === '0') return false
  const token = (await envValue('TELEGRAM_MARY_BOT_TOKEN')) || (await envValue('TELEGRAM_BOT_TOKEN'))
  const chatId = (await envValue('TELEGRAM_MARY_CHAT_ID')) || (await envValue('TELEGRAM_CHAT_ID'))
  const clean = telegramClean(text)
  if (!token || !chatId || !clean) return false
  try {
    for (const chunk of splitText(clean)) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) return false
    }
    return true
  } catch {
    return false
  }
}
