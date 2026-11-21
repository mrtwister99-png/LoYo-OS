// apps/api/src/services/scriptCommands.ts
// LOYO OS // MARY JANE — /py (napiš .py), /skript (spusť soubor), /spust <agent> (spusť agenta)
// a česká věta typu: „udělej neco.py na plochu, co … a vytvoř agenta Joozina, ať ho použije“.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { AGENTS_DIR } from '../lib/dataPaths.js'
import { logActivity } from '../routes/activity.js'
import { findCapability, runNewCapability } from './capabilityCreate.js'
import { guarded } from './shellPolicy.js'
import { CODE_MODEL, desktopDir, resolveUserPath, runScriptFile, runShellOnce, SCRIPT_EXT, writePythonScript } from './scriptRunner.js'

type CommandResult = { reply: string; steps: string[] }

const activity = (agent: string, action: string) => logActivity({ agent, type: 'system', action }).catch(() => {})

function splitArgs(s: string): string[] {
  const out: string[] = []
  for (const m of s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

function preview(code: string, lines = 30): string {
  const all = code.split('\n')
  return all.slice(0, lines).join('\n') + (all.length > lines ? `\n… (+${all.length - lines} řádků)` : '')
}

// ---------- /py <soubor> - <zadání> [--prepis] ----------
export async function pyCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /py']
  const overwrite = /\s--prepis\b|\s--přepiš\b|\s--force\b/i.test(` ${args}`)
  const clean = args.replace(/\s--(prepis|přepiš|force)\b/gi, '').trim()
  const m = clean.match(/^(\S+\.py)\s*(?:[-–—:]\s*)?([\s\S]*)$/i)
  if (!m || !m[2].trim()) {
    return {
      reply: [
        'Jak na to: /py <soubor.py> - <co má dělat>',
        'např. /py plocha/kurzy.py - stáhne kurz EUR z ČNB a vypíše ho',
        `Bez cesty = na plochu (${desktopDir()}). Existující soubor přepíšu jen s --prepis.`,
        'Spuštění: /skript plocha/kurzy.py',
      ].join('\n'),
      steps,
    }
  }
  return createPy(m[1], m[2].trim(), overwrite, steps)
}

async function createPy(fileRef: string, task: string, overwrite: boolean, steps: string[]): Promise<CommandResult> {
  const file = resolveUserPath(fileRef)
  if (existsSync(file) && !overwrite) {
    return { reply: `📄 ${file} už existuje — nepřepíšu ho. Přidej --prepis, nebo ho rovnou spusť: /skript ${file}`, steps }
  }
  await activity('Mary Jane', `píše ${basename(file)} (${CODE_MODEL})`)
  const res = await writePythonScript(file, task)
  const code = await readFile(file, 'utf8').catch(() => '')
  steps.push(`Mary Jane: ${file} (${res.usedModel ?? 'kostra'})`)
  return {
    reply: [
      `🐍 ${res.usedModel ? 'Hotovo' : 'Kostra'}: ${file}`,
      res.note ?? `Napsal ${res.usedModel}.`,
      '',
      preview(code),
      '',
      `Spustit: /skript ${file}`,
    ].join('\n'),
    steps,
  }
}

// ---------- /skript <soubor> [argumenty] ----------
export async function scriptCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /skript']
  const [ref, ...rest] = splitArgs(args)
  if (!ref) return { reply: `Jak na to: /skript <soubor> [argumenty] — umím ${SCRIPT_EXT.join(', ')}\nnapř. /skript plocha/kurzy.py`, steps }
  const file = resolveUserPath(ref)
  await activity('Mary Jane', `spouští skript ${basename(file)}`)
  const { code, output } = await runScriptFile(file, rest)
  return { reply: `▶️ ${file}${rest.length ? ` ${rest.join(' ')}` : ''}\n\n${output || '(bez výstupu)'}${code ? `\n\n⚠ exit ${code}` : ''}`, steps }
}

// ---------- /spust <agent> [argumenty] ----------
export async function runAgentCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /spust']
  const [ref, ...rest] = splitArgs(args)
  if (!ref) return { reply: 'Jak na to: /spust <agent> [argumenty] — spustí skript nebo příkaz agenta (seznam: /agents)', steps }
  const found: any = await findCapability(ref, 'agent')
  if (!found) return { reply: `Agenta „${ref}“ neznám. Seznam: /agents`, steps }
  // loader manifestů pole navíc (script, shell) zahazuje → surový manifest z disku
  const raw = await readFile(join(AGENTS_DIR, found.id, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => ({}))
  const agent: any = { ...found, ...raw }
  const name = agent.displayName ?? agent.id
  const dir = join(AGENTS_DIR, agent.id)

  // 1) skript (.py .ps1 .cmd .bat .mjs .js) — absolutní cesta, nebo relativně ke složce agenta
  const scriptRef: string | undefined = agent.script ??
    (SCRIPT_EXT.some((e) => String(agent.entrypoint ?? '').toLowerCase().endsWith(e)) ? agent.entrypoint : undefined)
  if (scriptRef) {
    const file = isAbsolute(scriptRef) ? scriptRef : join(dir, scriptRef)
    await activity(name, `spuštěn přes Mary (${basename(file)})`)
    const { code, output } = await runScriptFile(file, rest)
    await activity(name, `doběhl ${code === 0 ? 'OK' : `s chybou (${code})`}`)
    return { reply: `🤖 ${name} → ${basename(file)}\n\n${output || '(bez výstupu)'}${code ? `\n\n⚠ exit ${code}` : ''}`, steps }
  }

  // 2) příkaz v PowerShellu / cmd
  if (agent.shell?.command) {
    const kind = agent.shell.kind === 'cmd' ? 'cmd' : 'ps'
    const command = [agent.shell.command, ...rest].join(' ')
    const label = `🤖 ${name} → ${kind === 'ps' ? 'PS>' : '>'} ${command}`
    // skill Bezpečný shell platí i pro agenty
    const reply = await guarded(label, command, async () => {
      await activity(name, `spuštěn přes Mary (${kind})`)
      const { code, output } = await runShellOnce(kind, command)
      return `${label}\n\n${output || '(bez výstupu)'}${code ? `\n\n⚠ exit ${code}` : ''}`
    })
    return { reply, steps }
  }

  return {
    reply: `🤖 ${name} je prompt agent (bez skriptu). Skript mu přidáš v Builderu, nebo založ nového: /new agent <jméno> - <popis> | skript: plocha/x.py`,
    steps,
  }
}

// ---------- česká věta: .py soubor + agent ----------
const VERB = String.raw`(?:mary[,:]?\s+)?(?:pros[ií]m\s+)?(?:ud[eě]lej|vytvo[rř]|napi[sš]|naprogramuj|zalo[zž])`
const AGENT_CLAUSE = new RegExp(String.raw`^\s*${VERB}\s+(?:mi\s+)?(?:nov[eé]ho\s+)?agenta?\s+["„“']?([\p{L}\d_-]+)`, 'iu')
// pozor: \b za „vytvoř“ nefunguje (ř není ASCII písmeno) → (?=\s|$)
const PY_CLAUSE = new RegExp(String.raw`^\s*${VERB}(?=\s|$)[\s\S]*?([\p{L}\d_./\\-]+\.py)(?![\p{L}\d])`, 'iu')

export async function tryNaturalScriptIntent(text: string): Promise<CommandResult | null> {
  if (!/\.py\b/i.test(text) && !AGENT_CLAUSE.test(text)) return null
  // „… a vytvoř agenta …“ → dvě věty
  const clauses = text.split(/\s*(?:,|;|\.|->|→|\s)(?:\s*(?:a|pak|potom|a\s+pak|a\s+potom))?\s+(?=(?:mary[,:]?\s+)?(?:ud[eě]lej|vytvo[rř]|napi[sš]|naprogramuj|zalo[zž])(?=\s|$))/iu)

  const replies: string[] = []
  const steps: string[] = []
  let lastPy: string | null = null
  let handled = false

  // nejdřív .py, pak agenti — „vytvoř agenta X a udělej y.py“ má agenta napojit na y.py
  const ordered = [...clauses.filter((c) => !AGENT_CLAUSE.test(c)), ...clauses.filter((c) => AGENT_CLAUSE.test(c))]
  for (const clause of ordered) {
    const agentM = clause.match(AGENT_CLAUSE)
    if (agentM) {
      const pyInClause = clause.match(/([\p{L}\d_./\\-]+\.py)(?![\p{L}\d])/iu)?.[1]
      const script = pyInClause ? resolveUserPath(pyInClause) : lastPy
      const description = clause.replace(AGENT_CLAUSE, '').replace(/^[\s,:–—-]+/, '').trim() || (script ? `Spouští ${basename(script)}` : '')
      const spec = `${agentM[1]} - ${description}${script ? ` | skript: ${script}` : ''}`
      const r = await runNewCapability('agent', spec)
      replies.push(r.reply)
      steps.push(...r.steps)
      handled = true
      continue
    }
    const pyM = clause.match(PY_CLAUSE)
    if (pyM) {
      const file = resolveUserPath(pyM[1]) // bez cesty → plocha
      const r = await createPy(file, clause.trim(), false, [])
      replies.push(r.reply)
      steps.push(...r.steps)
      lastPy = file
      handled = true
    }
  }
  if (!handled) return null
  return { reply: replies.join('\n\n— — —\n\n'), steps }
}
