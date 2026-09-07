// D:\dev\loyo-os\apps\api\src\services\chatHistory.ts
// LOYO OS // 14denní rotující historie chatu + audit log
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const HISTORY_DIR = resolve(__dirname, '../../../../data/chat_history')
const AUDIT_FILE  = resolve(__dirname, '../../../../data/chat_history/audit.jsonl')

const DAY_NAMES = ['nedele', 'pondeli', 'utery', 'streda', 'ctvrtek', 'patek', 'sobota']

type ChatEntry = { from: 'me' | 'mary'; text: string; ts: string }
type DayFile = { date: string; messages: ChatEntry[] }

// ISO číslo týdne (1–53)
function isoWeekNumber(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// sudý týden = suffix "_a", lichý = "_b" → 14 souborů, přepis po 2 týdnech
function weekSuffix(d: Date): string {
  return isoWeekNumber(d) % 2 === 0 ? '_a' : '_b'
}

function todayName(): string {
  const now = new Date()
  return DAY_NAMES[now.getDay()] + weekSuffix(now)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// všechny možné názvy souborů (14 dní)
const ALL_FILE_NAMES = DAY_NAMES.flatMap(d => [`${d}_a`, `${d}_b`])

function dayFilePath(name: string) {
  return join(HISTORY_DIR, `${name}.json`)
}

async function readDayFile(name: string): Promise<DayFile> {
  try {
    const raw = await readFile(dayFilePath(name), 'utf-8')
    return JSON.parse(raw) as DayFile
  } catch {
    return { date: '', messages: [] }
  }
}

async function writeDayFile(name: string, data: DayFile) {
  await mkdir(HISTORY_DIR, { recursive: true })
  await writeFile(dayFilePath(name), JSON.stringify(data, null, 2), 'utf-8')
}

// ---------- uloží novou zprávu do dnešního dne (přepíše starý týden, pokud je potřeba) ----------
export async function saveChatMessage(from: 'me' | 'mary', text: string) {
  const name = todayName()
  const today = todayISO()
  const existing = await readDayFile(name)

  const isNewOccurrence = existing.date !== today
  const messages = isNewOccurrence ? [] : existing.messages

  const entry: ChatEntry = { from, text, ts: new Date().toISOString() }
  messages.push(entry)
  await writeDayFile(name, { date: today, messages })

  // audit log — každá zpráva jako jeden JSON řádek (JSONL), nikdy se nepřepisuje
  await mkdir(HISTORY_DIR, { recursive: true })
  await appendFile(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf-8')
}

// ---------- načte posledních 14 dní, poskládá chronologicky ----------
export async function getChatHistory(): Promise<ChatEntry[]> {
  const files = await Promise.all(ALL_FILE_NAMES.map(readDayFile))
  const valid = files.filter(f => f.date) // jen soubory, co mají vyplněné datum
  valid.sort((a, b) => a.date.localeCompare(b.date))
  return valid.flatMap(f => f.messages).sort((a, b) => a.ts.localeCompare(b.ts))
}

// ---------- smaže vše (pro tlačítko "vymazat historii", pokud budeš chtít) ----------
export async function clearChatHistory() {
  await Promise.all(ALL_FILE_NAMES.map(name => writeDayFile(name, { date: '', messages: [] })))
}
