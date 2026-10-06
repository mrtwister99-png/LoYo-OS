// tools/scripts/numberize.ts — ÚKOL 21 — FINAL s pevnými čísly dle zadání
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const ROOT_CAPS = join(process.cwd(), 'data', 'capabilities')
const ROOT_MCP = join(process.cwd(), 'data', 'mcp')

// pevná čísla dle zadání ÚKOL 21
const AGENT_NUMBERS: Record<string, number> = {
  'mary-jane': 1,
  'lubor-nehleda': 2,
  'julia-nehledalova': 3,
  'kosterad-fuckstein': 4,
}
const MCP_NUMBERS: Record<string, number> = {}   // MCP se číslují od 1 podle pořadí (žádné pevné 22)

// index.json má u každého typu jiný tvar (agents/teams/items...) - tvar se NEMĚNÍ, opravuje se jen number
const INDEX_KEYS = ['items', 'agents', 'teams', 'tools', 'skills', 'loops', 'workflows']
// --reset = přečísluje všechno znovu podle pořadí (pevná čísla agentů 1-4 zůstanou)
const RESET = process.argv.includes('--reset')

async function processFolder(base: string, startNum: number, fixedMap?: Record<string, number>) {
  if (!existsSync(base)) return []
  const dirs = (await readdir(base).catch(() => [] as string[])).sort()
  const entries: { dir: string; path: string; mf: any; fixed: boolean }[] = []
  for (const d of dirs) {
    const mfPath = join(base, d, 'manifest.json')
    if (!existsSync(mfPath)) continue
    try { entries.push({ dir: d, path: mfPath, mf: JSON.parse(await readFile(mfPath, 'utf-8')), fixed: false }) } catch {}
  }
  // pořadí = podle data vytvoření, při shodě podle názvu složky (stejně jako loader v API)
  entries.sort((a, b) => {
    const da = new Date(a.mf.createdAt || a.mf.created || 0).getTime()
    const db = new Date(b.mf.createdAt || b.mf.created || 0).getTime()
    return da !== db ? da - db : a.dir.localeCompare(b.dir)
  })
  // 1) pevná čísla dle zadání  2) už platná číselná čísla (ne při --reset)  3) zbytek po řadě od startNum (bez duplicit)
  const used = new Set<number>()
  for (const e of entries) {
    const wanted = fixedMap?.[e.dir] ?? fixedMap?.[e.mf.id]
    if (wanted != null) { e.mf.number = wanted; e.fixed = true; used.add(wanted) }
  }
  for (const e of entries) {
    if (e.fixed) continue
    const n = e.mf.number
    if (!RESET && typeof n === 'number' && !used.has(n)) used.add(n)
    else delete e.mf.number
  }
  let next = startNum
  for (const e of entries) {
    if (typeof e.mf.number === 'number') continue
    while (used.has(next)) next++
    e.mf.number = next
    used.add(next)
  }
  for (const e of entries) {
    await writeFile(e.path, JSON.stringify(e.mf, null, 2), 'utf-8')
    console.log(`#${e.mf.number} -> ${base.replace(process.cwd(), '')}/${e.dir}`)
  }
  // index.json: jen oprava number u existujících záznamů
  const indexPath = join(base, 'index.json')
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(await readFile(indexPath, 'utf-8'))
      const key = INDEX_KEYS.find(k => Array.isArray(idx?.[k]))
      if (key) {
        for (const it of idx[key]) {
          const e = entries.find(x => x.mf.id === it.id || x.dir === it.id || x.dir === it.folder)
          if (e) it.number = e.mf.number
        }
        await writeFile(indexPath, JSON.stringify(idx, null, 2), 'utf-8')
        console.log(`✔ index.json ${base}: number opraveno u ${idx[key].length} záznamů`)
      }
    } catch (err) { console.warn(`⚠️  index.json ${base}: ${(err as Error).message}`) }
  }
  return entries.map(e => ({ id: e.mf.id || e.dir, number: e.mf.number }))
}

async function run() {
  await processFolder(join(ROOT_CAPS, 'agents'), 1, AGENT_NUMBERS)
  // MCP hledej ve dvou místech
  let mcpItems = await processFolder(join(ROOT_CAPS, 'mcp'), 1, MCP_NUMBERS)
  if (mcpItems.length === 0 && existsSync(ROOT_MCP)) {
    console.log(`MCP v capabilities prázdné, zkouším ${ROOT_MCP}`)
    await processFolder(ROOT_MCP, 1, MCP_NUMBERS)
    // zkopíruj index i do capabilities/mcp pro orchestrator
    if (existsSync(join(ROOT_MCP, 'index.json'))) {
      const raw = await readFile(join(ROOT_MCP, 'index.json'), 'utf-8')
      await writeFile(join(ROOT_CAPS, 'mcp', 'index.json'), raw, 'utf-8').catch(async () => {
        const { mkdir } = await import('node:fs/promises')
        await mkdir(join(ROOT_CAPS, 'mcp'), { recursive: true })
        await writeFile(join(ROOT_CAPS, 'mcp', 'index.json'), raw, 'utf-8')
      })
    }
  }
  await processFolder(join(ROOT_CAPS, 'cli'), 1)
  await processFolder(join(ROOT_CAPS, 'skills'), 1)
  await processFolder(join(ROOT_CAPS, 'teams'), 1)
  await processFolder(join(ROOT_CAPS, 'loops'), 1)
  await processFolder(join(ROOT_CAPS, 'workflows'), 1)
}
run()