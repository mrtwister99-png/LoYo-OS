// apps/api/src/services/agentDesign.ts
// LOYO OS // KOŠTĚRAD — návrh agenta před výrobou:
//   /navrh <co chceš>  →  Julia research  →  Koštěrad: popis, MINIMÁLNÍ POŽADAVKY, kritéria „hotovo“,
//   vstupy/výstupy, MCP, otázky  →  Mary pošle návrh s ✅ Vyrobit / ❌ Zrušit (chat, Telegram, oznámení)
//   →  po potvrzení vyrobí agenta a požadavky zapíše do jeho identity.
// Běží na pozadí — chat ani Telegram neblokuje.
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Ollama } from 'ollama'
import { AGENTS_DIR } from '../lib/dataPaths.js'
import { logActivity } from '../routes/activity.js'
import { saveChatMessage } from './chatHistory.js'
import { askConfirm } from './shellPolicy.js'

type Design = {
  displayName: string
  description: string
  minRequirements: string[]
  criteria: string[]
  inputs: string[]
  outputs: string[]
  mcp: string[]
  schedule: string
  questions: string[]
}

const KNOWN_MCP: Record<string, string> = { filesystem: 'soubory na PC', fetch: 'čtení webových stránek', playwright: 'skutečný prohlížeč (klikání, formuláře, screenshoty)', blender: 'Blender 3D' }
const MCP_NUM: Record<string, number> = { filesystem: 1, blender: 2, fetch: 3, playwright: 4 }

async function ask(prompt: string): Promise<string> {
  const model = process.env.KOSTERAD_MODEL || process.env.MARY_GRILL_MODEL || 'qwen3.5:27b'
  const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' })
  let t: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`model ${model} neodpověděl do 240 s`)), 240_000) })
  try {
    const res: any = await Promise.race([ollama.chat({ model, messages: [{ role: 'user', content: prompt }], options: { temperature: 0.2, num_predict: 1400 }, format: 'json' } as any), timeout])
    return String(res?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  } finally { clearTimeout(t!) }
}

const list = (v: any, n = 8): string[] => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []).map((x) => String(x).trim()).filter(Boolean).slice(0, n)

async function design(goal: string, research: string): Promise<Design> {
  const prompt = [
    'Jsi Koštěrad, builder agentů v LOYO OS. Navrhni JEDNOHO agenta podle zadání a researche.',
    'Buď stručný a konkrétní, česky. Vrať POUZE JSON:',
    '{"displayName":"krátké jméno","description":"1–2 věty co dělá","minRequirements":["co MUSÍ umět minimálně"],',
    '"criteria":["měřitelné kritérium, kdy je hotovo / funguje"],"inputs":["co dostává"],"outputs":["co vrací / kam posílá"],',
    `"mcp":["jen z: ${Object.keys(KNOWN_MCP).join(', ')}"],"schedule":"kdy poběží (ručně / denně 8:00 / …)",`,
    '"questions":["max 3 otázky na Architekta, bez kterých to nejde"]}',
    '',
    `ZADÁNÍ: ${goal}`,
    '',
    'RESEARCH (Julia):',
    research.slice(0, 5000),
  ].join('\n')
  let j: any = {}
  try { j = JSON.parse((await ask(prompt)).replace(/^```(?:json)?|```$/g, '')) } catch {}
  return {
    displayName: String(j.displayName || goal).slice(0, 60),
    description: String(j.description || goal).slice(0, 400),
    minRequirements: list(j.minRequirements),
    criteria: list(j.criteria),
    inputs: list(j.inputs, 5),
    outputs: list(j.outputs, 5),
    mcp: list(j.mcp, 4).map((m) => m.toLowerCase()).filter((m) => m in KNOWN_MCP),
    schedule: String(j.schedule || 'ručně').slice(0, 80),
    questions: list(j.questions, 3),
  }
}

function describe(d: Design, reportFile: string | null): string {
  const block = (title: string, items: string[]) => (items.length ? [title, ...items.map((x) => `• ${x}`), ''] : [])
  return [
    `🧹 Koštěrad: návrh agenta „${d.displayName}“`,
    d.description,
    '',
    ...block('✅ Minimální požadavky:', d.minRequirements),
    ...block('🎯 Kritéria „hotovo“:', d.criteria),
    ...block('📥 Vstupy:', d.inputs),
    ...block('📤 Výstupy:', d.outputs),
    `🔌 MCP: ${d.mcp.length ? d.mcp.map((m) => `${m} (${KNOWN_MCP[m]})`).join(', ') : 'žádné'}`,
    `⏰ Běh: ${d.schedule}`,
    '',
    ...block('❓ Otázky pro tebe (odpověz a pošli /navrh znovu s upřesněním):', d.questions),
    ...(reportFile ? [`📄 Research Julie: ${reportFile}`, ''] : []),
  ].join('\n').trim()
}

async function build(d: Design): Promise<string> {
  const { runNewCapability } = await import('./capabilityCreate.js')
  const created = await runNewCapability('agent', `${d.displayName} - ${d.description}`)
  const id = created.reply.match(/agents\/([a-z0-9-]+)\/manifest\.json/)?.[1]
  if (!id) return created.reply
  const mp = join(AGENTS_DIR, id, 'manifest.json')
  try {
    const m = JSON.parse(await readFile(mp, 'utf8'))
    m.dependencies = [...new Set([...(m.dependencies ?? []), ...d.mcp.map((x) => `${x}:${MCP_NUM[x]}`)])]
    m.requirements = { min: d.minRequirements, criteria: d.criteria, inputs: d.inputs, outputs: d.outputs, schedule: d.schedule }
    m.status = 'draft'
    await writeFile(mp, JSON.stringify(m, null, 2) + '\n', 'utf8')
    const sec = (t: string, items: string[]) => (items.length ? `\n## ${t}\n${items.map((x) => `- ${x}`).join('\n')}\n` : '')
    await appendFile(join(AGENTS_DIR, id, '01_CORE_IDENTITY.md'),
      `${sec('Minimální požadavky (Koštěrad)', d.minRequirements)}${sec('Kritéria hotovo', d.criteria)}${sec('Vstupy', d.inputs)}${sec('Výstupy', d.outputs)}\n## Běh\n- ${d.schedule}\n`, 'utf8')
  } catch {}
  await logActivity({ agent: 'Koštěrad', type: 'save', action: `vyrobil agenta ${d.displayName} (${id}) podle návrhu`, meta: { id, mcp: d.mcp } }).catch(() => {})
  return `🧹 Vyrobeno: ${d.displayName} (${id})\n${d.minRequirements.length} požadavků a ${d.criteria.length} kritérií zapsáno do jeho identity, MCP připnuto: ${d.mcp.join(', ') || 'žádné'}.\nDoladíš v UI: Agenti → ${d.displayName} → ⚙.`
}

/** Jen náhled návrhu (research + Koštěrad) — bez chatu, bez potvrzení, bez výroby. Pro testy. */
export async function designPreview(goal: string): Promise<{ text: string; design: Design }> {
  const { runResearch } = await import('./orchestrator.js')
  const r: any = await runResearch(`/research ${goal} — co by měl umět software agent na tohle, odkud brát data, existující nástroje, rizika`, `preview-${Date.now()}`, [])
  const file = r?.julia?.file ?? null
  const research = file ? await readFile(file, 'utf8').catch(() => '') : String(r?.reply ?? '')
  const d = await design(goal, research)
  return { text: describe(d, file), design: d }
}

/** /navrh <co chceš> — spustí na pozadí, hned vrátí potvrzení. */
export function startDesign(goal: string): string {
  const runId = `navrh-${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 6)}`
  ;(async () => {
    await logActivity({ agent: 'Koštěrad', type: 'system', action: `návrh agenta: „${goal.slice(0, 80)}“ — Julia hledá`, meta: { runId } }).catch(() => {})
    let research = ''
    let reportFile: string | null = null
    try {
      const { runResearch } = await import('./orchestrator.js')
      const r: any = await runResearch(`/research ${goal} — co by měl umět software agent na tohle, odkud brát data, existující nástroje, rizika`, runId, [])
      reportFile = r?.julia?.file ?? null
      research = reportFile ? await readFile(reportFile, 'utf8').catch(() => '') : String(r?.reply ?? '')
    } catch (e: any) {
      research = `(research selhal: ${e?.message ?? e})`
    }
    const d = await design(goal, research)
    const text = describe(d, reportFile)
    const msg = askConfirm(text, `vyrobit agenta ${d.displayName}`, () => build(d), 24 * 3_600_000)
    await saveChatMessage('mary', msg).catch(() => {})
    await logActivity({ agent: 'Koštěrad', type: 'system', action: `návrh agenta „${d.displayName}“ hotový — čeká na schválení`, meta: { runId, file: reportFile } }).catch(() => {})
  })().catch(async (e) => {
    await saveChatMessage('mary', `❌ Návrh agenta selhal: ${e?.message ?? e}`).catch(() => {})
    await logActivity({ agent: 'Koštěrad', type: 'error', action: `návrh agenta selhal: ${e?.message ?? e}` }).catch(() => {})
  })
  return [
    `🔎 Jdu na to: „${goal}“`,
    '1) Julia udělá research  2) Koštěrad navrhne minimální požadavky a kritéria',
    'Návrh ti pošlu sem (i do Telegramu) s ✅ Vyrobit / ❌ Zrušit — trvá to pár minut.',
  ].join('\n')
}
