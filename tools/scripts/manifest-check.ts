// tools/scripts/manifest-check.ts
// Spustit: pnpm manifest:check
// Projde všechny manifest.json v data/capabilities/, zvaliduje Zodem,
// křížově zkontroluje s index.json a vypíše report.

import * as fs from 'fs/promises'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { CapabilityManifestSchema } from '../../packages/core/src/manifest/schema.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CAPABILITIES_DIR = resolve(__dirname, '../../data/capabilities')
const AGENTS_INDEX = resolve(__dirname, '../../data/capabilities/agents/index.json')

interface CheckResult {
  path: string
  status: 'ok' | 'error'
  error?: string
}

async function checkAllManifests(): Promise<void>
{
  const results: CheckResult[] = []

  // 1. Projdi všechny type složky
  const types = await fs.readdir(CAPABILITIES_DIR).catch(() => [])

  for (const type of types) {
    const typeDir = join(CAPABILITIES_DIR, type)
    const stat = await fs.stat(typeDir).catch(() => null)
    if (!stat?.isDirectory()) continue

    const ids = await fs.readdir(typeDir).catch(() => [])

    for (const id of ids) {
      if (id.startsWith('.') || id === 'index.json') continue

      const manifestPath = join(typeDir, id, 'manifest.json')

      try {
        const raw = await fs.readFile(manifestPath, 'utf-8')
        const json = JSON.parse(raw)

        // Doplň id a type z cesty (stejně jako loader.ts)
        const toValidate = {
          ...json,
          id: json.id ?? id,
          type: json.type ?? type,
          createdAt: json.createdAt ?? new Date().toISOString(),
          updatedAt: json.updatedAt ?? new Date().toISOString(),
        }

        CapabilityManifestSchema.parse(toValidate)
        results.push({ path: manifestPath, status: 'ok' })
      } catch (err) {
        results.push({
          path: manifestPath,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  // 2. Křížová kontrola agents/index.json vs složky
  console.log('\n━━━ MANIFEST CHECK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const ok = results.filter(r => r.status === 'ok')
  const errors = results.filter(r => r.status === 'error')

  for (const r of ok) {
    console.log(`  ✅ ${r.path.replace(CAPABILITIES_DIR, 'data/capabilities')}`)
  }
  for (const r of errors) {
    console.log(`  ❌ ${r.path.replace(CAPABILITIES_DIR, 'data/capabilities')}`)
    console.log(`     ${r.error}`)
  }

  // 3. Křížová kontrola index.json
  try {
    const raw = await fs.readFile(AGENTS_INDEX, 'utf-8')
    const idx = JSON.parse(raw)
    const indexIds: string[] = idx.agents?.map((a: { id: string }) => a.id) ?? []

    const agentsDir = join(CAPABILITIES_DIR, 'agents')
    const folderIds = (await fs.readdir(agentsDir).catch(() => []))
      .filter(f => !f.startsWith('.') && f !== 'index.json')

    console.log('\n━━━ KŘÍŽOVÁ KONTROLA index.json vs složky ━━━━━━━━━━━━━\n')

    for (const folderId of folderIds) {
      const inIndex = indexIds.includes(folderId)
      console.log(`  ${inIndex ? '✅' : '⚠️ CHYBÍ V INDEX'} ${folderId}`)
    }
    for (const indexId of indexIds) {
      const hasFolder = folderIds.includes(indexId)
      if (!hasFolder) {
        console.log(`  ❌ INDEX MÁ "${indexId}" ale složka neexistuje`)
      }
    }
  } catch (e) {
    console.log(`  ⚠️  Nelze načíst index.json: ${(e as Error).message}`)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Celkem: ${results.length} manifestů | ✅ ${ok.length} OK | ❌ ${errors.length} chyb`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (errors.length > 0) process.exit(1)
}

checkAllManifests()
