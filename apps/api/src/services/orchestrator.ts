// D:\dev\loyo-os\apps\api\src\services\orchestrator.ts
// LOYO OS // ORCHESTRATOR — nervová soustava: MD mozky + CLI ruce + Ollama + paměť
import { Ollama } from 'ollama'
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { logActivity } from '../routes/activity'
import { logRun } from './runLogger'
import { getCapabilities } from '../lib/manifestLoader'
import { ragSearch } from '../lib/ragStore'
import { getChatDay, saveMemorySummary, searchMemorySummaries, getMemoryByDateRange, compactOldMemory, saveMemoryVector, searchMemoryByVector, getLongMonthRows } from './chatHistory'
import { webSearch, readSources, type SearchResult } from './web_search'
import { isShellMessage, tryAgentCommand } from './agentCommands'
import { sendTelegram } from './telegramNotify'
import { bumpAgentStats } from './agentStats'
import { slugify, safeName, nextFileNumber, readDirSafe } from './fileUtils'
import {
  DATA_DIR,
  AGENTS_DIR,
  REPORTS_DIR,
  JA_POZNAMKY_DIR,
  JA_UKOLY_AKTIVNI_DIR,
  JA_UKOLY_HOTOVE_DIR,
  JA_KALENDAR_DIR,
  RAG_DIR,
} from '../lib/dataPaths'
import { pickModel, getPriority, MODELS, type ModelSpec } from './modelRouter'
import { enqueueJob, markJobStatus, jobQueue } from './queue'

const execFileAsync = promisify(execFile)
// KONVENCE v3 - jediný zdroj pravdy je dataPaths.ts, žádný D:/ hardcode
const POZNAMKY_DIR = JA_POZNAMKY_DIR
const UKOLY_AKTIVNI_DIR = JA_UKOLY_AKTIVNI_DIR
const UKOLY_HOTOVE_DIR = JA_UKOLY_HOTOVE_DIR
const KALENDAR_DIR = JA_KALENDAR_DIR
const COMMANDS_FILE = join(AGENTS_DIR, 'mary-jane', 'commands.json')
const ROOT = resolve(DATA_DIR, '..')

const ollama = new Ollama({ host: 'http://localhost:11434' })
const MODEL = 'devstral-small-2:latest' // FIX 12GB RTX 4080
const FAST_MODEL = MODELS.FAST.model
const MAX_MEMORY_MESSAGES = 20 // posledních 10 výměn drženo v kontextu
const OLLAMA_TIMEOUT_MS = 90000 // ochrana proti zaseklému/pomalému modelu
const DEEP_TIMEOUT_MS = 200000 // deep research smí trvat déle (stahuje i celé stránky)

// fronta řeší p-queue, žádný in-memory boolean

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

type RunResult = { reply: string; steps: string[]; julia?: { file: string; query: string; chars: number } }

// ---------- dynamické příkazy z commands.json ----------
interface CommandDef
{
  name: string
  handler: string
  description: string
  enabled: boolean
  response?: string
  addedBy: string
  createdAt: string
  schedule?: { type: 'hourly' | 'daily'; from?: number; to?: number; at?: string }
}

interface CommandsFile
{
  commands: CommandDef[]
}

async function loadCommands(): Promise<CommandDef[]>
{
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data: CommandsFile = JSON.parse(raw)
    return data.commands.filter(c => c.enabled)
  }
  catch
  {
    return []
  }
}

async function saveCommands(commands: CommandDef[]): Promise<void>
{
  const data: CommandsFile = { commands }
  await writeFile(COMMANDS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

function matchCommand(message: string, commands: CommandDef[]): CommandDef | null
{
  const lower = message.trim().toLowerCase()
  // seřadíme od nejdelšího jména, aby /find nechytil /finder apod.
  const sorted = [...commands].sort((a, b) => b.name.length - a.name.length)
  for (const cmd of sorted)
  {
    const prefix = cmd.name.toLowerCase()
    if (lower === prefix || lower.startsWith(prefix + ' '))
    {
      return cmd
    }
  }
  return null
}

// ---------- obalí ollama.chat timeoutem, ať request nikdy nevisí navždy ----------
async function chatWithTimeout(
  params: Parameters<typeof ollama.chat>[0],
  ms: number = OLLAMA_TIMEOUT_MS,
): Promise<Awaited<ReturnType<typeof ollama.chat>>> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Ollama neodpověděla do ${ms / 1000}s (model: ${(params as any).model}). Zkontroluj, jestli se model vejde do VRAM, nebo zkus menší model.`)),
      ms,
    )
  })
  try {
    return await Promise.race([ollama.chat(params), timeout])
  } finally {
    clearTimeout(timer!)
  }
}

// ---------- normalizace legacy názvů Mary_Jane -> mary-jane ----------
const AGENT_FOLDER_MAP: Record<string, string> = {
  Mary_Jane: 'mary-jane',
  Lubor_Nehleda: 'lubor-nehleda',
  Julia_Nehledalova: 'julia-nehledalova',
  Kosterad_Fuckstein: 'kosterad-fuckstein',
}

function toKebabAgent(folder: string): string {
  return AGENT_FOLDER_MAP[folder] || folder.replace(/_/g, '-').toLowerCase()
}

function resolveAgentDir(folder: string): string {
  return join(AGENTS_DIR, toKebabAgent(folder))
}

// ---------- načte MD mozky agenta ----------
async function loadAgentDocs(folder: string): Promise<string> {
  try {
    const dir = resolveAgentDir(folder)
    const files = (await readdir(dir)).filter(f => f.endsWith('.md')).sort()
    const parts = await Promise.all(files.map(f => readFile(join(dir, f), 'utf-8')))
    return parts.join('\n\n---\n\n')
  } catch {
    return ''
  }
}

// ---------- načte model agenta z meta.json (fallback na výchozí MODEL) ----------
async function loadAgentModel(folder: string): Promise<string> {
  try {
    const raw = await readFile(join(resolveAgentDir(folder), 'meta.json'), 'utf-8')
    const meta = JSON.parse(raw)
    return meta.model || MODEL
  } catch {
    return MODEL
  }
}

// ---------- perzistentní paměť: data/capabilities/agents/<kebab>/memory.json ----------
function memoryPath(folder: string) {
  return join(resolveAgentDir(folder), 'memory.json')
}

async function loadMemory(folder: string): Promise<ChatMsg[]> {
  try {
    const raw = await readFile(memoryPath(folder), 'utf-8')
    return JSON.parse(raw) as ChatMsg[]
  } catch {
    return []
  }
}

async function saveMemory(folder: string, history: ChatMsg[]) {
  // úvodní SOUHRN (střední vrstva paměti) se při ořezu nesmí ztratit
  const head = history[0]?.role === 'system' && String(history[0].content).startsWith('SOUHRN')? [history[0]] : []
  const rest = head.length? history.slice(1) : history
  const trimmed = [...head, ...rest.slice(-(MAX_MEMORY_MESSAGES - head.length))]
  await mkdir(dirname(memoryPath(folder)), { recursive: true })
  await writeFile(memoryPath(folder), JSON.stringify(trimmed, null, 2), 'utf-8')
}


// ---------- ÚKOL 34.1: střední vrstva paměti – noční sumarizace ----------
// Starší zprávy z memory.json se shrnou do jedné zprávy SOUHRN, posledních 19 zůstane.
export async function summarizeAgentMemory(folder: string): Promise<string> {
  const history = await loadMemory(folder)
  if (history.length <= MAX_MEMORY_MESSAGES) return `paměť ${toKebabAgent(folder)}: ${history.length} zpráv, není co shrnout`
  const KEEP = MAX_MEMORY_MESSAGES - 1   // 1 místo pro SOUHRN
  const older = history.slice(0, history.length - KEEP)
  const recent = history.slice(-KEEP)
  const text = older
    .map((m: any) => `${m.role === 'user'? 'Tom' : m.role === 'assistant'? 'Mary' : 'Souhrn'}: ${m.content}`)
    .join('\n')
    .slice(0, 12000)
  const model = await loadAgentModel(folder)
  const res = await chatWithTimeout({
    model,
    messages: [
      { role: 'system', content: 'Shrň rozhovor do 8 stručných odrážek česky: témata, rozhodnutí, úkoly, jména, data. Žádný úvod ani závěr.' },
      { role: 'user', content: text },
    ],
    stream: false,
  } as any, 120_000)
  const summary = String((res as any).message?.content ?? '').trim()
  if (!summary) return `paměť ${toKebabAgent(folder)}: model nevrátil souhrn, nic se nezměnilo`
  const day = new Date().toISOString().slice(0, 10)
  const merged = [{ role: 'system', content: `SOUHRN dřívějšího rozhovoru (do ${day}):\n${summary}` }, ...recent] as ChatMsg[]
  await mkdir(dirname(memoryPath(folder)), { recursive: true })
  await writeFile(memoryPath(folder), JSON.stringify(merged, null, 2), 'utf-8')
  // čitelná kopie souhrnů pro člověka: memory_summary.md vedle memory.json
  const mdPath = join(dirname(memoryPath(folder)), 'memory_summary.md')
  let md = ''
  try { md = await readFile(mdPath, 'utf-8') } catch {}
  await writeFile(mdPath, `${md}\n## ${day}\n${summary}\n`, 'utf-8')
  await logActivity({ agent: 'Mary_Jane', type: 'system', action: `Paměť: shrnuto ${older.length} zpráv`, meta: { folder, kept: merged.length } }).catch(() => {})
  return `paměť ${toKebabAgent(folder)}: ${older.length} zpráv shrnuto, zůstává ${merged.length}`
}

// ---------- ÚKOL 34.2: denní souhrn chatu do dlouhé paměti ----------
export async function summarizeChatDay(dateISO: string): Promise<string> {
  const msgs = await getChatDay(dateISO)
  if (msgs.length < 4) return `chat ${dateISO}: ${msgs.length} zpráv, nic k uložení`
  const text = msgs.map(m => `${m.from === 'me'? 'Tom' : 'Mary'}: ${m.text}`).join('\n').slice(0, 12000)
  const model = await loadAgentModel('Mary_Jane')
  const res = await chatWithTimeout({
    model,
    messages: [
      { role: 'system', content: 'Shrň den rozhovoru do 6 stručných odrážek česky: témata, rozhodnutí, úkoly, jména. Žádný úvod ani závěr.' },
      { role: 'user', content: text },
    ],
    stream: false,
  } as any, 120_000)
  const summary = String((res as any).message?.content ?? '').trim()
  if (!summary) return `chat ${dateISO}: model nevrátil souhrn`
  saveMemorySummary(dateISO, 'mary-jane', summary)
  const vec = await embedText(summary)   // 3.x: vektor pro hledání podle významu (když je model nomic-embed-text)
  if (vec) saveMemoryVector(dateISO, 'mary-jane', vec)
  await writeLongMemoryFile(dateISO, 'mary-jane', summary)   // 4.x: i do RAG/agents/<č>-mary-jane/memory_long.md
  try { compactOldMemory(); await condenseLongMonths() } catch {}   // 4.x: souhrny starší než 12 měsíců se slučují po měsících a shrnou se
  await logActivity({ agent: 'Mary_Jane', type: 'system', action: `Dlouhá paměť: uložen souhrn dne ${dateISO}`, meta: { messages: msgs.length } }).catch(() => {})
  return `chat ${dateISO}: ${msgs.length} zpráv → souhrn uložen do dlouhé paměti`
}

// ---------- ÚKOL 34.3: dlouhá paměť do odpovědi ----------
// z "před měsícem / před 3 týdny / minulý týden" vyrobí rozmezí dat (s tolerancí)
function recallRange(text: string): { from: string; to: string } | null {
  const t = text.toLowerCase()
  let days = 0
  const m = t.match(/před\s+(\d+)\s+(dn\w*|dní|týdn\w*|měsíc\w*|rok\w*|let\w*)/)
  if (m) {
    const n = parseInt(m[1], 10)
    days = n * (m[2].startsWith('dn') || m[2] === 'dní'? 1 : m[2].startsWith('týdn')? 7 : m[2].startsWith('měs')? 30 : 365)
  } else if (/před\s+týdnem|minulý\s+týden|minulého\s+týdne/.test(t)) days = 7
  else if (/před\s+měsícem|minulý\s+měsíc|minulého\s+měsíce/.test(t)) days = 30
  else if (/před\s+rokem|loni|minulý\s+rok/.test(t)) days = 365
  if (!days) return null
  const tol = Math.max(3, Math.round(days * 0.25))
  const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
  return { from: iso(days + tol), to: iso(Math.max(0, days - tol)) }
}

const RECALL_CUE = /pamatuj|vzpomen|minule|předtím|mluvili jsme|bavili jsme|řešil|řešili|před\s+\d+|před\s+(týdnem|měsícem|rokem)|minulý\s+(týden|měsíc|rok)|loni/i

// vrátí text pro prompt (souhrny s daty zdroje) nebo null, když to není dotaz na minulost
async function recallLongMemory(userMessage: string): Promise<{ text: string; count: number; dates: string } | null> {
  if (!RECALL_CUE.test(userMessage)) return null
  const range = recallRange(userMessage)
  let rows = range? getMemoryByDateRange(range.from, range.to, 4) : []
  if (!rows.length) {
    rows = searchMemorySummaries(userMessage, 3)
    // 3.x: doplní souhrny podobné významem (ne jen slovy)
    const qv = await embedText(userMessage)
    if (qv) {
      for (const r of searchMemoryByVector(qv, 3)) if (!rows.some(x => x.date === r.date)) rows.push(r)
      rows = rows.slice(0, 4)
    }
  }
  if (!rows.length) return null
  const text = 'Co si pamatuješ z dřívějších dnů (dlouhá paměť; uváděj datum, odkud to víš):\n' + rows.map(r => `[${r.date}] ${r.text}`).join('\n\n')
  return { text, count: rows.length, dates: rows.map(r => r.date).join(', ') }
}

// vektor textu přes Ollamu (model nomic-embed-text); když model chybí, vrátí null
async function embedText(text: string): Promise<number[] | null> {
  try {
    const r: any = await (ollama as any).embed({ model: 'nomic-embed-text', input: text.slice(0, 4000) })
    const v = r?.embeddings?.[0]
    return Array.isArray(v) && v.length? v : null
  } catch { return null }
}

// 1.x: jednorázové zpětné shrnutí všech dnů, které ještě zbývají v chat_history (14 dní)
async function backfillChatMemory(): Promise<string> {
  const out: string[] = []
  for (let i = 0; i < 14; i++) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    out.push(await summarizeChatDay(day))
  }
  return out.join('\n')
}

// 4.x: měsíční záznamy po slučování shrne modelem do 10 odrážek (ne jen spojené texty)
async function condenseLongMonths(): Promise<number> {
  const rows = getLongMonthRows()
  if (!rows.length) return 0
  const model = await loadAgentModel('Mary_Jane')
  let n = 0
  for (const r of rows) {
    try {
      const res = await chatWithTimeout({
        model,
        messages: [
          { role: 'system', content: 'Shrň tyto denní souhrny jednoho měsíce do 10 stručných odrážek česky: hlavní témata, rozhodnutí, projekty, jména, data. Žádný úvod.' },
          { role: 'user', content: r.text.slice(0, 12000) },
        ],
        stream: false,
      } as any, 120_000)
      const s = String((res as any).message?.content ?? '').trim()
      if (s) { saveMemorySummary(r.date, r.agent, s.slice(0, 2900)); n++ }   // pod limit, ať se nesumarizuje pořád dokola
    } catch {}
  }
  return n
}

// 4.x: čitelná, verzovaná dlouhá paměť: RAG/agents/<číslo>-<id>/memory_long.md (úkoly 31 a 35)
async function writeLongMemoryFile(date: string, agentId: string, summary: string): Promise<void> {
  try {
    const base = join(RAG_DIR, 'agents')
    await mkdir(base, { recursive: true })
    let folder = (await readdir(base)).find(d => d === agentId || new RegExp(`^\\d+-${agentId}$`).test(d))
    if (!folder) {
      const cap: any = (await getCapabilities()).capabilities.find((c: any) => c.type === 'agent' && c.id === agentId)
      folder = cap?.number != null? `${cap.number}-${agentId}` : agentId
    }
    const dir = join(base, folder)
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'memory_long.md')
    let md = ''
    try { md = await readFile(file, 'utf-8') } catch {}
    // stejný den se přepíše (bezpečné při opakovaném /memory-backfill)
    md = md.replace(new RegExp(`\\n?## ${date}\\n[\\s\\S]*?(?=\\n## |$)`), '')
    await writeFile(file, `${md.trimEnd()}\n\n## ${date}\n${summary}\n`.trimStart(), 'utf-8')
  } catch {}
}

// ---------- vytáhne rozumný titulek z volného textu ----------
function extractTitle(text: string, maxLen = 60): string {
  const firstLine = text.split('\n')[0].trim()
  const punctMatch = firstLine.match(/^(.{3,}?[.!?])(\s|$)/)
  const base = punctMatch ? punctMatch[1] : firstLine
  return base.length > maxLen ? base.slice(0, maxLen).trim() + '…' : base
}

// "/note NECO. xx" -> název = NECO (do první tečky), popis = xx (zbytek)
function parseNoteInput(raw: string): { title: string; body: string } {
  const text = raw.trim()
  const dotIdx = text.indexOf('.')
  if (dotIdx === -1) return { title: text || 'Poznámka z chatu', body: '' }
  const title = text.slice(0, dotIdx).trim() || 'Poznámka z chatu'
  const body = text.slice(dotIdx + 1).trim()
  return { title, body }
}

// "/task NECO. xx, yy, zz" -> název = NECO, xx/yy/zz = jednotlivé checkbox položky
function parseTaskInput(raw: string): { title: string; items: string[] } {
  const text = raw.trim()
  const dotIdx = text.indexOf('.')
  if (dotIdx === -1) return { title: text || 'Úkol z chatu', items: [] }
  const title = text.slice(0, dotIdx).trim() || 'Úkol z chatu'
  const rest = text.slice(dotIdx + 1).trim()
  const items = rest ? rest.split(',').map(s => s.trim()).filter(Boolean) : []
  return { title, items }
}

// "/kalendar DD.MM.RRRR HH:MM popis" -> datum, čas, popis
function parseCalendarInput(raw: string): { date: string; time: string; title: string } | null {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s+(.+)$/)
  if (!m) return null
  const [, d, mo, y, h, mi, title] = m
  const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  const time = `${h.padStart(2, '0')}:${mi}`
  return { date, time, title: title.trim() }
}


// ---------- parse "/find Kadernictvi Praha - firmy co nemaji webovou stranku" ----------
function parseFind(text: string) {
  let m = text.replace(/^\/find\s*/i, '').trim()

  const bezWebu = /(bez\s+web\w*|nemaj\w*\s+web\w*|nemá\w*\s+web\w*)/i.test(m)

  m = m.replace(/[-–—]/g, ' ')
  m = m.replace(/\b(firmy|co|nemaj\w*|nemá\w*|webov\w*|str[aá]nk\w*|web\w*|bez)\b/gi, ' ')
  m = m.replace(/\s+/g, ' ').trim()

  const words = m.split(/\s+/).filter(Boolean)
  const mesto = words.length > 1 ? words[words.length - 1] : 'Praha'
  const obor = words.slice(0, -1).join(' ') || words[0] || 'autodilny'
  return { obor, mesto, bezWebu }
}

// ---------- spustí CLI (ruce) ----------
async function runCliFirmy(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const isWin = process.platform === 'win32'
  const cmd = isWin ? 'pnpm.cmd' : 'pnpm'
  const rawArgs = ['cli:firmy', 'search', ...args]

  const finalArgs = isWin
    ? rawArgs.map(a => (/\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    : rawArgs

  try {
    const { stdout, stderr } = await execFileAsync(cmd, finalArgs, {
      cwd: ROOT,
      timeout: 120000,
      env: { ...process.env },
      shell: isWin,
    })
    return { stdout, stderr }
  } catch (e: any) {
    return { stdout: e.stdout || '', stderr: e.stderr || String(e.message) }
  }
}

// ============================================================
// /find — Lubor: rychlý lead finder (CLI → finder.ts → JSON leadů)
// ============================================================
async function runFind(userMessage: string, runId: string, steps: string[]) {
  const { obor, mesto, bezWebu } = parseFind(userMessage.trim())
  const args = ['--obor', obor, '--mesto', mesto, '--limit', '20']
  if (bezWebu) args.push('--bez-webu')

  const filtryText = bezWebu ? 'bez webu' : 'bez filtru'
  const mjHandoff = `Lubore, proveď lead-find: ${obor} ve městě ${mesto}.\nPožadované filtry: ${filtryText}.\nSpusť CLI příkaz:\npnpm cli:firmy search ${args.join(' ')}\nVýstup bude uložen jako JSON do data/leads/.\nPo dokončení mi pošli cestu k souboru a počet nalezených záznamů.`

  steps.push(`Mary Jane → Lubor: ${mjHandoff.split('\n')[0]}`)
  await logActivity({ agent: 'Mary_Jane', type: 'routing', action: mjHandoff.split('\n')[0] })
  steps.push(`Lubor: pnpm cli:firmy search ${args.join(' ')}`)

  const { stdout: cliOut, stderr: cliErr } = await runCliFirmy(args)
  await logRun(runId, { userMessage, mode: 'find', obor, mesto, bezWebu, cliArgs: args, cliOut, cliErr })

  let leadsJson = '(žádná data)'
  const fileMatch = cliOut.match(/"file":\s*"([^"]+)"/)
  if (fileMatch) {
    leadsJson = await readFile(fileMatch[1], 'utf-8').catch(() => '(soubor nenalezen)')
  }
  steps.push('Lubor: data stažena, sestavuji report')

  const luborDocs = await loadAgentDocs('Lubor_Nehleda')
  const luborModel = await loadAgentModel('Lubor_Nehleda')
  const luborSystem = luborDocs || 'Jsi Lubor Nehleda, analytik v LOYO OS. Sestavuj report z reálných dat.'

  let luborReplyText: string
  try {
    const res = await chatWithTimeout({
      model: luborModel,
      messages: [
        { role: 'system', content: luborSystem },
        { role: 'user', content: `${mjHandoff}\n\nVýstup CLI:\n${cliOut}\n\nData leadů (JSON):\n${leadsJson.slice(0, 6000)}\n\nSestav report podle svého formátu (Klíčové nálezy → Detailní shrnutí → Zdroje). Pokud je 0 leadů bez webu, řekni to na rovinu a navrhni jiný obor nebo město.` },
      ],
      options: { temperature: 0.3, num_ctx: 2048 } // FIX 12GB,
    })
    luborReplyText = res.message.content
  } catch (e: any) {
    steps.push(`Lubor: chyba — ${e.message}`)
    await logActivity({ agent: 'Lubor_Nehleda', type: 'report', action: `chyba reportu: ${e.message}`, meta: { runId } })
    return {
      reply: `⚠️ Lubor nestihl sestavit report: ${e.message}\n\nData jsou ale uložená v: \`${fileMatch ? fileMatch[1] : 'neznámo'}\``,
      steps,
    }
  }

  let count: number | string = 'neznámo'
  try {
    const parsed = JSON.parse(leadsJson)
    count = Array.isArray(parsed) ? parsed.length : (parsed.results?.length ?? parsed.count ?? 'neznámo')
  } catch {
    count = 'neznámo'
  }
  const filePath = fileMatch ? fileMatch[1] : 'neznámo'
  const limitArg = args[args.indexOf('--limit') + 1] || '20'

  const reply = `Tome, máš to hotové. Lubor z ${limitArg} hledaných našel **${count}** firem${bezWebu ? ' bez webu' : ''} v oboru ${obor} (${mesto}). Soubor: \`${filePath}\``

  await logActivity({ agent: 'Lubor_Nehleda', type: 'report', action: `report: ${userMessage}`, meta: { runId } })
  await bumpAgentStats('lubor_nehleda')
  steps.push('Lubor: report hotov → Mary Jane → ty')
  await logRun(runId, { userMessage, mode: 'find', obor, mesto, bezWebu, cliArgs: args, cliOut, cliErr, filePath, count, luborModel, fullReport: luborReplyText, reply })
  return { reply, steps }
}

// ============================================================
// /research — Julia: hloubkový report na libovolné téma → .md soubor
// ============================================================
async function runResearch(userMessage: string, runId: string, steps: string[]) {
  const query = userMessage.replace(/^\/research\s*/i, '').trim()
  const juliaDocs = await loadAgentDocs('Julia_Nehledalova')
  const juliaModel = await loadAgentModel('Julia_Nehledalova')
  const juliaSystem = juliaDocs || 'Jsi Julia Nehledalová, deep research analytik v LOYO OS. Piš detailní, věcné reporty.'

  steps.push(`Julia: vyhledávám na webu "${query}"`)

  const searchResults = await webSearch(query, 8)
  steps.push(`Julia: nalezeno ${searchResults.length} zdrojů`)

  // Hloubkový research nestojí jen na anotacích — stáhne i obsah nejlepších stránek.
  const pages = await readSources(searchResults, 2)
  steps.push(`Julia: přečteno ${pages.length} celých stránek`)
  await logActivity({
    agent: 'Julia_Nehledalova',
    type: 'search',
    action: `deep research: "${query}" → ${searchResults.length} zdrojů, ${pages.length} stránek`,
    meta: { sources: searchResults.map((r: SearchResult) => r.url) },
  })

  const zdrojeBlock = searchResults.length
    ? searchResults
        .map((r: SearchResult, i: number) => `### Zdroj ${i + 1}: ${r.title}\nURL: ${r.url}\nAnotace: ${r.snippet}`)
        .join('\n\n')
    : '(vyhledávání nevrátilo žádné použitelné výsledky — zkus jiný, méně specifický dotaz)'

  const strankyBlock = pages.length
    ? pages
        .map((p: { title: string; url: string; text: string }, i: number) => `### Stažená stránka ${i + 1}: ${p.title}\nURL: ${p.url}\n${p.text}`)
        .join('\n\n')
    : '(celé stránky se nepodařilo stáhnout — pracuj jen s anotacemi výše)'

  steps.push('Julia: data stažena, sestavuji report')

  let reportText: string
  try {
    const res = await chatWithTimeout(
      {
        model: juliaModel,
        messages: [
          { role: 'system', content: juliaSystem },
          {
            role: 'user',
            content: `Zadání: ${query}\n\nŽIVÁ DATA Z WEBU — ANOTACE (použij jako přehled, cituj přesné URL):\n${zdrojeBlock.slice(0, 2500)}\n\nOBSAH STAŽENÝCH STRÁNEK (primární zdroj, ber konkrétní čísla a fakta odsud):\n${strankyBlock.slice(0, 6000)}\n\nSestav report podle svého protokolu (Klíčové nálezy → Detailní shrnutí → Zdroje/omezení). V sekci Zdroje vypiš URL, ze kterých jsi čerpala. Pokud data k tématu nestačí nebo chybí, řekni to na rovinu a doplň jen to, co je ověřitelné. Nikdy netvrď fakt, který není podložený zdrojem výše.`,
          },
        ],
        options: { temperature: 0.4, num_ctx: 4096, num_predict: 800 },
      },
      DEEP_TIMEOUT_MS,
    )
    reportText = res.message.content
  } catch (e: any) {
    steps.push(`Julia: chyba — ${e.message}`)
    await logActivity({ agent: 'Julia_Nehledalova', type: 'report', action: `chyba reportu: ${e.message}`, meta: { runId } })
    return { reply: `⚠️ Julia nestihla sestavit report: ${e.message}`, steps }
  }

  await mkdir(REPORTS_DIR, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const file = join(REPORTS_DIR, `${safeName(query) || 'research'}_${stamp}.md`)
  await writeFile(file, reportText, 'utf-8')

  steps.push(`Julia: report hotov → ${file}`)
  await logActivity({ agent: 'Julia_Nehledalova', type: 'report', action: `research: ${query} → ${file}`, meta: { runId, file, sourcesUsed: searchResults.length } })
  await bumpAgentStats('julia_nehledalova')
  await logRun(runId, { userMessage, mode: 'research', query, model: juliaModel, sources: searchResults, file, reply: reportText })

  const reply = `🔎 Research "${query}" je hotový (${reportText.length} znaků).\nUloženo: \`${file}\``
  return { reply, steps, julia: { file, query, chars: reportText.length } }
}

// ============================================================
// /note — přímý zápis poznámky přesně tak, jak byla napsaná (bez LLM)
// ============================================================
async function runNote(userMessage: string, runId: string, steps: string[]) {
  const text = userMessage.replace(/^\/note\s*/i, '').trim()
  if (!text) {
    return { reply: 'Napiš text poznámky za příkaz, např. `/note nakoupit kávu`.', steps }
  }
  const { title, body } = parseNoteInput(text)
  const content = `# ${title}\n\n${body}`

  await mkdir(POZNAMKY_DIR, { recursive: true })
  const n = await nextFileNumber(POZNAMKY_DIR)
  const file = join(POZNAMKY_DIR, `${n}poznamka_${slugify(title)}.md`)
  await writeFile(file, content, 'utf-8')

  steps.push(`Mary Jane: uložena poznámka → ${file}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `poznámka: "${title}" → ${file}`, meta: { runId, file } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'note', title, file })

  return { reply: `Zapsáno, Tome. Poznámka je uložená v \`${file}\``, steps }
}

// ============================================================
// /task — přímý zápis úkolu přesně tak, jak byl napsaný (bez LLM)
// ============================================================
async function runTask(userMessage: string, runId: string, steps: string[]) {
  const text = userMessage.replace(/^\/task\s*/i, '').trim()
  if (!text) {
    return { reply: 'Napiš úkol za příkaz, např. `/task zavolat účetní`.', steps }
  }
  const { title, items } = parseTaskInput(text)
  const checklist = items.length > 0 ? items.map(i => `- [ ] ${i}`).join('\n') : ''
  const content = `# ${title}\n\n**Hotovo:** false\n\n${checklist}`

  await mkdir(UKOLY_AKTIVNI_DIR, { recursive: true })
  const n = await nextFileNumber(UKOLY_AKTIVNI_DIR)
  const file = join(UKOLY_AKTIVNI_DIR, `${n}ukol_${slugify(title)}.md`)
  await writeFile(file, content, 'utf-8')

  steps.push(`Mary Jane: zapsán úkol → ${file}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `úkol: "${title}" → ${file}`, meta: { runId, file } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'task', title, file })

  return { reply: `Zapsáno, Tome. Úkol je uložený v \`${file}\``, steps }
}

// ============================================================
// /kalendar — přímý zápis události do kalendáře (bez LLM)
// ============================================================
async function runKalendar(userMessage: string, runId: string, steps: string[]) {
  const text = userMessage.replace(/^\/kalendar\s*/i, '').trim()
  const parsed = parseCalendarInput(text)
  if (!parsed) {
    return {
      reply: 'Formát je `/kalendar DD.MM.RRRR HH:MM popis`, např. `/kalendar 05.09.2026 14:30 Schůzka s klientem`.',
      steps,
    }
  }
  const { date, time, title } = parsed
  const content = `# ${title}\n\n**Datum:** ${date}\n**Čas:** ${time}\n\n${title}`

  await mkdir(KALENDAR_DIR, { recursive: true })
  const n = await nextFileNumber(KALENDAR_DIR)
  const file = join(KALENDAR_DIR, `${n}udalost_${slugify(title)}.md`)
  await writeFile(file, content, 'utf-8')

  steps.push(`Mary Jane: uložena událost → ${file}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `kalendář: "${title}" ${date} ${time} → ${file}`, meta: { runId, file } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'kalendar', title, date, time, file })

  return { reply: `✓ Uloženo do kalendáře: **${title}** — ${date} ${time}\n\`${file}\``, steps }
}

// ============================================================
// /status — rychlý read-only přehled otevřených úkolů, poznámek a událostí
// ============================================================
async function runStatus(userMessage: string, runId: string, steps: string[]) {
  const taskFilesAktivni = (await readDirSafe(UKOLY_AKTIVNI_DIR)).map(f => ({ dir: UKOLY_AKTIVNI_DIR, f })).filter(x => x.f.endsWith('.md'))
  const taskFilesHotove = (await readDirSafe(UKOLY_HOTOVE_DIR)).map(f => ({ dir: UKOLY_HOTOVE_DIR, f })).filter(x => x.f.endsWith('.md'))
  const taskFilesAll = [...taskFilesAktivni, ...taskFilesHotove]
  const noteFiles = (await readDirSafe(POZNAMKY_DIR)).filter(f => f.endsWith('.md'))
  const eventFiles = (await readDirSafe(KALENDAR_DIR)).filter(f => f.endsWith('.md'))

  const doneFlags = await Promise.all(
    taskFilesAll.map(async ({ dir, f }) => {
      try {
        const raw = await readFile(join(dir, f), 'utf-8')
        return /\*\*Hotovo:\*\*\s*false/i.test(raw)
      } catch {
        return false
      }
    }),
  )
  const openCount = doneFlags.filter(Boolean).length

  // počty capabilities + pozastavené
  const cnt: string[] = []
  for (const t of ['agents', 'teams', 'loops', 'workflows'] as CapabilityType[]) {
    const items = await loadManifestsIndex(t)
    const spec = PAUSE_STATES[t]
    const paused = spec? items.filter((e: any) => spec.is(e)).length : 0
    cnt.push(`${TYPE_WORD[t]} ${items.length}${paused? ` (pozastaveno ${paused})` : ''}`)
  }

  const picked = pickModel(userMessage, 'status')
  const reply = [
    `📋 **Status LoYo OS** [${picked.label} <1s]`,
    `• Otevřené úkoly: ${openCount} / ${taskFilesAll.length}`,
    `• Poznámky celkem: ${noteFiles.length}`,
    `• Kalendářní události: ${eventFiles.length}`,
    `• Systém: ${cnt.join(' • ')}`,
  ].join('\n')

  steps.push(`Mary Jane: sestaven status via ${picked.model} (${picked.label}) - fast path <1s`)
  await logRun(runId, { userMessage, mode: 'status', model: picked.model, openCount, totalTasks: taskFilesAll.length, noteCount: noteFiles.length, eventCount: eventFiles.length })

  return { reply, steps }
}

// ============================================================
// /daily-brief — ranní přehled (nově z commands.json)
// ============================================================
async function runDailyBrief(userMessage: string, runId: string, steps: string[]) {
  // stejná logika jako /status ale s routerem deep pro budoucí rozšíření
  const taskFilesAktivni = (await readDirSafe(UKOLY_AKTIVNI_DIR)).map(f => ({ dir: UKOLY_AKTIVNI_DIR, f })).filter(x => x.f.endsWith('.md'))
  const taskFilesHotove = (await readDirSafe(UKOLY_HOTOVE_DIR)).map(f => ({ dir: UKOLY_HOTOVE_DIR, f })).filter(x => x.f.endsWith('.md'))
  const noteFiles = (await readDirSafe(POZNAMKY_DIR)).filter(f => f.endsWith('.md'))
  const eventFiles = (await readDirSafe(KALENDAR_DIR)).filter(f => f.endsWith('.md'))
  // Luuu: souhrn pošty za posledních 24 h (když má přístup k mailu)
  const { luuuBriefSection } = await import('./luuu.js')
  const mail = await luuuBriefSection().catch(() => '')
  const reply = [`☀️ **Daily Brief**`, `• Aktivní úkoly: ${taskFilesAktivni.length}`, `• Hotové: ${taskFilesHotove.length}`, `• Poznámky: ${noteFiles.length}`, `• Kalendář dnes: ${eventFiles.length}`, ...(mail ? ['', mail] : []), ``, `Napiš /status pro detail.`].join('\n')
  steps.push('Mary Jane: daily-brief sestaven')
  await logRun(runId, { userMessage, mode: 'daily-brief' })
  return { reply, steps }
}

// ============================================================
// /commands — vypíše seznam všech dostupných příkazů
// ============================================================
async function runCommands(userMessage: string, runId: string, steps: string[])
{
  const commands = await loadCommands()
  const lines = commands.map(c =>
  {
    const status = c.enabled ? '✅' : '❌'
    const type = c.handler === 'custom' ? '(custom)' : '(built-in)'
    return `${status} \`${c.name}\` — ${c.description} ${type}`
  })

  const reply = `📋 **Dostupné příkazy (${commands.length}):**\n${lines.join('\n')}`
  steps.push('Mary Jane: vypsán seznam příkazů')
  await logRun(runId, { userMessage, mode: 'commands', count: commands.length })
  return { reply, steps }
}

// ============================================================
// /add — přidá nový custom příkaz do commands.json
// formát: /add /nazev - odpověď kterou Mary vrátí
// ============================================================
async function runAdd(userMessage: string, runId: string, steps: string[])
{
  const text = userMessage.replace(/^\/add\s*/i, '').trim()
  const match = text.match(/^(\/\S+)\s*[-–—]\s*(.+)$/s)

  if (!match)
  {
    return {
      reply: 'Formát: `/add /nazev - text odpovědi`\nPříklad: `/add /voda - NAPIJ SE VODY!!! blbečku :*`',
      steps,
    }
  }

  const cmdName = match[1].toLowerCase()
  const response = match[2].trim()

  // načti aktuální příkazy
  let allCommands: CommandDef[]
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data: CommandsFile = JSON.parse(raw)
    allCommands = data.commands
  }
  catch
  {
    allCommands = []
  }

  // kontrola duplicity
  const existing = allCommands.find(c => c.name.toLowerCase() === cmdName)
  if (existing)
  {
    return {
      reply: `Příkaz \`${cmdName}\` už existuje (${existing.description}). Smaž ho nejdřív, nebo zvol jiný název.`,
      steps,
    }
  }

  // ochrana built-in příkazů — nelze přepsat /note, /task atd. custom odpovědí
  const protectedHandlers = ['note', 'task', 'kalendar', 'status', 'find', 'research', 'commands', 'add']
  const nameWithoutSlash = cmdName.replace(/^\//, '')
  if (protectedHandlers.includes(nameWithoutSlash))
  {
    return {
      reply: `\`${cmdName}\` je systémový příkaz a nelze ho přepsat. Zvol jiný název.`,
      steps,
    }
  }

  const newCmd: CommandDef =
  {
    name: cmdName,
    handler: 'custom',
    description: response.slice(0, 80),
    enabled: true,
    response,
    addedBy: 'user',
    createdAt: new Date().toISOString().slice(0, 10),
  }

  allCommands.push(newCmd)
  await saveCommands(allCommands)

  steps.push(`Mary Jane: přidán custom příkaz ${cmdName}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `nový příkaz: ${cmdName}`, meta: { runId } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'add', cmdName, response })

  return {
    reply: `Hotovo, Tome. Příkaz \`${cmdName}\` je přidaný. Když napíšeš \`${cmdName}\`, odpovím: "${response}"`,
    steps,
  }
}

// ============================================================
// /remove — odstraní (deaktivuje) custom příkaz z commands.json
// formát: /remove /nazev
// ============================================================
async function runRemove(userMessage: string, runId: string, steps: string[])
{
  const cmdName = userMessage.replace(/^\/remove\s*/i, '').trim().toLowerCase()

  if (!cmdName || !cmdName.startsWith('/'))
  {
    return {
      reply: 'Formát: `/remove /nazev`\nPříklad: `/remove /voda`',
      steps,
    }
  }

  let allCommands: CommandDef[]
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data: CommandsFile = JSON.parse(raw)
    allCommands = data.commands
  }
  catch
  {
    return { reply: 'Nepodařilo se načíst commands.json.', steps }
  }

  const idx = allCommands.findIndex(c => c.name.toLowerCase() === cmdName)
  if (idx === -1)
  {
    return { reply: `Příkaz \`${cmdName}\` neexistuje.`, steps }
  }

  const cmd = allCommands[idx]

  // ochrana built-in příkazů
  const protectedHandlers = ['note', 'task', 'kalendar', 'status', 'find', 'research', 'commands', 'add', 'remove']
  if (protectedHandlers.includes(cmd.handler))
  {
    return { reply: `\`${cmdName}\` je systémový příkaz a nelze ho smazat.`, steps }
  }

  // smazat z pole
  allCommands.splice(idx, 1)
  await saveCommands(allCommands)

  steps.push(`Mary Jane: odstraněn příkaz ${cmdName}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `smazán příkaz: ${cmdName}`, meta: { runId } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'remove', cmdName })

  return {
    reply: `Hotovo, Tome. Příkaz \`${cmdName}\` je smazaný.`,
    steps,
  }
}

// ============================================================
// /pause — dočasně pozastaví příkaz (enabled: false)
// ============================================================
async function runPause(userMessage: string, runId: string, steps: string[])
{
  const cmdName = userMessage.replace(/^\/pause\s*/i, '').trim().toLowerCase()
  if (!cmdName || !cmdName.startsWith('/'))
  {
    return { reply: 'Formát: `/pause /nazev`\nPříklad: `/pause /voda`', steps }
  }

  let allCommands: CommandDef[]
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data: CommandsFile = JSON.parse(raw)
    allCommands = data.commands
  }
  catch
  {
    return { reply: 'Nepodařilo se načíst commands.json.', steps }
  }

  const cmd = allCommands.find(c => c.name.toLowerCase() === cmdName)
  if (!cmd)
  {
    return { reply: `Příkaz \`${cmdName}\` neexistuje.`, steps }
  }
  if (!cmd.enabled)
  {
    return { reply: `\`${cmdName}\` je už pozastavený.`, steps }
  }

  cmd.enabled = false
  await saveCommands(allCommands)

  steps.push(`Mary Jane: pozastaven příkaz ${cmdName}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `pause: ${cmdName}`, meta: { runId } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'pause', cmdName })

  return { reply: `Pozastaveno. \`${cmdName}\` nebude spouštěn, dokud nenapíšeš \`/resume ${cmdName}\`.`, steps }
}

// ============================================================
// /resume — obnoví pozastavený příkaz (enabled: true)
// ============================================================
async function runResume(userMessage: string, runId: string, steps: string[])
{
  const cmdName = userMessage.replace(/^\/resume\s*/i, '').trim().toLowerCase()
  if (!cmdName || !cmdName.startsWith('/'))
  {
    return { reply: 'Formát: `/resume /nazev`\nPříklad: `/resume /voda`', steps }
  }

  let allCommands: CommandDef[]
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data: CommandsFile = JSON.parse(raw)
    allCommands = data.commands
  }
  catch
  {
    return { reply: 'Nepodařilo se načíst commands.json.', steps }
  }

  const cmd = allCommands.find(c => c.name.toLowerCase() === cmdName)
  if (!cmd)
  {
    return { reply: `Příkaz \`${cmdName}\` neexistuje.`, steps }
  }
  if (cmd.enabled)
  {
    return { reply: `\`${cmdName}\` už běží.`, steps }
  }

  cmd.enabled = true
  await saveCommands(allCommands)

  steps.push(`Mary Jane: obnoven příkaz ${cmdName}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `resume: ${cmdName}`, meta: { runId } })
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'resume', cmdName })

  return { reply: `Obnoveno. \`${cmdName}\` je zase aktivní.`, steps }
}

// ============================================================
// ÚKOL 21-24 + NOVÉ ČÍSLOVÁNÍ 1_01, 2_01, 3_01...
// ============================================================

// ---------- BENDER - Blender specialist - FIXED 12GB + ukládání do kod/ ----------
async function runBender(userMessage: string, runId: string, steps: string[]) {
  // FIX: async + správná cesta + 3x md
  let bible = ''
  try {
    const biblePath = join(AGENTS_DIR, 'bender', 'knowledge.md')
    bible = await readFile(biblePath, 'utf-8')
  } catch {
    bible = 'Jsi Bender, Blender specialist. BLENDER_EEVEE, make_mat(), ico_sphere hlava, cylinder 8 ruce/nohy, bevel 0.03.'
  }

  const query = userMessage.replace(/^(bendere,|\/bender|\/blender)\s*/i, '').trim() || userMessage
  const benderDocs = await loadAgentDocs('bender')
  const benderModel = await loadAgentModel('bender')
  steps.push(`Bender: ${query.slice(0, 80)} [model=${benderModel} ctx=4096 + bible ${bible.length} chars]`)

  let ragContext = ''
  try { const hits = await ragSearch(query, 4); if (hits?.length) ragContext = hits.map((h:any) => h.text).join('\n').slice(0, 3000) } catch {}

  const history = await loadMemory('bender')
  const systemPrompt = `${benderDocs || 'Jsi Bender, Blender specialist v LOYO OS. Vše v metrech, Principled BSDF.'}

${bible}

${ragContext ? 'RAG:\n'+ragContext : ''}

MCP tools: get_blendfile_summary_path_info, get_objects_summary, get_object_detail_summary, execute_blender_code (vždy vrať result dict), render_thumbnail_to_path.

DŮLEŽITÉ: Po každé odpovědi ulož celý kód do D:/dev/loyo-os/data/reports/bender/kod/ jako .txt soubor.`

  const messages: ChatMsg[] = [{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: query }]

  let reply: string
  try {
    const res = await chatWithTimeout({
      model: benderModel,
      messages,
      options: { temperature: 0.2, num_ctx: 4096 }
    } as any, 180000)
    reply = res.message.content
  } catch (e:any) {
    reply = `⚠ Bender (${benderModel}) neodpověděl: ${e.message} - zkus 'ollama stop ${benderModel}' a znovu`
    return { reply, steps }
  }

  // Uložení do kod/ složky
  try {
    const kodDir = join(REPORTS_DIR, 'bender', 'kod')
    await mkdir(kodDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
    const safeQuery = slugify(query).slice(0, 40) || 'bender_task'
    const fileName = `${stamp}_${safeQuery}.txt`
    const filePath = join(kodDir, fileName)
    const content = `# Bender task: ${query}\n# Date: ${new Date().toISOString()}\n# Model: ${benderModel}\n\n${reply}\n`
    await writeFile(filePath, content, 'utf-8')
    steps.push(`Bender: uložen kod → ${filePath}`)
  } catch (e:any) {
    steps.push(`Bender: chyba ukládání do kod/ - ${e.message}`)
  }

  await saveMemory('bender', [...history, { role: 'user', content: query }, { role: 'assistant', content: reply }])
  await bumpAgentStats('bender').catch(()=>{})
  await logRun(runId, { userMessage, mode: 'bender', model: benderModel, reply })
  return { reply, steps }
}


type CapabilityType = 'agents' | 'mcp' | 'skills' | 'cli' | 'teams' | 'workflows' | 'loops' | 'api' | 'rag'

const TYPE_PREFIX: Record<CapabilityType, number> = {   // číslo typu: 1 agenti, 2 týmy, 3 skills, 4 MCP, 5 CLI, 6 loops, 7 workflows, 8 API
  agents: 1,
  teams: 2,
  skills: 3,
  mcp: 4,
  cli: 5,
  loops: 6,
  workflows: 7,
  api: 8,
  rag: 9,
}

function formatNumber(type: CapabilityType, seq: number): string {
  const prefix = TYPE_PREFIX[type]
  return `${prefix}_${String(seq).padStart(2,'0')}`
}
function extractSeq(num: any): number {
  if (num == null) return 0
  const s = String(num)
  if (s.includes('_')) return parseInt(s.split('_')[1], 10) || 0
  return parseInt(s, 10) || 0
}
async function getNextNumber(type: CapabilityType): Promise<number> {
  try {
    const items = await loadManifestsIndex(type)
    let max = 0
    for (const it of items) { const seq = extractSeq((it as any).number); if (seq > max) max = seq }
    const baseDir = join(DATA_DIR, 'capabilities', type)
    try { const dirs = await readdir(baseDir); for (const d of dirs){ try{ const mf = JSON.parse(await readFile(join(baseDir,d,'manifest.json'),'utf-8')); const seq=extractSeq(mf.number); if(seq>max) max=seq }catch{} } }catch{}
    return max + 1   // normální číslo 1, 2, 3 ... (ne 4_02)
  } catch { return 1 }
}

async function loadManifestsIndex(type: CapabilityType): Promise<any[]> {
  try {
    const indexPath = join(DATA_DIR, 'capabilities', type, 'index.json')
    const raw = await readFile(indexPath, 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data)? data : (data.items || data.capabilities || data.agents || data.tools || data.skills || data.loops || data.teams || data.workflows || [])
  } catch { return [] }
}

async function findByNumber(type: CapabilityType, input: number | string): Promise<{ entry: any; filePath: string } | null> {
  const rawInput = String(input).trim()
  const searchSeq = extractSeq(rawInput)
  try {
    const items = await loadManifestsIndex(type)
    let found = items.find((it: any) => String(it.number) === rawInput)
    if (found) return { entry: found, filePath: join(DATA_DIR, 'capabilities', type, 'index.json') }
    found = items.find((it: any) => extractSeq((it as any).number) === searchSeq)
    if (found) return { entry: found, filePath: join(DATA_DIR, 'capabilities', type, 'index.json') }
    const formatted = formatNumber(type, searchSeq)
    found = items.find((it: any) => String(it.number) === formatted)
    if (found) return { entry: found, filePath: join(DATA_DIR, 'capabilities', type, 'index.json') }
  } catch {}
  try {
    const baseDir = join(DATA_DIR, 'capabilities', type)
    const dirs = await readdir(baseDir)
    for (const d of dirs) {
      try {
        const mfPath = join(baseDir, d, 'manifest.json')
        const mf = JSON.parse(await readFile(mfPath, 'utf-8'))
        if (String(mf.number) === rawInput || extractSeq(mf.number) === searchSeq) return { entry: {...mf, folder: d }, filePath: mfPath }
      } catch {}
    }
  } catch {}
  return null
}

async function savePicker(runId: string, data: any){
  const p = join(DATA_DIR, 'tmp', `picker_${runId}.json`)
  await mkdir(join(DATA_DIR, 'tmp'), { recursive: true })
  await writeFile(p, JSON.stringify(data, null, 2), 'utf-8')
  return `tmp/picker_${runId}.json`   // cesta relativně k data/ (API /api/tmp bere jen takovou)
}
async function loadLatestPicker(prefix: string){
  try{
    const dir = join(DATA_DIR, 'tmp')
    const files = (await readdir(dir)).filter(f=>f.startsWith(prefix)).sort().reverse()
    if (!files[0]) return null
    const raw = await readFile(join(dir, files[0]), 'utf-8')
    return { file: join(dir, files[0]), data: JSON.parse(raw) }
  }catch{ return null }
}
function formatPickerText(items: any[]){
  return items.map((it:any)=> { const nm = it.displayName || it.name; return `${it.number} - ${it.id}${nm && nm !== it.id? ` — ${nm}`:''}` }).join('\n')
}
async function runPickerList(type: CapabilityType, runId: string, steps: string[]){
  const items = await loadManifestsIndex(type)
  if (!items.length) return { reply: `Žádné ${type} nemám. Zkus /new ${type.slice(0,-1)}`, steps }
  const tmpPath = await savePicker(runId, { mode: 'edit', type, items })
  steps.push(`Mary Jane: picker ${type} → ${items.length} položek`)
  return { reply: `PICKER:${type}:${tmpPath}\n${formatPickerText(items)}\n\nNapiš číslo (např. ${items[0].number} nebo ${extractSeq(items[0].number)}) nebo název, nebo vyber šipkama ↑↓ a Enter`, steps }
}

// ---------- typ-číslo: "4-1" = typ 4 (MCP), položka 1 ----------
const TYPE_BY_NUMBER: Record<number, CapabilityType> = Object.fromEntries(
  Object.entries(TYPE_PREFIX).map(([t, n]) => [n, t as CapabilityType])
) as Record<number, CapabilityType>
const TYPE_WORD: Record<CapabilityType, string> = {
  agents: 'agent', teams: 'team', skills: 'skill', mcp: 'mcp', cli: 'cli', loops: 'loop', workflows: 'workflow', api: 'api', rag: 'rag',
}
const typeListText = () => Object.entries(TYPE_PREFIX).map(([t, n]) => `${n}=${TYPE_WORD[t as CapabilityType]}`).join(', ')

// "4-1" | "4_01" | "04 - 1" | "4 1" -> { type: 'mcp', num: 1 }
function parseTypeRef(raw: string): { type: CapabilityType; num: number } | null {
  const m = raw.trim().match(/^(\d{1,2})(?:\s*[-_]\s*|\s+)(\d{1,3})$/)
  if (!m) return null
  const type = TYPE_BY_NUMBER[parseInt(m[1], 10)]
  return type ? { type, num: parseInt(m[2], 10) } : null
}

async function runEdit(userMessage: string, runId: string, steps: string[]) {
  const m = userMessage.trim().match(/^\/edit\s*(agent|mcp|skill|cli|team|workflow|loop|api|rag)?\s*([\d_]+|[a-z0-9-]+)?/i)
  if (!m) return { reply: 'Formát: `/edit <typ-číslo>` např. `/edit 4-1` (typ 4 = MCP, položka 1), nebo `/edit agent 2`, `/edit 4` = seznam typu.', steps }
  const rawType = m[1]
  const rawId = m[2]
  if (!rawType){
    const types = Object.keys(TYPE_PREFIX)
    const tmpPath = await savePicker(runId, { mode: 'edit-type', types })
    return { reply: `PICKER:type:${tmpPath}\n${types.join('\n')}\n\nCo chceš editovat? Napiš typ: agent, mcp, skill, cli, api, loop, team, workflow`, steps }
  }
  const typeMap: Record<string, CapabilityType> = { agent: 'agents', mcp: 'mcp', skill: 'skills', cli: 'cli', team: 'teams', workflow: 'workflows', loop: 'loops', api: 'api', rag: 'rag' }
  const type = typeMap[rawType.toLowerCase()] || (rawType.toLowerCase() as CapabilityType)
  if (!rawId){
    return runPickerList(type, runId, steps)
  }
  let found: any = await findByNumber(type, rawId)
  if (!found) {
    const all = await loadManifestsIndex(type)
    const f = all.find((a: any) => a.id === rawId || a.folder === rawId)
    if (f) found = { entry: f, filePath: join(DATA_DIR, 'capabilities', type, f.folder || f.id, 'manifest.json') }
  }
  if (!found) return { reply: `Nenalezen ${rawType} #${rawId}. Zkontroluj data/capabilities/${type}/index.json`, steps }
  steps.push(`Mary Jane: edit ${type} #${rawId} → ${found.entry.id || found.entry.folder}`)
  await logActivity({ agent: 'Mary_Jane', type: 'routing', action: `edit ${type} #${rawId}`, meta: { runId } })
  return { reply: `OPEN_BUILDER:${type}:${found.entry.number}:${found.entry.id || found.entry.folder}\nOtevírám Builder pro ${rawType} #${found.entry.number}`, steps }
}

async function runAddMcp(userMessage: string, runId: string, steps: string[]) {
  const m = userMessage.trim().match(/^\/add\s+mcp\s*([\d_]+)?/i)
  const rawNum = m?.[1]
  if (!rawNum){
    return runPickerList('mcp', runId, steps)
  }
  const found = await findByNumber('mcp', rawNum)
  if (!found) return { reply: `MCP #${rawNum} nenalezeno. Zkus /add mcp pro výběr.`, steps }
  const agents = await loadManifestsIndex('agents')
  const tmpPath = await savePicker(runId, { mode: 'add-mcp', mcpNum: found.entry.number, mcpId: found.entry.id || found.entry.folder, agents })
  steps.push(`Mary Jane: add mcp #${found.entry.number} found ${found.entry.id} → čekám na agenta`)
  return { reply: `PICKER:agents:${tmpPath}\nNašel jsem MCP #${found.entry.number} — ${found.entry.id}. K jakému agentovi?\n${formatPickerText(agents)}`, steps }
}

async function runAddMcpConfirm(userMessage: string, runId: string, steps: string[], pending: { mcpNum: string; mcpId: string }) {
  const input = userMessage.trim()
  const agentFound = await findByNumber('agents', input)
  if (!agentFound) return { reply: `Agent #${input} nenalezen.`, steps }
  try {
    const agentFolder = agentFound.entry.folder || agentFound.entry.id
    const manifestPath = join(DATA_DIR, 'capabilities', 'agents', agentFolder, 'manifest.json')
    let manifest: any
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) } catch { manifest = agentFound.entry }
    manifest.dependencies = manifest.dependencies || []
    const finalDep = `${pending.mcpId}:${pending.mcpNum}`
    if (!manifest.dependencies.includes(finalDep)) manifest.dependencies.push(finalDep)
    manifest.updatedAt = new Date().toISOString()
    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    try { await getCapabilities(true) } catch {}   // obnov cache
    steps.push(`Mary Jane: přidáno ${finalDep} do agenta #${agentFound.entry.number} → ${manifestPath}`)
    await logActivity({ agent: 'Mary_Jane', type: 'save', action: `add mcp ${finalDep} to agent #${agentFound.entry.number}`, meta: { runId } })
    return { reply: `Hotovo. MCP #${pending.mcpNum} (${pending.mcpId}) přiřazeno k agentovi #${agentFound.entry.number} (${agentFound.entry.id}). Dependencies: [${manifest.dependencies.join(', ')}]\nOPEN_BUILDER:agents:${agentFound.entry.number}:${agentFound.entry.id}`, steps }
  } catch (e: any) { return { reply: `Chyba: ${e.message}`, steps } }
}

// ---------- /add podle typ-číslo ----------
// /add 4-1 = MCP 1 → vyber agenta;  /add 1-2 = agent 2 → vyber tým;  /add 1 = seznam agentů → napiš číslo
async function runAddByRef(raw: string, runId: string, steps: string[]) {
  const ref = parseTypeRef(raw)
  if (ref) return runAddItem(ref.type, ref.num, runId, steps)
  const type = TYPE_BY_NUMBER[parseInt(raw, 10)]
  if (!type) return { reply: `Neznámé číslo typu ${raw}. Typy: ${typeListText()}`, steps }
  if (type !== 'mcp' && type !== 'agents' && !ADD_TARGETS[type]) return { reply: `Typ ${raw} (${TYPE_WORD[type]}) se nikam přidat nedá. Jde: skill, CLI, MCP → agent; loop → agent nebo tým; agent, workflow → tým.`, steps }
  const items = await loadManifestsIndex(type)
  if (!items.length) return { reply: `Žádné ${type} nemám.`, steps }
  const tmpPath = await savePicker(runId, { mode: 'add-item', type, items })
  steps.push(`Mary Jane: add ${type} → výběr položky`)
  return { reply: `PICKER:${type}:${tmpPath}\n${formatPickerText(items)}\n\nKterou položku přidat? Napiš číslo.`, steps }
}

async function runAddItem(type: CapabilityType, num: number | string, runId: string, steps: string[]) {
  if (type === 'mcp') return runAddMcp(`/add mcp ${num}`, runId, steps)
  if (type === 'agents') return runAddAgent(num, runId, steps)
  if (ADD_TARGETS[type]) return runAddGeneric(type, num, runId, steps)
  return { reply: `Typ ${type} se nikam přidat nedá. Jde: skill, CLI, MCP → agent; loop → agent nebo tým; agent, workflow → tým.`, steps }
}

async function runAddAgent(num: number | string, runId: string, steps: string[]) {
  const found = await findByNumber('agents', num)
  if (!found) return { reply: `Agent #${num} nenalezen.`, steps }
  const teams = await loadManifestsIndex('teams')
  if (!teams.length) return { reply: 'Žádný tým nemám. Nejdřív nějaký vytvoř.', steps }
  const agentId = found.entry.id || found.entry.folder
  const tmpPath = await savePicker(runId, { mode: 'add-agent-team', agentId, agentNum: found.entry.number, items: teams })
  steps.push(`Mary Jane: add agent #${found.entry.number} (${agentId}) → čekám na tým`)
  return { reply: `PICKER:teams:${tmpPath}\nNašel jsem agenta #${found.entry.number} — ${agentId}. Do jakého týmu?\n${formatPickerText(teams)}`, steps }
}

async function runAddAgentConfirm(userMessage: string, runId: string, steps: string[], pending: { agentId: string; agentNum: number | string }) {
  const input = userMessage.trim()
  let teamFound: any = await findByNumber('teams', input)
  if (!teamFound) {
    const all = await loadManifestsIndex('teams')
    const f = all.find((t: any) => t.id === input || t.folder === input)
    if (f) teamFound = { entry: f }
  }
  if (!teamFound) return { reply: `Tým #${input} nenalezen.`, steps }
  const teamId = teamFound.entry.id || teamFound.entry.folder
  let updated = false
  try {
    // 1) index.json týmů (stránka Team) – pole agents
    const indexPath = join(DATA_DIR, 'capabilities', 'teams', 'index.json')
    const idx = JSON.parse(await readFile(indexPath, 'utf-8'))
    const list: any[] = Array.isArray(idx)? idx : (idx.teams || idx.items || [])
    const t = list.find((x: any) => x.id === teamId)
    if (t) {
      t.agents = t.agents || []
      if (!t.agents.includes(pending.agentId)) t.agents.push(pending.agentId)
      await writeFile(indexPath, JSON.stringify(idx, null, 2), 'utf-8')
      updated = true
    }
  } catch {}
  try {
    // 2) manifest.json týmu (API loader) – pole members
    const mfPath = join(DATA_DIR, 'capabilities', 'teams', teamId, 'manifest.json')
    const mf = JSON.parse(await readFile(mfPath, 'utf-8'))
    mf.members = mf.members || []
    if (!mf.members.includes(pending.agentId)) mf.members.push(pending.agentId)
    mf.updatedAt = new Date().toISOString()
    await writeFile(mfPath, JSON.stringify(mf, null, 2), 'utf-8')
    updated = true
  } catch {}
  if (!updated) return { reply: `Tým ${teamId} jsem v datech nenašel, nic se nezapsalo.`, steps }
  try { await getCapabilities(true) } catch {}   // obnov cache
  steps.push(`Mary Jane: agent #${pending.agentNum} (${pending.agentId}) → tým #${teamFound.entry.number} (${teamId})`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `add agent ${pending.agentId} to team ${teamId}`, meta: { runId } })
  return { reply: `Hotovo. Agent #${pending.agentNum} (${pending.agentId}) je v týmu #${teamFound.entry.number} (${teamId}).`, steps }
}

// ---------- obecné /add: skill, CLI, loop, workflow ----------
// kam se co přidává: skill, CLI → agent; workflow → tým; loop → agent nebo tým
const ADD_TARGETS: Partial<Record<CapabilityType, CapabilityType[]>> = {
  skills: ['agents'], cli: ['agents'], workflows: ['teams'], loops: ['agents', 'teams'],
}

// přidá hodnotu do pole (bez duplicit)
const pushUnique = (obj: any, key: string, val: string) => {
  obj[key] = obj[key] || []
  if (!obj[key].includes(val)) obj[key].push(val)
}

// upraví záznam v data/capabilities/<typ>/index.json (tvar souboru se nemění)
async function patchIndexEntry(type: CapabilityType, id: string, fn: (entry: any) => void): Promise<boolean> {
  const p = join(DATA_DIR, 'capabilities', type, 'index.json')
  try {
    const idx = JSON.parse(await readFile(p, 'utf-8'))
    const key = ['items', 'agents', 'teams', 'tools', 'skills', 'loops', 'workflows'].find(k => Array.isArray(idx?.[k]))
    const list: any[] = Array.isArray(idx)? idx : (key? idx[key] : [])
    const entry = list.find((x: any) => x.id === id || x.folder === id)
    if (!entry) return false
    fn(entry)
    await writeFile(p, JSON.stringify(idx, null, 2), 'utf-8')
    return true
  } catch { return false }
}

// upraví data/capabilities/<typ>/<id>/manifest.json
async function patchManifest(type: CapabilityType, id: string, fn: (mf: any) => void): Promise<boolean> {
  const p = join(DATA_DIR, 'capabilities', type, id, 'manifest.json')
  try {
    const mf = JSON.parse(await readFile(p, 'utf-8'))
    fn(mf)
    mf.updatedAt = new Date().toISOString()
    await writeFile(p, JSON.stringify(mf, null, 2), 'utf-8')
    return true
  } catch { return false }
}

async function applyAdd(srcType: CapabilityType, srcId: string, tgtType: CapabilityType, tgtId: string): Promise<boolean> {
  let ok = false
  if (tgtType === 'agents') {
    if (srcType === 'loops') {
      // smyčka patří agentovi: pole agent v záznamu smyčky + loops v manifestu agenta (agent ví, které smyčky mu patří)
      ok = await patchIndexEntry('loops', srcId, e => { e.agent = tgtId })
      await patchManifest('agents', tgtId, mf => pushUnique(mf, 'loops', srcId))
    } else {
      const field = srcType === 'skills'? 'skills' : srcType === 'cli'? 'tools' : ''
      const value = srcType === 'cli'? `cli:${srcId}` : srcId
      if (field) {
        const a = await patchIndexEntry('agents', tgtId, e => pushUnique(e, field, value))
        const b = await patchManifest('agents', tgtId, mf => pushUnique(mf, field, value))
        ok = a || b
      }
    }
  } else if (tgtType === 'teams') {
    const field = srcType === 'loops'? 'loops' : srcType === 'workflows'? 'workflows' : ''
    if (field) {
      const a = await patchIndexEntry('teams', tgtId, e => pushUnique(e, field, srcId))
      const b = await patchManifest('teams', tgtId, mf => pushUnique(mf, field, srcId))
      ok = a || b
    }
  }
  if (ok) { try { await getCapabilities(true) } catch {} }   // obnov cache, ať se změna hned projeví
  return ok
}

async function runAddGeneric(type: CapabilityType, num: number | string, runId: string, steps: string[]) {
  const targets = ADD_TARGETS[type]
  if (!targets) return { reply: `Typ ${type} se nikam přidat nedá.`, steps }
  const found = await findByNumber(type, num)
  if (!found) return { reply: `${TYPE_WORD[type]} #${num} nenalezen.`, steps }
  const srcId = found.entry.id || found.entry.folder
  const multi = targets.length > 1
  const items: any[] = []
  for (const t of targets) {
    for (const it of await loadManifestsIndex(t)) {
      // u více cílů se píše typ-číslo (agent 1-2, tým 2-1), u jednoho jen číslo
      items.push({ number: multi? `${TYPE_PREFIX[t]}-${it.number}` : it.number, id: it.id || it.folder, displayName: it.displayName || it.name })
    }
  }
  if (!items.length) return { reply: `Nemám žádný cíl (${targets.map(t => TYPE_WORD[t]).join(', ')}).`, steps }
  const tmpPath = await savePicker(runId, { mode: 'add-generic', srcType: type, srcId, srcNum: found.entry.number, targets, items })
  steps.push(`Mary Jane: add ${type} #${found.entry.number} (${srcId}) → čekám na cíl`)
  const question = multi? 'Komu? Napiš typ-číslo (agent např. 1-2, tým 2-1).' : `Do ${TYPE_WORD[targets[0]] === 'team'? 'jakého týmu' : 'jakého agenta'}?`
  return { reply: `PICKER:${targets[0]}:${tmpPath}\nNašel jsem ${TYPE_WORD[type]} #${found.entry.number} — ${srcId}. ${question}\n${formatPickerText(items)}`, steps }
}

async function runAddGenericConfirm(userMessage: string, runId: string, steps: string[], pending: { srcType: CapabilityType; srcId: string; srcNum: number | string; targets: CapabilityType[] }) {
  const input = userMessage.trim()
  let tgtType: CapabilityType | undefined
  let tgtInput = input
  if (pending.targets.length === 1) tgtType = pending.targets[0]
  else {
    const ref = parseTypeRef(input)
    if (ref && pending.targets.includes(ref.type)) { tgtType = ref.type; tgtInput = String(ref.num) }
  }
  if (!tgtType) return { reply: `Napiš typ-číslo cíle, např. ${pending.targets.map(t => `${TYPE_PREFIX[t]}-1 (${TYPE_WORD[t]})`).join(' nebo ')}.`, steps }
  let tgt: any = await findByNumber(tgtType, tgtInput)
  if (!tgt) {
    const all = await loadManifestsIndex(tgtType)
    const f = all.find((x: any) => x.id === tgtInput || x.folder === tgtInput)
    if (f) tgt = { entry: f }
  }
  if (!tgt) return { reply: `${TYPE_WORD[tgtType]} #${tgtInput} nenalezen.`, steps }
  const tgtId = tgt.entry.id || tgt.entry.folder
  const ok = await applyAdd(pending.srcType, pending.srcId, tgtType, tgtId)
  if (!ok) return { reply: `Nepodařilo se zapsat ${pending.srcId} → ${tgtId} (nenalezeno v datech).`, steps }
  steps.push(`Mary Jane: ${pending.srcType} #${pending.srcNum} (${pending.srcId}) → ${tgtType} #${tgt.entry.number} (${tgtId})`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `add ${pending.srcType} ${pending.srcId} to ${tgtType} ${tgtId}`, meta: { runId } })
  return { reply: `Hotovo. ${TYPE_WORD[pending.srcType]} #${pending.srcNum} (${pending.srcId}) → ${TYPE_WORD[tgtType]} #${tgt.entry.number} (${tgtId}).`, steps }
}

// ---------- /remove podle typ-číslo (opak /add) ----------
// /remove 4-1 = MCP 1 → vyber agenta, ze kterého se odebere;  /remove 1 = seznam agentů, pak číslo
const REMOVE_TARGETS: Partial<Record<CapabilityType, CapabilityType[]>> = {
  ...ADD_TARGETS, mcp: ['agents'], agents: ['teams'],
}

async function readIndexEntry(type: CapabilityType, id: string): Promise<any | null> {
  const p = join(DATA_DIR, 'capabilities', type, 'index.json')
  try {
    const idx = JSON.parse(await readFile(p, 'utf-8'))
    const key = ['items', 'agents', 'teams', 'tools', 'skills', 'loops', 'workflows'].find(k => Array.isArray(idx?.[k]))
    const list: any[] = Array.isArray(idx)? idx : (key? idx[key] : [])
    return list.find((x: any) => x.id === id || x.folder === id) || null
  } catch { return null }
}

async function readManifestOf(type: CapabilityType, id: string): Promise<any | null> {
  try { return JSON.parse(await readFile(join(DATA_DIR, 'capabilities', type, id, 'manifest.json'), 'utf-8')) } catch { return null }
}

// odebere z pole hodnoty, které splňují podmínku
const dropValue = (obj: any, key: string, match: (v: string) => boolean) => {
  if (Array.isArray(obj[key])) obj[key] = obj[key].filter((v: string) => !match(v))
}

// kde je vazba uložena: pole v index.json (idx) a v manifestu (mf) + jak poznat hodnotu
type LinkLoc = { idx?: string; mf?: string; match: (v: string) => boolean }
function linkLoc(srcType: CapabilityType, srcId: string, tgtType: CapabilityType): LinkLoc | null {
  const eq = (v: string) => v === srcId
  if (tgtType === 'agents') {
    if (srcType === 'skills') return { idx: 'skills', mf: 'skills', match: eq }
    if (srcType === 'cli') return { idx: 'tools', mf: 'tools', match: v => v === `cli:${srcId}` }
    if (srcType === 'mcp') return { mf: 'dependencies', match: v => v === srcId || v.startsWith(`${srcId}:`) }
    if (srcType === 'loops') return { mf: 'loops', match: eq }
  }
  if (tgtType === 'teams') {
    if (srcType === 'agents') return { idx: 'agents', mf: 'members', match: eq }
    if (srcType === 'loops') return { idx: 'loops', mf: 'loops', match: eq }
    if (srcType === 'workflows') return { idx: 'workflows', mf: 'workflows', match: eq }
  }
  return null
}

async function isLinked(srcType: CapabilityType, srcId: string, tgtType: CapabilityType, tgtId: string): Promise<boolean> {
  if (srcType === 'loops' && tgtType === 'agents') {
    const loop = await readIndexEntry('loops', srcId)
    return !!loop && loop.agent === tgtId
  }
  const loc = linkLoc(srcType, srcId, tgtType)
  if (!loc) return false
  const has = (o: any, f?: string) => !!(o && f && Array.isArray(o[f]) && o[f].some(loc.match))
  return has(await readIndexEntry(tgtType, tgtId), loc.idx) || has(await readManifestOf(tgtType, tgtId), loc.mf)
}

async function applyRemove(srcType: CapabilityType, srcId: string, tgtType: CapabilityType, tgtId: string): Promise<boolean> {
  const loc = linkLoc(srcType, srcId, tgtType)
  if (!loc) return false
  let ok = false
  if (srcType === 'loops' && tgtType === 'agents') {
    ok = await patchIndexEntry('loops', srcId, e => { if (e.agent === tgtId) e.agent = '' })
  }
  if (loc.idx) { const a = await patchIndexEntry(tgtType, tgtId, e => dropValue(e, loc.idx as string, loc.match)); ok = ok || a }
  if (loc.mf) { const b = await patchManifest(tgtType, tgtId, mf => dropValue(mf, loc.mf as string, loc.match)); ok = ok || b }
  if (ok) { try { await getCapabilities(true) } catch {} }
  return ok
}

async function runRemoveByRef(raw: string, runId: string, steps: string[]) {
  const ref = parseTypeRef(raw)
  if (ref) return runRemoveGeneric(ref.type, ref.num, runId, steps)
  const type = TYPE_BY_NUMBER[parseInt(raw, 10)]
  if (!type) return { reply: `Neznámé číslo typu ${raw}. Typy: ${typeListText()}`, steps }
  if (!REMOVE_TARGETS[type]) return { reply: `Z typu ${raw} (${TYPE_WORD[type]}) se nic odebrat nedá.`, steps }
  const items = await loadManifestsIndex(type)
  if (!items.length) return { reply: `Žádné ${TYPE_WORD[type]} nemám.`, steps }
  const tmpPath = await savePicker(runId, { mode: 'remove-item', type, items })
  steps.push(`Mary Jane: remove ${type} → výběr položky`)
  return { reply: `PICKER:${type}:${tmpPath}\n${formatPickerText(items)}\n\nKterou položku odebrat? Napiš číslo.`, steps }
}

async function runRemoveGeneric(type: CapabilityType, num: number | string, runId: string, steps: string[]) {
  const targets = REMOVE_TARGETS[type]
  if (!targets) return { reply: `Z typu ${TYPE_WORD[type]} se nic odebrat nedá.`, steps }
  const found = await findByNumber(type, num)
  if (!found) return { reply: `${TYPE_WORD[type]} #${num} nenalezen.`, steps }
  const srcId = found.entry.id || found.entry.folder
  const multi = targets.length > 1
  const items: any[] = []
  for (const t of targets) {
    for (const it of await loadManifestsIndex(t)) {
      const tid = it.id || it.folder
      // nabízí se jen cíle, kde položka opravdu je
      if (await isLinked(type, srcId, t, tid)) items.push({ number: multi? `${TYPE_PREFIX[t]}-${it.number}` : it.number, id: tid, displayName: it.displayName || it.name })
    }
  }
  if (!items.length) return { reply: `${TYPE_WORD[type]} #${found.entry.number} (${srcId}) není nikde přiřazen.`, steps }
  const tmpPath = await savePicker(runId, { mode: 'remove-generic', srcType: type, srcId, srcNum: found.entry.number, targets, items })
  steps.push(`Mary Jane: remove ${type} #${found.entry.number} (${srcId}) → čekám na cíl`)
  const question = multi? 'Odkud? Napiš typ-číslo (agent např. 1-2, tým 2-1).' : 'Odkud ho odebrat? Napiš číslo.'
  return { reply: `PICKER:${targets[0]}:${tmpPath}\nNašel jsem ${TYPE_WORD[type]} #${found.entry.number} — ${srcId}. ${question}\n${formatPickerText(items)}`, steps }
}

async function runRemoveConfirm(userMessage: string, runId: string, steps: string[], pending: { srcType: CapabilityType; srcId: string; srcNum: number | string; targets: CapabilityType[] }) {
  const input = userMessage.trim()
  let tgtType: CapabilityType | undefined
  let tgtInput = input
  if (pending.targets.length === 1) tgtType = pending.targets[0]
  else {
    const ref = parseTypeRef(input)
    if (ref && pending.targets.includes(ref.type)) { tgtType = ref.type; tgtInput = String(ref.num) }
  }
  if (!tgtType) return { reply: `Napiš typ-číslo cíle, např. ${pending.targets.map(t => `${TYPE_PREFIX[t]}-1 (${TYPE_WORD[t]})`).join(' nebo ')}.`, steps }
  let tgt: any = await findByNumber(tgtType, tgtInput)
  if (!tgt) {
    const all = await loadManifestsIndex(tgtType)
    const f = all.find((x: any) => x.id === tgtInput || x.folder === tgtInput)
    if (f) tgt = { entry: f }
  }
  if (!tgt) return { reply: `${TYPE_WORD[tgtType]} #${tgtInput} nenalezen.`, steps }
  const tgtId = tgt.entry.id || tgt.entry.folder
  const ok = await applyRemove(pending.srcType, pending.srcId, tgtType, tgtId)
  if (!ok) return { reply: `Nepodařilo se odebrat ${pending.srcId} z ${tgtId}.`, steps }
  steps.push(`Mary Jane: ${pending.srcType} #${pending.srcNum} (${pending.srcId}) odebrán z ${tgtType} #${tgt.entry.number} (${tgtId})`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `remove ${pending.srcType} ${pending.srcId} from ${tgtType} ${tgtId}`, meta: { runId } })
  return { reply: `Hotovo. ${TYPE_WORD[pending.srcType]} #${pending.srcNum} (${pending.srcId}) odebrán z ${TYPE_WORD[tgtType]} #${tgt.entry.number} (${tgtId}).`, steps }
}

// ---------- ÚKOL 29: /pause /resume /run /status s číslem nebo jménem ----------
// /pause 6-5 | /pause loop 5 | /pause nazev-smycky;  /status 1-2 | /status agent 2 | /status mary-jane;  /run 7-12
const WORD_TO_TYPE: Record<string, CapabilityType> = Object.fromEntries(
  Object.entries(TYPE_WORD).map(([t, w]) => [w, t as CapabilityType])
) as Record<string, CapabilityType>

// co znamená "pozastaveno" u jednotlivých typů (pole v index.json a v manifestu)
const PAUSE_STATES: Partial<Record<CapabilityType, { is: (e: any) => boolean; pause: any; resume: any; mf?: { pause: any; resume: any } }>> = {
  loops:     { is: e => e.enabled === false, pause: { enabled: false, status: 'PAUSED' }, resume: { enabled: true, status: 'ACTIVE' } },
  workflows: { is: e => e.status === 'draft', pause: { status: 'draft' }, resume: { status: 'live' } },
  agents:    { is: e => e.status === 'offline', pause: { status: 'offline' }, resume: { status: 'online' }, mf: { pause: { status: 'paused' }, resume: { status: 'active' } } },
  teams:     { is: e => e.status === 'IDLE', pause: { status: 'IDLE' }, resume: { status: 'ACTIVE' }, mf: { pause: { status: 'paused' }, resume: { status: 'active' } } },
}

type Found = { type: CapabilityType; id: string; number: any; entry: any }

// najde všechny položky se jménem (id nebo název) napříč typy
async function findAllByName(name: string): Promise<Found[]> {
  const n = name.toLowerCase()
  const out: Found[] = []
  const types: CapabilityType[] = ['agents', 'teams', 'loops', 'workflows', 'skills', 'mcp', 'cli']
  for (const t of types) {
    const seen = new Set<string>()
    for (const it of await loadManifestsIndex(t)) {
      const id = String(it.id || it.folder || '')
      const nm = String(it.displayName || it.name || '').toLowerCase()
      if (id.toLowerCase() === n || nm === n) { out.push({ type: t, id, number: it.number, entry: it }); seen.add(id) }
    }
    // agenti a další, kteří nejsou v index.json, ale mají složku s manifestem
    try {
      const dirs = await readdir(join(DATA_DIR, 'capabilities', t))
      if (dirs.includes(name) && !seen.has(name)) {
        const mf = await readManifestOf(t, name)
        if (mf) out.push({ type: t, id: name, number: mf.number, entry: mf })
      }
    } catch {}
  }
  return out
}

async function describeItem(f: Found): Promise<string> {
  const mf = await readManifestOf(f.type, f.id)
  const e = (await readIndexEntry(f.type, f.id)) || f.entry || mf || {}
  const num = e.number ?? mf?.number ?? f.number
  const lines = [`${TYPE_PREFIX[f.type]}-${String(num ?? '?').padStart(2, '0')} — ${e.displayName || e.name || mf?.displayName || f.id} (${TYPE_WORD[f.type]}, ${f.id})`]
  const st = e.status ?? mf?.status
  if (st) lines.push(`• stav: ${st}`)
  const uniq = (...arrs: any[]) => [...new Set(arrs.flatMap(a => (Array.isArray(a)? a : [])))]
  if (f.type === 'agents') {
    if (e.role || mf?.description) lines.push(`• role: ${e.role || mf.description}`)
    const teams = (await loadManifestsIndex('teams')).filter((t: any) => (t.agents || []).includes(f.id)).map((t: any) => `${TYPE_PREFIX.teams}-${t.number} ${t.id}`)
    lines.push(`• týmy: ${teams.join(', ') || '—'}`)
    lines.push(`• skills: ${uniq(e.skills, mf?.skills).join(', ') || '—'}`)
    lines.push(`• tools: ${uniq(e.tools, mf?.tools).join(', ') || '—'}`)
    if (mf?.dependencies?.length) lines.push(`• MCP: ${mf.dependencies.join(', ')}`)
    const loops = (await loadManifestsIndex('loops')).filter((l: any) => l.agent === f.id).map((l: any) => `${TYPE_PREFIX.loops}-${l.number} ${l.id}`)
    lines.push(`• loops: ${loops.join(', ') || '—'}`)
    if (e.lastRun) lines.push(`• poslední běh: ${e.lastRun}`)
  } else if (f.type === 'teams') {
    lines.push(`• agenti: ${uniq(e.agents, mf?.members).join(', ') || '—'}`)
    lines.push(`• workflows: ${uniq(e.workflows, mf?.workflows).join(', ') || '—'}`)
    lines.push(`• loops: ${uniq(e.loops, mf?.loops).join(', ') || '—'}`)
  } else if (f.type === 'loops') {
    lines.push(`• plán: ${e.schedule || '—'}  • agent: ${e.agent || '—'}  • zapnuto: ${e.enabled === false? 'ne' : 'ano'}`)
  } else if (f.type === 'workflows') {
    lines.push(`• kroků: ${Array.isArray(e.steps)? e.steps.length : 0}  • poslední běh: ${e.lastRun || '—'}`)
  } else {
    const d = e.description || e.desc || mf?.description
    if (d) lines.push(`• ${String(d).slice(0, 120)}`)
    if (e.version || mf?.version) lines.push(`• verze: ${e.version || mf.version}`)
  }
  return lines.join('\n')
}

async function runControl(cmd: 'pause' | 'resume' | 'run' | 'status', arg: string, runId: string, steps: string[]) {
  const a = arg.trim()
  let found: Found | null = null
  const ref = parseTypeRef(a)
  const word = a.match(/^(agent|team|skill|mcp|cli|loop|workflow|api|rag)\s+(\d{1,3})$/i)
  if (ref || word) {
    const type = ref? ref.type : WORD_TO_TYPE[word![1].toLowerCase()]
    const num = ref? ref.num : parseInt(word![2], 10)
    const f = await findByNumber(type, num)
    if (!f) return { reply: `${TYPE_WORD[type]} #${num} nenalezen.`, steps }
    found = { type, id: f.entry.id || f.entry.folder, number: f.entry.number, entry: f.entry }
  } else if (/^\d{1,2}(?:\s*[-_]\s*|\s+)\d{1,3}$/.test(a)) {
    return { reply: `Neznámé číslo typu ${a.split(/[-_\s]+/)[0]}. Typy: ${typeListText()}`, steps }
  } else if (/^\d{1,2}$/.test(a)) {
    // jen číslo typu → seznam položek
    const type = TYPE_BY_NUMBER[parseInt(a, 10)]
    if (!type) return { reply: `Neznámé číslo typu ${a}. Typy: ${typeListText()}`, steps }
    const items = await loadManifestsIndex(type)
    if (!items.length) return { reply: `Žádné ${TYPE_WORD[type]} nemám.`, steps }
    return { reply: `${TYPE_WORD[type]} (typ ${TYPE_PREFIX[type]}): ${items.map((it: any) => `${TYPE_PREFIX[type]}-${it.number} ${it.id}`).join(', ')}\nNapiš /${cmd} ${TYPE_PREFIX[type]}-<číslo>`, steps }
  } else if (/^[a-z0-9][a-z0-9-]*$/i.test(a)) {
    const matches = await findAllByName(a)
    if (matches.length === 0) return cmd === 'status'? null : { reply: `Nenašel jsem "${a}". Zkus typ-číslo, např. 6-5.`, steps }
    if (matches.length > 1) return { reply: `"${a}" je víc věcí: ${matches.map(m => `${TYPE_PREFIX[m.type]}-${m.number} (${TYPE_WORD[m.type]})`).join(', ')} – napiš typ-číslo.`, steps }
    found = matches[0]
  } else return null
  if (!found) return null

  if (cmd === 'status') {
    steps.push(`Mary Jane: status ${found.type} ${found.id}`)
    return { reply: await describeItem(found), steps }
  }

  if (cmd === 'run') {
    if (found.type !== 'workflows') return { reply: `/run umí zatím jen workflow (typ 7), např. /run 7-1.`, steps }
    const wf = (await readIndexEntry('workflows', found.id)) || found.entry
    const list: any[] = Array.isArray(wf?.steps)? wf.steps : []
    await patchIndexEntry('workflows', found.id, e => { e.lastRun = new Date().toISOString() })
    await logActivity({ agent: 'Mary_Jane', type: 'routing', action: `run workflow ${found.id}`, meta: { runId } })
    await logRun(runId, { userMessage: `/run ${arg}`, mode: 'run', workflow: found.id })
    steps.push(`Mary Jane: run workflow ${found.id} (${list.length} kroků)`)
    const plan = list.map((s: any, i: number) => `${i + 1}. ${s.type}: ${s.name || s.id}`).join('\n') || '(žádné kroky)'
    return { reply: `Workflow ${TYPE_PREFIX.workflows}-${String(found.number ?? '?').padStart(2, '0')} — ${found.id}: běh zaznamenán (poslední běh se uložil).\nKroky:\n${plan}\n⚠ Spouštěč kroků zatím neexistuje, nic se nespustilo.`, steps }
  }

  // pause / resume
  const spec = PAUSE_STATES[found.type]
  if (!spec) return { reply: `Typ ${TYPE_WORD[found.type]} se nepozastavuje. Umí: agent, tým, loop, workflow.`, steps }
  const entry = await readIndexEntry(found.type, found.id)
  const mf = await readManifestOf(found.type, found.id)
  const paused = entry? spec.is(entry) : mf?.status === 'paused'
  if (cmd === 'pause' && paused) return { reply: `${TYPE_WORD[found.type]} ${found.id} je už pozastavený.`, steps }
  if (cmd === 'resume' && !paused) return { reply: `${TYPE_WORD[found.type]} ${found.id} už běží.`, steps }
  const idxOk = await patchIndexEntry(found.type, found.id, e => { Object.assign(e, cmd === 'pause'? spec.pause : spec.resume) })
  const mfOk = spec.mf? await patchManifest(found.type, found.id, m => { Object.assign(m, cmd === 'pause'? spec.mf!.pause : spec.mf!.resume) }) : false
  if (!idxOk && !mfOk) return { reply: `Nepodařilo se zapsat změnu pro ${found.id}.`, steps }
  try { await getCapabilities(true) } catch {}
  steps.push(`Mary Jane: ${cmd} ${found.type} ${found.id}`)
  await logActivity({ agent: 'Mary_Jane', type: 'save', action: `${cmd}: ${found.type} ${found.id}`, meta: { runId } })
  await logRun(runId, { userMessage: `/${cmd} ${arg}`, mode: cmd, type: found.type, id: found.id })
  return { reply: cmd === 'pause'? `Pozastaveno: ${TYPE_WORD[found.type]} ${found.id}. Obnovíš to přes /resume ${TYPE_PREFIX[found.type]}-${found.number}.` : `Obnoveno: ${TYPE_WORD[found.type]} ${found.id}.`, steps }
}

// ---------- /list a /help ----------
async function runList(raw: string | undefined, steps: string[]) {
  if (!raw) return { reply: `Typy: ${typeListText()}\nSeznam typu: /list <číslo typu>, např. /list 4`, steps }
  const type = TYPE_BY_NUMBER[parseInt(raw, 10)]
  if (!type) return { reply: `Neznámé číslo typu ${raw}. Typy: ${typeListText()}`, steps }
  const items = await loadManifestsIndex(type)
  if (!items.length) return { reply: `Žádné ${TYPE_WORD[type]} nemám.`, steps }
  const lines = items.map((it: any) => { const nm = it.displayName || it.name; return `${TYPE_PREFIX[type]}-${it.number} — ${it.id}${nm && nm !== it.id? ` (${nm})` : ''}` })
  return { reply: `${TYPE_WORD[type]} (typ ${TYPE_PREFIX[type]}):\n${lines.join('\n')}`, steps }
}

function runHelp(steps: string[]) {
  return { reply: [
    `Typy: ${typeListText()}`,
    'Zápis: typ-číslo, např. 4-1 = MCP číslo 1',
    '/list – typy;  /list 4 – seznam MCP',
    '/edit 4-1 – otevře Builder;  /edit 4 – seznam typu',
    '/add 4-1 – MCP → agent;  /add 3-1 – skill → agent;  /add 5-1 – CLI → agent',
    '/add 1-2 – agent → tým;  /add 7-1 – workflow → tým;  /add 6-1 – loop → agent (1-2) nebo tým (2-1)',
    '/add 1 – seznam agentů, pak číslo',
    '/remove – stejná čísla jako /add (opak): /remove 1-2 – agent 2 pryč z týmu, /remove 4-1 – MCP 1 pryč z agenta',
    '/new 4 <téma> – nový MCP s research;  /new 3 <téma> – nový skill',
    '/status 1-2 – stav agenta 2 (nebo /status mary-jane);  /pause 6-5, /resume 6-5 – smyčka 5 (jde i agent, tým, workflow)',
    '/run 7-12 – zaznamená běh workflow 12 (kroky se zatím nespouští)',
  ].join('\n'), steps }
}

// nejnovější report podle času změny (ne podle názvu souboru)
async function readLatestReport(): Promise<string> {
  try {
    const files = (await readdir(REPORTS_DIR)).filter(f => f.endsWith('.md'))
    let best = ''
    let bestTime = 0
    for (const f of files) {
      const t = (await stat(join(REPORTS_DIR, f))).mtimeMs
      if (t > bestTime) { bestTime = t; best = f }
    }
    return best? await readFile(join(REPORTS_DIR, best), 'utf-8') : ''
  } catch { return '' }
}

// z textu udělá kebab-case id (bez diakritiky)
const toKebabId = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'novy'

// id, které ještě neexistuje v data/capabilities/<typ>
async function uniqueCapId(type: CapabilityType, base: string): Promise<string> {
  let existing: string[] = []
  try { existing = await readdir(join(DATA_DIR, 'capabilities', type)) } catch {}
  let id = base
  let i = 2
  while (existing.includes(id)) id = `${base}-${i++}`
  return id
}

// odstraní ```json ohrady, které občas přidá generátor
const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

async function runNewMcp(userMessage: string, runId: string, steps: string[]) {
  const query = userMessage.replace(/^\/new\s+mcp\s*/i, '').trim() || 'best MCP filesystem tools 2026'
  steps.push(`Mary Jane: /new mcp → research "${query}"`)
  const researchResult = await runResearch(`/research ${query}`, runId, steps)
  const lastReport = await readLatestReport()
  let manifestObj: any = null
  try {
    const mod = await import('./kosterad.js')
    if (mod?.generateMcpManifest) manifestObj = JSON.parse(stripFences(await mod.generateMcpManifest(lastReport || query)))
  } catch {}
  if (!manifestObj) {
    manifestObj = {
      type: 'mcp', version: '0.1.0', status: 'draft',
      description: `Z research Julia: ${query.slice(0,200)}`,
      runtime: 'node', entrypoint: './src/server.ts', transport: 'stdio',
      tools: ['fs_read','fs_write','fs_list'], tags: ['mcp'],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
  }
  // id a název podle zadání (generátor dává pořád "filesystem" a přepsal by existující MCP)
  manifestObj.id = await uniqueCapId('mcp', `mcp-${toKebabId(query)}`)
  manifestObj.displayName = query.replace(/\s+/g, ' ').slice(0, 60)
  manifestObj.number = await getNextNumber('mcp')
  const tmpName = `new_mcp_${runId}.json`
  await mkdir(join(DATA_DIR, 'tmp'), { recursive: true })
  await writeFile(join(DATA_DIR, 'tmp', tmpName), JSON.stringify(manifestObj, null, 2), 'utf-8')
  return { reply: `OPEN_BUILDER:mcp:new:tmp/${tmpName}\nResearch hotovo → ${researchResult.reply}\nKoštěrad předvyplnil manifest z research.`, steps }
}

async function runNewSkill(userMessage: string, runId: string, steps: string[]) {
  const query = userMessage.replace(/^\/new\s+skill\s*/i, '').trim() || 'best skill pattern 2026'
  steps.push(`Mary Jane: /new skill → research "${query}"`)
  const researchResult = await runResearch(`/research ${query}`, runId, steps)
  const lastReport = await readLatestReport()
  let manifestObj: any
  try {
    const mod = await import('./kosterad.js')
    if ((mod as any)?.generateSkillManifest) manifestObj = await (mod as any).generateSkillManifest(lastReport || query)
    else throw new Error('no generator')
  } catch {
    manifestObj = {
      id: `skill-${Date.now()}`, type: 'skill', displayName: 'New Skill',
      number: await getNextNumber('skills'), version: '0.1.0', status: 'draft',
      description: `Z research: ${query.slice(0,200)}`,
      runtime: 'node', entrypoint: './src/index.ts', pure: false,
      tools: ['custom_tool'], tags: ['skill'],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
  }
  if (typeof manifestObj!== 'string') manifestObj.number = await getNextNumber('skills')
  else { try{ const tmp=JSON.parse(manifestObj); tmp.number=await getNextNumber('skills'); manifestObj=JSON.stringify(tmp,null,2) }catch{} }
  const prefilled = typeof manifestObj === 'string'? manifestObj : JSON.stringify(manifestObj, null, 2)
  const tmpPath = join(DATA_DIR, 'tmp', `new_skill_${runId}.json`)
  await mkdir(join(DATA_DIR, 'tmp'), { recursive: true })
  await writeFile(tmpPath, prefilled, 'utf-8')
  return { reply: `OPEN_BUILDER:skills:new:tmp/new_skill_${runId}.json\nResearch hotovo → ${researchResult.reply}\nKoštěrad předvyplnil skill manifest.`, steps }
}

// ============================================================
// CORE LOGIKA - bez fronty, voláno z fronty i přímo
// ============================================================
async function runOrchestratorCore(userMessage: string, runId: string, steps: string[]): Promise<RunResult>
{
  const trimmed = userMessage.trim()

  // ---------- Mary Jane velí všem agentům (UI chat i Telegram) ----------
  const agentCommand = await tryAgentCommand(trimmed).catch(() => null)
  if (agentCommand) return agentCommand

  // /julia <téma> = zkratka na hloubkový research
  const juliaAlias = trimmed.match(/^\/julia\s+([\s\S]+)$/i)
  if (juliaAlias) return runResearch(`/research ${juliaAlias[1]}`, runId, steps)

  // ---------- ÚKOL 22-24: explicitní příkazy ----------
  // typ-číslo: /edit 4-1 (typ 4 = MCP, položka 1), /edit 4 = seznam typu, /add 1-2, /add 1
  const editRef = trimmed.match(/^\/edit\s+(\d{1,2}(?:(?:\s*[-_]\s*|\s+)\d{1,3})?)\s*$/i)
  if (editRef) {
    const ref = parseTypeRef(editRef[1])
    if (ref) return runEdit(`/edit ${TYPE_WORD[ref.type]} ${ref.num}`, runId, steps)
    const typeOnly = TYPE_BY_NUMBER[parseInt(editRef[1], 10)]
    if (typeOnly) return runPickerList(typeOnly, runId, steps)
    return { reply: `Neznámé číslo typu ${editRef[1]}. Typy: ${typeListText()}`, steps }
  }
  const addRef = trimmed.match(/^\/add\s+(\d{1,2}(?:(?:\s*[-_]\s*|\s+)\d{1,3})?)\s*$/i)
  if (addRef) return runAddByRef(addRef[1], runId, steps)
  const listRef = trimmed.match(/^\/list(?:\s+(\d{1,2}))?\s*$/i)
  if (listRef) return runList(listRef[1], steps)
  if (/^\/help\s*$/i.test(trimmed)) return runHelp(steps)
  // ÚKOL 34.1: ruční spuštění noční sumarizace paměti
  // ÚKOL 33: /rag <dotaz> – rychlé vyhledání v RAG (Qdrant)
  const ragCmd = trimmed.match(/^\/rag\s+(.+)$/i)
  if (ragCmd) {
    try {
      const hits = await ragSearch(ragCmd[1], 4)
      if (!hits.length) return { reply: 'RAG: nic jsem nenašel (zkus pnpm rag:index).', steps }
      return { reply: `🔎 RAG (${hits.length}):\n` + hits.map(h => `• [${h.score.toFixed(2)}] ${h.path}${h.title? ` — ${h.title}` : ''}\n${h.text.slice(0, 220).replace(/\n/g, ' ')}…`).join('\n\n'), steps }
    } catch (e: any) { return { reply: `RAG nedostupný: ${e.message}`, steps } }
  }
  if (/^\/memory-backfill\s*$/i.test(trimmed)) return { reply: `🗂 Zpětné shrnutí posledních 14 dní:\n${await backfillChatMemory()}`, steps }
  const memCmd = trimmed.match(/^\/memory-nightly(?:\s+(\d{4}-\d{2}-\d{2}))?\s*$/i)
  if (memCmd) {
    const day = memCmd[1] || new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    return { reply: `🧠 ${await summarizeAgentMemory('Mary_Jane')}\n🗂 ${await summarizeChatDay(day)}`, steps }
  }
  // ÚKOL 29: /pause /resume /run /status s číslem nebo jménem (vlastní příkazy typu /pause /voda zůstávají)§
  const ctl = trimmed.match(/^\/(pause|resume|run|status)\s+(.+?)\s*$/i)
  if (ctl && !ctl[2].startsWith('/')) {
    const r = await runControl(ctl[1].toLowerCase() as 'pause' | 'resume' | 'run' | 'status', ctl[2], runId, steps)
    if (r) return r
  }
  const removeRef = trimmed.match(/^\/remove\s+(\d{1,2}(?:(?:\s*[-_]\s*|\s+)\d{1,3})?)\s*$/i)
  if (removeRef) return runRemoveByRef(removeRef[1], runId, steps)
  const newRef = trimmed.match(/^\/new\s+(\d{1,2})(?:\s+(.*))?$/i)
  if (newRef) {
    const type = TYPE_BY_NUMBER[parseInt(newRef[1], 10)]
    const rest = (newRef[2] || '').trim()
    if (type === 'mcp') return runNewMcp(`/new mcp ${rest}`, runId, steps)
    if (type === 'skills') return runNewSkill(`/new skill ${rest}`, runId, steps)
    return { reply: type? `Nový ${TYPE_WORD[type]} přes /new zatím neumím. Umím: /new 4 (MCP), /new 3 (skill).` : `Neznámé číslo typu ${newRef[1]}. Typy: ${typeListText()}`, steps }
  }
  if (/^\/edit\s+(agent|mcp|skill|cli|team|workflow|loop|api|rag)\s+[\d_]+/i.test(trimmed)) {
    return runEdit(trimmed, runId, steps)
  }
  if (/^\/add\s+mcp\s+[\d_]+/i.test(trimmed)) {
    return runAddMcp(trimmed, runId, steps)
  }
  if (/^\/new\s+mcp\b/i.test(trimmed)) {
    return runNewMcp(trimmed, runId, steps)
  }
  if (/^\/new\s+skill\b/i.test(trimmed)) {
    return runNewSkill(trimmed, runId, steps)
  }
  // PICKER SELECTION — když uživatel vybere z nabídky
  if (/^[\d_]+$/.test(trimmed) || /^[a-z0-9-]+$/i.test(trimmed)) {
    try {
      const tmpDir = join(DATA_DIR, 'tmp')
      const files = await readdir(tmpDir)
      // nejnovější picker
      const pickerFile = files.filter(f => f.startsWith('picker_')).sort().reverse()[0]
      if (pickerFile){
        const { data } = (await loadLatestPicker('picker_')) || {}
        if (data){
          if (data.mode === 'add-mcp'){
            const confirm = await runAddMcpConfirm(trimmed, runId, steps, { mcpNum: data.mcpNum, mcpId: data.mcpId })
            if (confirm){ try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}; return confirm }
          }
          if (data.mode === 'remove-generic'){
            const confirm = await runRemoveConfirm(trimmed, runId, steps, { srcType: data.srcType, srcId: data.srcId, srcNum: data.srcNum, targets: data.targets })
            if (confirm){ try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}; return confirm }
          }
          if (data.mode === 'remove-item'){
            const found = await findByNumber(data.type, trimmed)
            if (found){
              try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}
              return runRemoveGeneric(data.type, found.entry.number, runId, steps)
            }
          }
          if (data.mode === 'add-generic'){
            const confirm = await runAddGenericConfirm(trimmed, runId, steps, { srcType: data.srcType, srcId: data.srcId, srcNum: data.srcNum, targets: data.targets })
            if (confirm){ try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}; return confirm }
          }
          if (data.mode === 'add-agent-team'){
            const confirm = await runAddAgentConfirm(trimmed, runId, steps, { agentId: data.agentId, agentNum: data.agentNum })
            if (confirm){ try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}; return confirm }
          }
          if (data.mode === 'add-item'){
            const found = await findByNumber(data.type, trimmed)
            if (found){
              try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}
              return runAddItem(data.type, found.entry.number, runId, steps)
            }
          }
          if (data.mode === 'edit'){
            const found = await findByNumber(data.type, trimmed)
            if (found){
              try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}
              return { reply: `OPEN_BUILDER:${data.type}:${found.entry.number}:${found.entry.id || found.entry.folder}\nOtevírám Builder pro ${data.type} #${found.entry.number}`, steps }
            }
          }
          if (data.mode === 'edit-type'){
            const typeMap: any = { agent: 'agents', mcp: 'mcp', skill: 'skills', cli: 'cli', team: 'teams', workflow: 'workflows', loop: 'loops', api: 'api', rag: 'rag' }
            const t = typeMap[trimmed.toLowerCase()] || trimmed.toLowerCase()
            if (TYPE_PREFIX[t as CapabilityType]){
              try{ const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pickerFile)) }catch{}
              return runPickerList(t as CapabilityType, runId, steps)
            }
          }
        }
      }
      // legacy add_mcp _ podpora
      const pending = files.filter(f => f.startsWith('add_mcp_')).sort().reverse()[0]
      if (pending) {
        const data = JSON.parse(await readFile(join(tmpDir, pending), 'utf-8'))
        const confirm = await runAddMcpConfirm(trimmed, runId, steps, data)
        if (confirm) { try { const { unlink } = await import('node:fs/promises'); await unlink(join(tmpDir, pending)) } catch {}; return confirm }
      }
    } catch {}
  }

  // ---------- dynamický routing z commands.json ----------
  const commands = await loadCommands()
  const matched = matchCommand(trimmed, commands)

  if (matched)
  {
    // built-in handlery
    const builtIn: Record<string, (msg: string, rid: string, s: string[]) => Promise<{ reply: string; steps: string[] }>> =
    {
      find: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → ROUTING na Lubora`)
        await logActivity({ agent: 'Mary_Jane', type: 'routing', action: `"${msg}" → Lubor_Nehleda` })
        await bumpAgentStats('mary_jane')
        return runFind(msg, rid, s)
      },
      research: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → ROUTING na Julii`)
        await logActivity({ agent: 'Mary_Jane', type: 'routing', action: `"${msg}" → Julia_Nehledalova` })
        await bumpAgentStats('mary_jane')
        return runResearch(msg, rid, s)
      },
      note: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → zápis poznámky`)
        return runNote(msg, rid, s)
      },
      task: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → zápis úkolu`)
        return runTask(msg, rid, s)
      },
      kalendar: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → zápis do kalendáře`)
        return runKalendar(msg, rid, s)
      },
      status: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → status`)
        return runStatus(msg, rid, s)
      },
      commands: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → seznam příkazů`)
        return runCommands(msg, rid, s)
      },
      'daily-brief': async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → daily-brief`)
        return runDailyBrief(msg, rid, s)
      },
      tridil: async (msg, rid, s) =>
      {
        // /tridil [--dry-run] [--all] — ruční běh Třídila (Stažené soubory → podsložky)
        s.push(`Mary Jane: "${msg}" → Třídil`)
        const { runTridil } = await import('./tridil.js')
        const { message } = await runTridil({ dryRun: /--dry-run/.test(msg), all: /--all/.test(msg) })
        s.push('Třídil: hotovo')
        await logRun(rid, { userMessage: msg, mode: 'tridil' })
        return { reply: message, steps: s }
      },
      add: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → přidání příkazu`)
        return runAdd(msg, rid, s)
      },
      remove: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → odebrání příkazu`)
        return runRemove(msg, rid, s)
      },
      pause: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → pozastavení příkazu`)
        return runPause(msg, rid, s)
      },
      resume: async (msg, rid, s) =>
      {
        s.push(`Mary Jane: "${msg}" → obnovení příkazu`)
        return runResume(msg, rid, s)
      },
    }

    const handler = builtIn[matched.handler]
    if (handler)
    {
      return handler(trimmed, runId, steps)
    }

    // custom příkaz — vrať response text přímo (bez LLM)
    if (matched.handler === 'custom' && matched.response)
    {
      steps.push(`Mary Jane: custom příkaz "${matched.name}"`)
      await bumpAgentStats('mary_jane')
      await logRun(runId, { userMessage, mode: 'custom', command: matched.name })
      return { reply: matched.response, steps }
    }
  }


  // BENDER ROUTING - musí být před Mary Jane fallback, ať Mary není zmatená
  const lowerForBender = trimmed.toLowerCase()
  if (lowerForBender.includes('bender') || lowerForBender.includes('blender') || lowerForBender.startsWith('bendere') || lowerForBender.startsWith('/bender') || lowerForBender.startsWith('/blender')) {
    return runBender(trimmed, runId, steps)
  }

  // ---------- žádný příkaz — MJ řeší sama s pamětí + MODEL ROUTER ----------

  const mjDocs = await loadAgentDocs('Mary_Jane')
  const baseModel = await loadAgentModel('Mary_Jane')
  const picked: ModelSpec = pickModel(userMessage, 'chat')
  // fast path <120 znaků -> 3b, jinak meta.json nebo normal 8b
  const finalModel = picked.model || baseModel // FIX: respektuj router, 12GB optimalizace
  const finalCtx = picked.num_ctx || 2048 // FIX 12GB
  const systemPrompt = mjDocs || 'Jsi Mary Jane, sekretářka v LOYO OS. Odpovídej stručně a věcně česky.'

  const history = await loadMemory('Mary_Jane')
  // ÚKOL 34.3: dlouhá paměť – při dotazu na minulost vlož souhrny i s datem zdroje
  const recalled = await recallLongMemory(userMessage)
  if (recalled) steps.push(`Dlouhá paměť: použito ${recalled.count} souhrnů (${recalled.dates})`)
  const messages: ChatMsg[] = [
    { role: 'system', content: systemPrompt },
    ...(recalled? [{ role: 'system', content: recalled.text } as ChatMsg] : []),
   ...history,
    { role: 'user', content: userMessage },
  ]

  let reply: string
  try {
    steps.push(`Model router: "${userMessage.slice(0, 40)}" (${userMessage.length} chars) -> ${finalModel} ${picked.label} ctx=${finalCtx}`)
    const res = await chatWithTimeout({
      model: finalModel,
      messages,
      options: { temperature: 0.3, num_ctx: finalCtx },
    }, picked.timeoutMs)
    reply = res.message.content
  } catch (e: any) {
    reply = `⚠ Mary Jane (${finalModel}) neodpověděla včas: ${e.message}`
    return { reply, steps }
  }

  await saveMemory('Mary_Jane', [
   ...history,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: reply },
  ])
  await bumpAgentStats('mary_jane')
  await logRun(runId, { userMessage, mode: 'chat', model: finalModel, router: picked.label, reply })
  // 2.x: zdroj z dlouhé paměti pod odpovědí
  return { reply: recalled? `${reply}\n\n🗂 Zdroj z dlouhé paměti: ${recalled.dates}` : reply, steps }
}


// ============================================================
// HLAVNÍ TOK S P-QUEUE (žádný while(true) polling)
// ============================================================
export async function runOrchestrator(userMessage: string, source: string = 'ui'): Promise<RunResult>
{
  const steps: string[] = []
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`
  const trimmed = userMessage.trim()
  const priority = getPriority(trimmed)
  const pQueuePriority = 10 - priority

  // terminál (/terminal, /ps a zprávy do běžícího shellu) jde mimo frontu
  if (isShellMessage(trimmed)) {
    const shell = await tryAgentCommand(trimmed).catch((e: any) => ({ reply: `❌ Terminál: ${e?.message ?? e}`, steps: [] as string[] }))
    if (shell) return shell
  }

  if (jobQueue.pending > 0 || jobQueue.size > 0) {
    const job = await enqueueJob(trimmed, priority)
    jobQueue.add(async () => {
      const s: string[] = []
      try {
        await markJobStatus(job.id, 'running', runId)
        const result = await runOrchestratorCore(job.message, runId, s)
        await markJobStatus(job.id, 'done', runId)
        // zadáno z Telegramu → výsledek tam po dokončení pošli (jinak by se ztratil)
        if (source === 'telegram' && result?.reply) {
          await sendTelegram(`✅ Úkol #${job.id.slice(0, 6)} hotový:\n\n${result.reply}`)
        }
      } catch (e: any) {
        await markJobStatus(job.id, 'failed', runId)
        if (source === 'telegram') await sendTelegram(`❌ Úkol #${job.id.slice(0, 6)} selhal: ${e?.message ?? e}`)
      }
    }, { priority: pQueuePriority })
    return {
      reply: `⏳ Fronta: úkol #${job.id.slice(0, 6)} zařazen (priorita ${priority}), před tebou ${jobQueue.size} úkolů.${source === 'telegram' ? ' Výsledek ti pošlu sem, až bude hotový.' : ''}`,
      steps: [`p-queue enqueued ${job.id} prio=${priority} size=${jobQueue.size}`]
    }
  }

  return jobQueue.add(() => runOrchestratorCore(trimmed, runId, steps), { priority: pQueuePriority }) as Promise<RunResult>
}
