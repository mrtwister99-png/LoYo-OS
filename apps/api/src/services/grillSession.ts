// apps/api/src/services/grillSession.ts
// LOYO OS // MARY JANE — /grill <téma>: brainstorming podle skillu grill-me (GRILLING.md).
// Mary se ptá po kolech (každá otázka s doporučenou odpovědí), dokud není jasno.
// Další zprávy bez „/“ jdou do sezení; /grill stop → shrnutí rozhodnutí do data/reports/.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Ollama } from 'ollama'
import { DATA_DIR } from '../lib/dataPaths.js'
import { logActivity } from '../routes/activity.js'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }
type Session = { topic: string; history: Msg[]; startedAt: number; lastAt: number }

const SKILL_FILE = join(DATA_DIR, 'capabilities', 'skills', 'grill-me', 'GRILLING.md')
const REPORTS = join(DATA_DIR, 'reports')
const IDLE_MS = 2 * 60 * 60_000
const TIMEOUT_MS = 240_000

let session: Session | null = null

export function grillActive(): boolean {
  if (session && Date.now() - session.lastAt > IDLE_MS) session = null
  return !!session
}

async function systemPrompt(topic: string): Promise<string> {
  const raw = await readFile(SKILL_FILE, 'utf8').catch(() => '')
  const body = raw.replace(/^---[\s\S]*?---\s*/, '').trim() ||
    'Interview the user relentlessly about the plan. Ask numbered questions in rounds, each with your recommended answer, and wait for answers.'
  return [
    body,
    '',
    '---',
    'Jsi Mary Jane z LOYO OS a vedeš tento „grilling“ brainstorming s Architektem.',
    'Piš VŽDY česky, tykej, stručně. Formát otázky: „❓ Q1 — název: otázka“ a pod ní „➡️ doporučení“.',
    'Jedno kolo = jen otázky, na které se dá odpovědět teď. Pak čekej na odpovědi.',
    `Téma: ${topic}`,
  ].join('\n')
}

async function ask(messages: Msg[], numPredict = 1400): Promise<string> {
  const model = process.env.MARY_GRILL_MODEL || 'qwen3.5:27b'
  const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' })
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`model ${model} neodpověděl do ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS) })
  try {
    const res: any = await Promise.race([ollama.chat({ model, messages, options: { temperature: 0.4, num_predict: numPredict } }), timeout])
    // qwen3 občas pošle <think>…</think>
    return String(res?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '(model mlčí)'
  } finally {
    clearTimeout(timer!)
  }
}

export async function startGrill(topic: string): Promise<string> {
  session = null
  const history: Msg[] = [
    { role: 'system', content: await systemPrompt(topic) },
    { role: 'user', content: `Chci se nechat vygrilovat k tomuhle: ${topic}` },
  ]
  const reply = await ask(history)
  history.push({ role: 'assistant', content: reply })
  session = { topic, history, startedAt: Date.now(), lastAt: Date.now() }
  await logActivity({ agent: 'Mary Jane', type: 'system', action: `grill-me brainstorming: ${topic.slice(0, 80)}` }).catch(() => {})
  return `🔥 Grill — ${topic}\n\n${reply}\n\n— odpovídej normálně (bez /) · /grill stop = shrnutí a konec`
}

export async function continueGrill(text: string): Promise<string> {
  if (!session) return 'Žádný grill neběží. Začni: /grill <téma>'
  session.history.push({ role: 'user', content: text })
  const reply = await ask(session.history)
  session.history.push({ role: 'assistant', content: reply })
  session.lastAt = Date.now()
  return `🔥 ${reply}`
}

export async function stopGrill(): Promise<string> {
  if (!session) return 'Žádný grill neběží.'
  const s = session
  session = null
  if (s.history.length <= 3) return `🔥 Grill „${s.topic}“ ukončen (bez odpovědí, nic k shrnutí).`
  const summary = await ask([
    ...s.history,
    { role: 'user', content: 'Konec. Shrň česky, na čem jsme se dohodli: odrážky „rozhodnutí → důvod“, pak „otevřené otázky“ a „další kroky“. Žádné nové otázky.' },
  ], 1200).catch((e) => `(shrnutí selhalo: ${e?.message ?? e})`)
  await mkdir(REPORTS, { recursive: true })
  const slug = s.topic.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '')
  const file = join(REPORTS, `grill_${new Date().toISOString().slice(0, 10)}_${slug || 'tema'}.md`)
  const transcript = s.history.filter((m) => m.role !== 'system').map((m) => `**${m.role === 'user' ? 'Ty' : 'Mary'}:**\n${m.content}`).join('\n\n')
  await writeFile(file, `# Grill — ${s.topic}\n\n## Shrnutí\n\n${summary}\n\n## Průběh\n\n${transcript}\n`, 'utf8')
  await logActivity({ agent: 'Mary Jane', type: 'system', action: `grill hotový: ${s.topic.slice(0, 60)} → ${file}` }).catch(() => {})
  return `✅ Grill „${s.topic}“ hotový\n\n${summary}\n\n📄 ${file}`
}
