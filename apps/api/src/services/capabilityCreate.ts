// apps/api/src/services/capabilityCreate.ts
// LOYO OS // MARY JANE — /new agent|team|workflow|cli přímo z chatu (UI i Telegram).
// Zakládá přes POST /api/capabilities, takže index.json, číslování a mozek agenta
// (01_CORE_IDENTITY.md) vzniknou úplně stejně jako z Builderu.
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { resolveUserPath, SCRIPT_EXT } from './scriptRunner.js'
import { DATA_DIR } from '../lib/dataPaths.js'
import { getCapabilities } from '../lib/manifestLoader.js'

type CommandResult = { reply: string; steps: string[] }
type NewKind = 'agent' | 'team' | 'workflow' | 'cli'

const API_URL = (process.env.LOYO_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

// /new 1 = agent, 2 = team, 5 = cli, 7 = workflow (stejná čísla typů jako /edit, /list)
const KIND_BY_WORD: Record<string, NewKind> = {
  agent: 'agent', agenta: 'agent', agenti: 'agent', '1': 'agent',
  team: 'team', tym: 'team', '2': 'team',
  cli: 'cli', '5': 'cli',
  workflow: 'workflow', wf: 'workflow', '7': 'workflow',
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const toKebab = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

export function parseNewKind(args: string): { kind: NewKind; rest: string } | null {
  const m = args.trim().match(/^(\S+)\s*([\s\S]*)$/)
  if (!m) return null
  const kind = KIND_BY_WORD[norm(m[1])]
  return kind ? { kind, rest: m[2].trim() } : null
}

const USAGE: Record<NewKind, string> = {
  agent: '/new agent <jméno> - <co dělá> [| skript: plocha/x.py] [| ps: <příkaz>] [| cmd: <příkaz>]\nnapř. /new agent Hlídač bytů - hlídá nové byty v Brně do 5 mil.\nnapř. /new agent Joozina - spouští můj skript | skript: plocha/neco.py',
  team: '/new team <jméno> - <účel> | agenti: <id nebo číslo>, <…>\nnapř. /new team Bazar - nákup a prodej | agenti: lopatinka, stepan',
  workflow: '/new workflow <jméno> - <popis> | kroky: <capability> > <capability> > …\nnapř. /new workflow Ranní kolečko - tipy a úklid | kroky: lopatinka > kosterad-fuckstein',
  cli: '/new cli <jméno> - <co dělá>\nnapř. /new cli zaloha - zazálohuje data/ na disk D',
}

export function newUsage(): string {
  return ['➕ Nové věci přes Mary', ...Object.values(USAGE), 'MCP a skill s researchem: /new mcp <téma> · /new skill <téma>'].join('\n\n')
}

// "Jméno - popis | agenti: a, b | kroky: x > y"
function parseSpec(rest: string) {
  // ps:/cmd: příkaz může sám obsahovat | (roura) → bere se všechno do konce zprávy
  const shellOpt = rest.match(/\|\s*(ps|powershell|cmd|terminal)\s*:\s*([\s\S]*)$/i)
  if (shellOpt) rest = rest.slice(0, shellOpt.index)
  const [head, ...opts] = rest.split('|').map((x) => x.trim())
  const sep = head.match(/\s+[-–—:]\s+/)
  const name = (sep ? head.slice(0, sep.index) : head).trim()
  const description = (sep ? head.slice((sep.index ?? 0) + sep[0].length) : '').trim()
  const options: Record<string, string> = {}
  for (const o of opts) {
    const m = o.match(/^([^:]+):\s*([\s\S]*)$/)
    if (m) options[norm(m[1])] = m[2].trim()
  }
  if (shellOpt) options[norm(shellOpt[1])] = shellOpt[2].trim()
  return { name, description, options }
}

export async function findCapability(ref: string, type?: string) {
  const { capabilities } = await getCapabilities()
  const pool = (capabilities as any[]).filter((c) => !type || c.type === type)
  const r = norm(ref)
  return (
    pool.find((c) => c.id === r) ||
    pool.find((c) => String(c.number) === r || String(c.number).split(/[-_]/).pop() === r) ||
    pool.find((c) => norm(String(c.displayName ?? '')) === r) ||
    pool.find((c) => c.id.startsWith(r) || norm(String(c.displayName ?? '')).includes(r)) ||
    null
  )
}

async function postCapability(type: NewKind, manifest: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/capabilities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, manifest }),
    signal: AbortSignal.timeout(30_000),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return data as { path: string; message: string }
}

export async function runNewCapability(kind: NewKind, rest: string): Promise<CommandResult> {
  const steps = [`Mary Jane: /new ${kind}`]
  const { name, description, options } = parseSpec(rest)
  if (!name) return { reply: `Jak to zapsat:\n${USAGE[kind]}`, steps }

  const id = toKebab(name)
  if (id.length < 2) return { reply: `Z názvu „${name}“ neumím udělat id. Zkus jiný název.\n${USAGE[kind]}`, steps }
  if (await findCapability(id, kind).then((c) => c?.id === id)) {
    return { reply: `${kind} „${id}“ už existuje. Uprav ho přes /edit nebo zvol jiný název.`, steps }
  }

  const base = {
    id,
    displayName: name.slice(0, 100),
    description: (description || `${name} — založeno Mary přes chat`).slice(0, 500),
    version: '0.1.0',
    status: 'draft',
    model: 'qwen3:8b',
    tags: ['mary'],
  }
  let manifest: Record<string, unknown>
  const notes: string[] = []

  if (kind === 'agent') {
    // | skript: plocha/x.py  → agent spouští skript (.py .ps1 .cmd .bat .mjs .js)
    // | ps: <příkaz> / | cmd: <příkaz> → agent spouští příkaz v PowerShellu / cmd
    const script = options.skript ?? options.script ?? options.py
    const shellCmd = options.ps ?? options.powershell ?? options.cmd ?? options.terminal
    if (script) {
      const file = resolveUserPath(script)
      const ext = extname(file).toLowerCase()
      if (!SCRIPT_EXT.includes(ext)) return { reply: `Skript ${file} neumím spouštět — umím ${SCRIPT_EXT.join(', ')}.`, steps }
      manifest = {
        ...base,
        runtime: ext === '.py' ? 'python' : ext === '.mjs' || ext === '.js' ? 'node' : 'composite',
        entrypoint: file,
        script: file,
        permissions: [`exec:${file}`],
      }
      notes.push(`Skript: ${file}${existsSync(file) ? '' : ' ⚠ zatím neexistuje'}`, `Spuštění: /spust ${id} [argumenty]`)
    } else if (shellCmd) {
      const shellKind = options.ps || options.powershell ? 'ps' : 'cmd'
      manifest = { ...base, runtime: 'composite', entrypoint: `shell:${shellKind}`, shell: { kind: shellKind, command: shellCmd }, permissions: [`exec:${shellKind}`] }
      notes.push(`${shellKind === 'ps' ? 'PowerShell' : 'cmd'}: ${shellCmd}`, `Spuštění: /spust ${id}`)
    } else {
      manifest = { ...base, runtime: 'prompt', entrypoint: './01_CORE_IDENTITY.md', systemPrompt: description || undefined }
    }
  } else if (kind === 'team') {
    const refs = (options.agenti ?? options.agents ?? options.clenove ?? '').split(/[,;]+/).map((x) => x.trim()).filter(Boolean)
    if (!refs.length) return { reply: `Tým potřebuje aspoň jednoho agenta.\n${USAGE.team}`, steps }
    const members: string[] = []
    const missing: string[] = []
    for (const ref of refs) {
      const found = await findCapability(ref, 'agent')
      if (found) members.includes(found.id) || members.push(found.id)
      else missing.push(ref)
    }
    if (missing.length) return { reply: `Tyhle agenty neznám: ${missing.join(', ')}. Seznam: /agents`, steps }
    manifest = {
      ...base, runtime: 'composite', entrypoint: `teams/${id}/index.ts`, members,
      coordination: options.koordinace || options.coordination || 'sequential',
    }
    notes.push(`Členové: ${members.join(', ')}`)
  } else if (kind === 'workflow') {
    const refs = (options.kroky ?? options.steps ?? '').split(/>|->|→|,/).map((x) => x.trim()).filter(Boolean)
    if (!refs.length) return { reply: `Workflow potřebuje aspoň jeden krok.\n${USAGE.workflow}`, steps }
    const wfSteps: any[] = []
    const missing: string[] = []
    for (const ref of refs) {
      const found = await findCapability(ref)
      if (!found) { missing.push(ref); continue }
      const stepId = `s${wfSteps.length + 1}`
      wfSteps.push({
        id: stepId, capabilityId: found.id, input: {},
        dependsOn: wfSteps.length ? [wfSteps[wfSteps.length - 1].id] : [], retryPolicy: 'none',
      })
    }
    if (missing.length) return { reply: `Tyhle kroky nenacházím mezi capabilities: ${missing.join(', ')}. Zkus id (např. lopatinka) nebo /list.`, steps }
    manifest = { ...base, runtime: 'composite', entrypoint: `workflows/${id}`, steps: wfSteps }
    notes.push(`Kroky: ${wfSteps.map((s) => s.capabilityId).join(' → ')}`)
  } else {
    manifest = {
      ...base, runtime: 'node', entrypoint: './index.mjs',
      subcommands: [{ name: 'run', description: base.description, flags: [] }],
      permissions: [`fs:read:data/capabilities/cli/${id}`],
    }
  }

  const saved = await postCapability(kind, manifest)
  steps.push(`Koštěrad: ${saved.path}`)

  if (kind === 'cli') {
    const stub = [
      '#!/usr/bin/env node',
      `// ${name} — CLI založené Mary Jane. ${base.description}`,
      `// Spuštění: node data/capabilities/cli/${id}/index.mjs run [argumenty]`,
      '',
      'const [, , command = \'run\', ...args] = process.argv',
      '',
      'if (command === \'run\') {',
      `  console.log('${name.replace(/'/g, "\\'")}: zatím prázdná kostra, argumenty:', args)`,
      '} else {',
      '  console.error(`Neznámý příkaz: ${command}`)',
      '  process.exitCode = 1',
      '}',
      '',
    ].join('\n')
    await writeFile(join(DATA_DIR, 'capabilities', 'cli', id, 'index.mjs'), stub, 'utf8')
    notes.push(`Kostra: data/capabilities/cli/${id}/index.mjs`)
  }

  const LABEL: Record<NewKind, string> = { agent: '🤖 Agent', team: '👥 Tým', workflow: '🔁 Workflow', cli: '🛠️ CLI' }
  return {
    reply: [`${LABEL[kind]} „${name}“ založen (draft)`, saved.message, ...notes, '', 'Doladíš v UI přes /edit nebo v Builderu.'].join('\n'),
    steps,
  }
}
