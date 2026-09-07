// D:\dev\loyo-os\tools\cli\firmy\index.ts
// LOYO OS // CLI:FIRMY — tenký klient nad API, ukládá leady do data/leads/
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '../../..')

const args = process.argv.slice(2)
function getArg(name: string): string | undefined
function getArg(name: string, fallback: string): string
function getArg(name: string, fallback?: string): string | undefined {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const subcommand = args[0] ?? 'search'
const obor = getArg('--obor', 'autodilny')
const mesto = getArg('--mesto', 'Praha')
const limit = parseInt(getArg('--limit', '20'), 10)
const bezWebu = args.includes('--bez-webu')
const apiBase = getArg('--api', 'http://localhost:3001')

interface RawFirma { ico: string; name: string; address: string; category: string; hasWebsite: boolean; website: string | null; phone: string | null; email: string | null }
interface FirmaLead { nazev_firmy: string; hlavni_cinnost: string; webova_stranka: 'je' | 'neni'; tel_cislo: string; email: string; ico: string; adresa: string }

async function main() {
  if (subcommand !== 'search') {
    console.log('Použití: pnpm cli:firmy search --obor autodilny --mesto Praha [--bez-webu] [--limit 20]')
    return
  }

  console.log(`\n🔍 cli:firmy search | obor: ${obor} | město: ${mesto} | limit: ${limit}${bezWebu ? ' | filtr: BEZ WEBU' : ''}`)

  const res = await fetch(`${apiBase}/api/finder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: obor, city: mesto, limit }),
  })
  if (!res.ok) throw new Error(`API chyba: ${res.status} — běží server na ${apiBase}?`)
  const api = (await res.json()) as { found: number; withoutWeb: number; data: RawFirma[] }

  let leads: FirmaLead[] = api.data.map(raw => ({
    nazev_firmy: raw.name,
    hlavni_cinnost: raw.category || obor,
    webova_stranka: raw.hasWebsite ? 'je' : 'neni',
    tel_cislo: raw.phone ?? 'neni',
    email: raw.email ?? 'neni',
    ico: raw.ico,
    adresa: raw.address,
  }))

  if (bezWebu) leads = leads.filter(f => f.webova_stranka === 'neni')

  const leadsDir = join(ROOT, 'data', 'leads')
  mkdirSync(leadsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const safe = (s: string) => s.trim().replace(/\s+/g, '-')
  const file = join(leadsDir, `${safe(obor)}_${safe(mesto)}_${stamp}.json`)
  writeFileSync(file, JSON.stringify(leads, null, 2), 'utf-8')

  await fetch(`${apiBase}/api/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'Lubor_Nehleda',
      type: 'cli',
      action: `cli:firmy "${obor}" ${mesto} → ${leads.length} leadů → ${file}`,
      meta: { file, count: leads.length, bezWebu },
    }),
  }).catch(() => {})

  console.log(`✅ Nalezeno: ${api.found} | bez webu: ${api.withoutWeb} | uloženo leadů: ${leads.length}`)
  console.log(`📁 ${file}\n`)
  console.log(JSON.stringify({ status: 'success', file, count: leads.length }))
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})