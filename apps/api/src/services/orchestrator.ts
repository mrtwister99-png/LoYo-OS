// D:\dev\loyo-os\apps\api\src\services\orchestrator.ts
// LOYO OS // ORCHESTRATOR — nervová soustava: MD mozky + CLI ruce + Ollama + paměť
import { Ollama } from 'ollama'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { logActivity } from '../routes/activity'
import { logRun } from './runLogger'
import { webSearch, type SearchResult } from './web_search'
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
} from '../lib/dataPaths'
import { pickModel, getPriority, MODELS, type ModelSpec } from './modelRouter'
import { enqueueJob, getNextPendingJob, markJobStatus, getQueueLength, isQueueBusy, setQueueBusy, loadQueue } from './queue'

const execFileAsync = promisify(execFile)
// KONVENCE v3 - jediný zdroj pravdy je dataPaths.ts, žádný D:/ hardcode
const POZNAMKY_DIR = JA_POZNAMKY_DIR
const UKOLY_AKTIVNI_DIR = JA_UKOLY_AKTIVNI_DIR
const UKOLY_HOTOVE_DIR = JA_UKOLY_HOTOVE_DIR
const KALENDAR_DIR = JA_KALENDAR_DIR
const COMMANDS_FILE = join(AGENTS_DIR, 'mary-jane', 'commands.json')
const ROOT = resolve(DATA_DIR, '..')

const ollama = new Ollama({ host: 'http://localhost:11434' })
const MODEL = 'qwen3:8b'
const FAST_MODEL = MODELS.FAST.model
const MAX_MEMORY_MESSAGES = 20 // posledních 10 výměn drženo v kontextu
const OLLAMA_TIMEOUT_MS = 90000 // ochrana proti zaseklému/pomalému modelu
const DEEP_TIMEOUT_MS = 120000 // deep research smí trvat déle

// fronta - in-memory guard proti paralelním běhům
let queueProcessing = false

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

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
  const trimmed = history.slice(-MAX_MEMORY_MESSAGES)
  await mkdir(dirname(memoryPath(folder)), { recursive: true })
  await writeFile(memoryPath(folder), JSON.stringify(trimmed, null, 2), 'utf-8')
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
      options: { temperature: 0.3, num_ctx: 8192 },
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
  await logActivity({ agent: 'Julia_Nehledalova', type: 'search', action: `web_search: "${query}"` })

  const searchResults = await webSearch(query, 5)
  steps.push(`Julia: nalezeno ${searchResults.length} zdrojů`)

  const zdrojeBlock = searchResults.length
    ? searchResults
        .map((r: SearchResult, i: number) => `### Zdroj ${i + 1}: ${r.title}\nURL: ${r.url}\nObsah: ${r.snippet}`)
        .join('\n\n')
    : '(vyhledávání nevrátilo žádné použitelné výsledky — zkus jiný, méně specifický dotaz)'

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
            content: `Zadání: ${query}\n\nŽIVÁ DATA Z WEBU (použij je jako primární zdroj, cituj přesné URL v sekci Zdroje):\n${zdrojeBlock.slice(0, 9000)}\n\nSestav report podle svého protokolu (Klíčové nálezy → Detailní shrnutí → Zdroje/omezení). Pokud data z webu k tématu nestačí nebo chybí, řekni to na rovinu a doplň jen to, co je ověřitelné. Nikdy netvrď fakt, který není podložený zdrojem výše.`,
          },
        ],
        options: { temperature: 0.4, num_ctx: 8192 },
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

  const reply = `Research "${query}" máš hotový a je uložený v \`${file}\``
  return { reply, steps }
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

  const picked = pickModel(userMessage, 'status')
  const reply = [
    `📋 **Status LoYo OS** [${picked.label} <1s]`,
    `• Otevřené úkoly: ${openCount} / ${taskFilesAll.length}`,
    `• Poznámky celkem: ${noteFiles.length}`,
    `• Kalendářní události: ${eventFiles.length}`,
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
  const reply = [`☀️ **Daily Brief**`, `• Aktivní úkoly: ${taskFilesAktivni.length}`, `• Hotové: ${taskFilesHotove.length}`, `• Poznámky: ${noteFiles.length}`, `• Kalendář dnes: ${eventFiles.length}`, ``, `Napiš /status pro detail.`].join('\n')
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
// CORE LOGIKA - bez fronty, voláno z fronty i přímo
// ============================================================
async function runOrchestratorCore(userMessage: string, runId: string, steps: string[]): Promise<{ reply: string; steps: string[] }>
{
  const trimmed = userMessage.trim()

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

  // ---------- žádný příkaz — MJ řeší sama s pamětí + MODEL ROUTER ----------
  const mjDocs = await loadAgentDocs('Mary_Jane')
  const baseModel = await loadAgentModel('Mary_Jane')
  const picked: ModelSpec = pickModel(userMessage, 'chat')
  // fast path <120 znaků -> 3b, jinak meta.json nebo normal 8b
  const finalModel = picked.label === 'fast-3b'? picked.model : (baseModel || picked.model)
  const finalCtx = picked.num_ctx || 4096
  const systemPrompt = mjDocs || 'Jsi Mary Jane, sekretářka v LOYO OS. Odpovídej stručně a věcně česky.'

  const history = await loadMemory('Mary_Jane')
  const messages: ChatMsg[] = [
    { role: 'system', content: systemPrompt },
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
  return { reply, steps }
}

// ============================================================
// HLAVNÍ TOK S FRONTOU
// ============================================================
async function processPendingQueue() {
  while (true) {
    const next = await getNextPendingJob()
    if (!next) break
    await markJobStatus(next.id, 'running', next.runId)
    const steps: string[] = []
    const runId = next.runId || `${new Date().toISOString().replace(/[:.]/g, '-')}_${next.id.slice(0, 8)}`
    try {
      await runOrchestratorCore(next.message, runId, steps)
      await markJobStatus(next.id, 'done', runId)
    } catch {
      await markJobStatus(next.id, 'failed', runId)
    }
  }
}

export async function runOrchestrator(userMessage: string): Promise<{ reply: string; steps: string[] }>
{
  const steps: string[] = []
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`
  const trimmed = userMessage.trim()
  const priority = getPriority(trimmed)

  // pokud už něco běží, zařaď do fronty - akceptace ÚKOL 10
  if (queueProcessing || isQueueBusy()) {
    const job = await enqueueJob(trimmed, priority)
    const len = await getQueueLength()
    return { reply: `⏳ Fronta: úkol #${job.id.slice(0, 6)} zařazen (priorita ${priority}), před tebou ${len - 1} úkolů.`, steps: [`Queue enqueued ${job.id} prio=${priority} len=${len}`] }
  }

  queueProcessing = true
  setQueueBusy(true)
  try {
    const result = await runOrchestratorCore(trimmed, runId, steps)
    // po doběhu zpracuj co se mezitím nahromadilo
    await processPendingQueue()
    return result
  } finally {
    queueProcessing = false
    setQueueBusy(false)
  }
}
