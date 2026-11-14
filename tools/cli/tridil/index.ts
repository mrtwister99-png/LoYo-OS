// D:\dev\loyo-os\tools\cli\tridil\index.ts
// LOYO OS // CLI:TRIDIL — ruční / Task Scheduler běh třídění Stažených souborů
// pnpm cli:tridil [--dry-run] [--all] [--dir <cesta>] [--since <ISO datum>]
import { runTridil } from '../../../apps/api/src/services/tridil.ts'

const args = process.argv.slice(2)
function getArg(name: string): string | undefined
{
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
}

async function main()
{
  if (args.includes('--help') || args.includes('-h'))
  {
    console.log('Použití: pnpm cli:tridil [--dry-run] [--all] [--dir <cesta>] [--since <ISO datum>]')
    return
  }
  const since = getArg('--since')
  const { result, message } = await runTridil({
    dir: getArg('--dir'),
    all: args.includes('--all'),
    dryRun: args.includes('--dry-run'),
    since: since ? new Date(since) : undefined,
  })
  console.log(message)
  for (const m of result.moved) console.log(`  ${m.file} → ${m.target}`)
  for (const s of result.skipped) console.log(`  [skip] ${s.file} — ${s.reason}`)
  for (const e of result.errors) console.log(`  [chyba] ${e.file} — ${e.error}`)
  if (result.errors.length) process.exitCode = 1
}

main().catch(err =>
{
  console.error('[cli:tridil]', err)
  process.exit(1)
})
