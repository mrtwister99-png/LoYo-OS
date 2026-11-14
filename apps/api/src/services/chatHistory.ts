// D:\dev\loyo-os\apps\api\src\services\chatHistory.ts
// LOYO OS // 14denní rotující historie chatu + audit log
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from '../lib/connection'
import { DATA_DIR } from '../lib/dataPaths.js'

const HISTORY_DIR = join(DATA_DIR, 'chat_history')
const AUDIT_FILE  = join(HISTORY_DIR, 'audit.jsonl')

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

// ---------- ÚKOL 34.2: dlouhá paměť – denní souhrny v SQLite (fulltext) ----------
// zprávy zadaného dne (jen pokud soubor opravdu patří k tomu datu)
export async function getChatDay(dateISO: string): Promise<ChatEntry[]> {
  const d = new Date(`${dateISO}T12:00:00`)
  const f = await readDayFile(DAY_NAMES[d.getDay()] + weekSuffix(d))
  return f.date === dateISO ? f.messages : []
}

function memoryDb() {
  const db = getDb()
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(date UNINDEXED, agent UNINDEXED, text, tokenize='unicode61 remove_diacritics 2')`)
  return db
}

// uloží (nebo přepíše) souhrn dne pro agenta
export function saveMemorySummary(date: string, agent: string, text: string) {
  const db = memoryDb()
  db.prepare('DELETE FROM memory_fts WHERE date = ? AND agent = ?').run(date, agent)
  db.prepare('INSERT INTO memory_fts (date, agent, text) VALUES (?, ?, ?)').run(date, agent, text)
}

// vyhledá souhrny podle slov (bez diakritiky, předpony), nejlepší shoda první
export function searchMemorySummaries(query: string, limit = 3): { date: string; agent: string; text: string }[] {
  const tokens = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) || []
  if (!tokens.length) return []
  const q = tokens.map(t => `"${t}"*`).join(' OR ')
  try {
    return memoryDb().prepare('SELECT date, agent, text FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?').all(q, limit) as any[]
  } catch { return [] }
}

// ---------- ÚKOL 34.3 + 4.x: výběr podle data a slučování starých souhrnů ----------
// souhrny z rozmezí dat (včetně měsíčních záznamů YYYY-MM), nejnovější první
export function getMemoryByDateRange(from: string, to: string, limit = 4): { date: string; agent: string; text: string }[] {
  try {
    return memoryDb().prepare('SELECT date, agent, text FROM memory_fts WHERE date >= ? AND date <= ? ORDER BY date DESC LIMIT ?').all(from, to, limit) as any[]
  } catch { return [] }
}

// souhrny starší než 12 měsíců se sloučí po měsících (jeden záznam YYYY-MM na agenta)
export function compactOldMemory(months = 12): number {
  const db = memoryDb()
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cut = cutoff.toISOString().slice(0, 10)
  const rows = db.prepare('SELECT date, agent, text FROM memory_fts WHERE length(date) = 10 AND date < ? ORDER BY date').all(cut) as any[]
  const groups = new Map<string, { month: string; agent: string; parts: string[] }>()
  for (const r of rows) {
    const key = `${r.date.slice(0, 7)}|${r.agent}`
    const g = groups.get(key) || { month: r.date.slice(0, 7), agent: r.agent, parts: [] as string[] }
    g.parts.push(`[${r.date}] ${r.text}`)
    groups.set(key, g)
  }
  for (const g of groups.values()) {
    const ex = db.prepare('SELECT text FROM memory_fts WHERE date = ? AND agent = ?').get(g.month, g.agent) as any
    const text = [ex?.text, ...g.parts].filter(Boolean).join('\n\n')
    db.prepare('DELETE FROM memory_fts WHERE date = ? AND agent = ?').run(g.month, g.agent)
    db.prepare('DELETE FROM memory_fts WHERE length(date) = 10 AND date LIKE ? AND date < ? AND agent = ?').run(`${g.month}-%`, cut, g.agent)
    db.prepare('INSERT INTO memory_fts (date, agent, text) VALUES (?, ?, ?)').run(g.month, g.agent, text)
  }
  return rows.length
}

// ---------- ÚKOL 34 / 3.x: vektory souhrnů (hledání podle významu) ----------
function vecDb() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS memory_vec (date TEXT, agent TEXT, vec BLOB, PRIMARY KEY (date, agent))`)
  return db
}

export function saveMemoryVector(date: string, agent: string, vec: number[]) {
  vecDb().prepare('INSERT OR REPLACE INTO memory_vec (date, agent, vec) VALUES (?, ?, ?)').run(date, agent, Buffer.from(new Float32Array(vec).buffer))
}

// nejbližší souhrny k dotazu (kosinová podobnost), jen nad prahem
export function searchMemoryByVector(query: number[], limit = 3, minScore = 0.55): { date: string; agent: string; text: string; score: number }[] {
  try {
    const rows = vecDb().prepare('SELECT date, agent, vec FROM memory_vec').all() as any[]
    const q = Float32Array.from(query)
    const norm = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1
    const qn = norm(q)
    const scored = rows.map(r => {
      const v = new Float32Array(r.vec.buffer.slice(r.vec.byteOffset, r.vec.byteOffset + r.vec.byteLength))
      let dot = 0
      for (let i = 0; i < Math.min(v.length, q.length); i++) dot += v[i] * q[i]
      return { date: r.date as string, agent: r.agent as string, score: dot / (norm(v) * qn) }
    }).filter(s => s.score >= minScore).sort((a, b) => b.score - a.score).slice(0, limit)
    const get = memoryDb().prepare('SELECT text FROM memory_fts WHERE date = ? AND agent = ?')
    return scored.map(s => ({ ...s, text: (get.get(s.date, s.agent) as any)?.text ?? '' })).filter(s => s.text)
  } catch { return [] }
}

// ---------- 4.x: měsíční záznamy po slučování, které jsou moc dlouhé a čekají na shrnutí obsahu ----------
export function getLongMonthRows(minChars = 3000): { date: string; agent: string; text: string }[] {
  try {
    return memoryDb().prepare('SELECT date, agent, text FROM memory_fts WHERE length(date) = 7 AND length(text) > ?').all(minChars) as any[]
  } catch { return [] }
}