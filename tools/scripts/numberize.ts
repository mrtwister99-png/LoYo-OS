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
const MCP_NUMBERS: Record<string, number> = {
  'filesystem': 22,
  'fs': 22,
}

async function processFolder(base: string, startNum: number, fixedMap?: Record<string, number>) {
  if (!existsSync(base)) return []
  const dirs = await readdir(base).catch(() => [] as string[])
  for (const d of dirs) {
    const mfPath = join(base, d, 'manifest.json')
    if (!existsSync(mfPath)) continue
    try {
      const mf = JSON.parse(await readFile(mfPath, 'utf-8'))
      const wanted = fixedMap?.[d]?? fixedMap?.[mf.id]?? null
      if (wanted!= null) mf.number = wanted
      else if (mf.number == null) mf.number = startNum++
      else startNum = Math.max(startNum, mf.number + 1)
      await writeFile(mfPath, JSON.stringify(mf, null, 2), 'utf-8')
      console.log(`#${mf.number} -> ${base.replace(process.cwd(),'')}/${d}`)
    } catch {}
  }
  const items: any[] = []
  for (const d of dirs) {
    const mfPath = join(base, d, 'manifest.json')
    if (!existsSync(mfPath)) continue
    try {
      const mf = JSON.parse(await readFile(mfPath, 'utf-8'))
      items.push({ id: mf.id || d, number: mf.number, displayName: mf.displayName || mf.name || d, folder: d })
    } catch {}
  }
  items.sort((a, b) => (a.number || 0) - (b.number || 0))
  await writeFile(join(base, 'index.json'), JSON.stringify({ items }, null, 2), 'utf-8')
  console.log(`✔ index.json ${base}: ${items.length} položek`)
  return items
}

async function run() {
  await processFolder(join(ROOT_CAPS, 'agents'), 1, AGENT_NUMBERS)
  // MCP hledej ve dvou místech
  let mcpItems = await processFolder(join(ROOT_CAPS, 'mcp'), 22, MCP_NUMBERS)
  if (mcpItems.length === 0 && existsSync(ROOT_MCP)) {
    console.log(`MCP v capabilities prázdné, zkouším ${ROOT_MCP}`)
    await processFolder(ROOT_MCP, 22, MCP_NUMBERS)
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
  await processFolder(join(ROOT_CAPS, 'cli'), 30)
  await processFolder(join(ROOT_CAPS, 'skills'), 5, { 'lead-generation': 5 })
}
run()