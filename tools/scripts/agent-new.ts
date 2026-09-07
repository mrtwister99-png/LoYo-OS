// tools/scripts/agent-new.ts
// Použití: pnpm agent:new --id kosterad-fuckstein --displayName "Koštěrad Fuckstein" --type agent
// Vygeneruje složku + všechny soubory ze šablony, zapíše do index.json

import * as fs from 'fs/promises'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CAPABILITIES_DIR = resolve(__dirname, '../../data/capabilities')
const TEMPLATE_DIR = resolve(__dirname, '../../packages/core/templates/agent')
const AGENTS_INDEX = join(CAPABILITIES_DIR, 'agents', 'index.json')

// Parsování CLI argumentů
function parseArgs(): Record<string, string>
{
  const args = process.argv.slice(2)
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '')
    const val = args[i + 1]
    if (key && val) result[key] = val
  }
  return result
}

async function main(): Promise<void>
{
  const args = parseArgs()

  const id             = args['id']
  const displayName    = args['displayName'] ?? args['name']
  const type           = args['type']           ?? 'agent'
  const model          = args['model']          ?? 'qwen2.5-coder:3b'
  const runtime        = args['runtime']        ?? 'prompt'
  const specialization = args['specialization'] ?? ''

  if (!id || !displayName) {
    console.error('❌ Použití: pnpm agent:new --id [kebab-id] --displayName "[Jméno]" --type [agent|mcp|cli|...] [--model qwen3:8b] [--runtime prompt|ollama|mcp|cli] [--specialization "coding,review"]')
    process.exit(1)
  }

  // Validace kebab-case
  if (!/^[a-z0-9-]+$/.test(id)) {
    console.error(`❌ id musí být kebab-case (malá písmena, čísla, pomlčky). Dostali jsme: "${id}"`)
    process.exit(1)
  }

  // Validace --runtime
  const VALID_RUNTIMES = ['prompt', 'ollama', 'mcp', 'cli']
  if (!VALID_RUNTIMES.includes(runtime)) {
    console.error(`❌ Neznámý runtime: "${runtime}". Povolené: ${VALID_RUNTIMES.join(', ')}`)
    process.exit(1)
  }

  // mapping type → skutečný název složky v capabilities/
  const TYPE_DIR_MAP: Record<string, string> = {
    agent: 'agents',
    mcp: 'mcp',
    cli: 'cli',
    loop: 'loops',
    workflow: 'workflows',
    skill: 'skills',
    team: 'teams',
  }
  const typeDir = TYPE_DIR_MAP[type]
  if (!typeDir) {
    console.error(`❌ Neznámý typ: "${type}". Povolené: ${Object.keys(TYPE_DIR_MAP).join(', ')}`)
    process.exit(1)
  }
  const targetDir = join(CAPABILITIES_DIR, typeDir, id)

  // Kontrola existence
  const exists = await fs.stat(targetDir).catch(() => null)
  if (exists) {
    console.error(`❌ Složka již existuje: ${targetDir}`)
    process.exit(1)
  }

  await fs.mkdir(targetDir, { recursive: true })

  const now = new Date().toISOString()

  // manifest.json ze šablony
  const tmpl = await fs.readFile(join(TEMPLATE_DIR, 'manifest.json.tmpl'), 'utf-8')
  const specializationArr = specialization
    ? JSON.stringify(specialization.split(',').map((s: string) => s.trim()).filter(Boolean))
    : '[]'

  const manifest = tmpl
    .replace(/\{\{id\}\}/g, id)
    .replace(/\{\{type\}\}/g, type)
    .replace(/\{\{displayName\}\}/g, displayName)
    .replace(/\{\{description\}\}/g, `${displayName} — popis doplň ručně`)
    .replace(/\{\{runtime\}\}/g, runtime)
    .replace(/\{\{model\}\}/g, model)
    .replace(/\{\{specialization\}\}/g, specializationArr)
    .replace(/\{\{systemPrompt\}\}/g, `Jsi ${displayName}.`)
    .replace(/\{\{createdAt\}\}/g, now)
    .replace(/\{\{updatedAt\}\}/g, now)

  await fs.writeFile(join(targetDir, 'manifest.json'), manifest, 'utf-8')

  // MD soubory
  await fs.writeFile(join(targetDir, '01_CORE_IDENTITY.md'), `# 01_CORE_IDENTITY.md: Kdo jsi\n\n## Základní identita\n- **Jméno:** ${displayName}\n- **Role:** doplň\n`, 'utf-8')
  await fs.writeFile(join(targetDir, '02_WORKFLOW.md'), `# 02_WORKFLOW.md: Jak pracuješ\n\n## Proces\n\n### Krok 1:\n- doplň\n`, 'utf-8')
  await fs.writeFile(join(targetDir, '03_GUARDRAILS.md'), `# 03_GUARDRAILS.md: Železná pravidla\n\n## Zákon č. 1:\n- doplň\n`, 'utf-8')

  // Prázdné JSON soubory
  await fs.writeFile(join(targetDir, 'memory.json'), '[]', 'utf-8')
  await fs.writeFile(join(targetDir, 'audit.json'), '[]', 'utf-8')

  console.log(`✅ ${displayName} vytvořen → ${targetDir}`)

  // Zápis do index.json — pro každý typ do jeho vlastního indexu
  const INDEX_MAP: Record<string, { file: string; key: string }> = {
    agent:    { file: join(CAPABILITIES_DIR, 'agents', 'index.json'),    key: 'agents' },
    mcp:      { file: join(CAPABILITIES_DIR, 'mcp', 'index.json'),       key: 'tools' },
    cli:      { file: join(CAPABILITIES_DIR, 'cli', 'index.json'),       key: 'tools' },
    loop:     { file: join(CAPABILITIES_DIR, 'loops', 'index.json'),     key: 'loops' },
    workflow: { file: join(CAPABILITIES_DIR, 'workflows', 'index.json'), key: 'workflows' },
    skill:    { file: join(CAPABILITIES_DIR, 'skills', 'index.json'),    key: 'skills' },
    team:     { file: join(CAPABILITIES_DIR, 'teams', 'index.json'),     key: 'teams' },
  }

  const indexDef = INDEX_MAP[type]
  if (indexDef) {
    try {
      const raw = await fs.readFile(indexDef.file, 'utf-8').catch(() => JSON.stringify({ version: '2.0', lastSync: now, [indexDef.key]: [] }))
      const idx = JSON.parse(raw)
      if (!Array.isArray(idx[indexDef.key])) idx[indexDef.key] = []

      // agent má bohatší záznam, ostatní typy minimální
      const entry = type === 'agent'
        ? {
            id, folder: id, name: displayName, role: 'doplň',
            category: 'general', team: 'LOYO OS v2', status: 'online',
            skills: [], tools: [], workflow: 'prompt',
            prompt_file: '01_CORE_IDENTITY.md',
            docs: ['01_CORE_IDENTITY.md', '02_WORKFLOW.md', '03_GUARDRAILS.md'],
            tasksToday: 0, created: now, lastRun: null,
          }
        : { id, name: displayName, status: 'active', created: now }

      idx[indexDef.key].push(entry)
      idx.lastSync = now
      await fs.writeFile(indexDef.file, JSON.stringify(idx, null, 2), 'utf-8')
      console.log(`✅ Zapsán do ${indexDef.file}`)
    } catch (e) {
      console.warn(`⚠️  Nepodařilo se zapsat do index.json: ${(e as Error).message}`)
    }
  }

  // duplicitní blok odstraněn — INDEX_MAP výše pokrývá všechny typy včetně agent
}

main()
