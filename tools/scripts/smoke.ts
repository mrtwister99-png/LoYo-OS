// tools/scripts/smoke.ts — rychlý test API a příkazů chatu
//   npx tsx tools/scripts/smoke.ts            → jen čtení (nic nemění)
//   npx tsx tools/scripts/smoke.ts --write    → navíc /add a /remove (CLI → poslední agent) a vrátí zpět
// API musí běžet (localhost:3001). Jiná adresa: LOYO_API=http://host:port
const API = process.env.LOYO_API || 'http://localhost:3001'
const WRITE = process.argv.includes('--write')

let ok = 0
let fail = 0
const check = (name: string, pass: boolean, detail = '') => {
  if (pass) { ok++; console.log(`  ✔ ${name}`) }
  else { fail++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`) }
}

async function get(path: string): Promise<{ status: number; json: any }> {
  const r = await fetch(API + path)
  return { status: r.status, json: await r.json().catch(() => null) }
}

// pošle zprávu do chatu (stejně jako Chat.tsx) a vrátí odpověď
async function say(message: string): Promise<string> {
  const r = await fetch(API + '/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const j: any = await r.json().catch(() => ({}))
  return String(j.reply ?? '')
}

async function main() {
  console.log(`LOYO smoke test • ${API} • ${WRITE ? 'ČTENÍ + ZÁPIS' : 'jen čtení'}\n`)

  console.log('API a čísla')
  let caps: any[] = []
  try {
    const r = await get('/api/capabilities')
    check('GET /api/capabilities', r.status === 200)
    caps = r.json?.capabilities ?? []
    check('capabilities nejsou prázdné', caps.length > 0, `počet ${caps.length}`)
  } catch {
    console.log('  ✘ API neodpovídá. Spusť: pnpm dev:api')
    process.exit(1)
  }
  const byType: Record<string, any[]> = {}
  for (const c of caps) (byType[c.type] = byType[c.type] || []).push(c)
  for (const [type, list] of Object.entries(byType)) {
    const nums = list.map(c => c.number)
    const allNum = nums.every(n => typeof n === 'number')
    check(`${type}: každá položka má číslo`, allNum)
    check(`${type}: čísla jsou unikátní`, new Set(nums).size === nums.length, `čísla: ${nums.join(', ')}`)
  }
  const mary = (byType['agent'] || []).find(a => a.id === 'mary-jane')
  check('mary-jane má číslo 1', mary?.number === 1, `má ${mary?.number}`)

  console.log('\nTrasy')
  const tmp = await get('/api/tmp?path=tmp/neexistuje.json')
  check('/api/tmp je dostupné (ne /api/api/tmp)', tmp.json?.requestedPath !== undefined, JSON.stringify(tmp.json)?.slice(0, 80))
  const mcp = await get('/api/mcp')
  check('GET /api/mcp', mcp.status === 200 && Array.isArray(mcp.json?.servers))
  const cli = await get('/api/cli')
  check('GET /api/cli', cli.status === 200 && Array.isArray(cli.json?.tools))
  if (cli.json?.tools?.length) check('CLI mají číslo', cli.json.tools.every((t: any) => typeof t.number === 'number'))

  console.log('\nPříkazy (jen čtení)')
  const help = await say('/help')
  check('/help', help.includes('Typy:'), help.slice(0, 60))
  const list4 = await say('/list 4')
  check('/list 4 (MCP)', /4-\d+/.test(list4) || list4.includes('Žádné'), list4.slice(0, 60))
  const edit = await say('/edit 4-1')
  check('/edit 4-1 otevře Builder', edit.startsWith('OPEN_BUILDER:mcp:') || edit.includes('nenalezen'), edit.slice(0, 60))
  const edit1 = await say('/edit 1-2')
  check('/edit 1-2 (agent 2)', edit1.startsWith('OPEN_BUILDER:agents:2:'), edit1.slice(0, 60))
  const bad = await say('/edit 99-1')
  check('/edit 99-1 hlásí neznámý typ', bad.includes('Neznámé číslo typu'), bad.slice(0, 60))

  if (WRITE) {
    console.log('\nZápis (/add a /remove, vrací se zpět)')
    const cliCap = (byType['cli'] || [])[0]
    const agents = (byType['agent'] || []).filter(a => typeof a.number === 'number').sort((a, b) => b.number - a.number)
    const agent = agents.find(a => !(a.tools || []).includes(`cli:${cliCap?.id}`))
    if (!cliCap || !agent) {
      console.log('  – přeskočeno (není CLI nebo volný agent)')
    } else {
      const ref = `5-${cliCap.number}`
      const p1 = await say(`/add ${ref}`)
      check(`/add ${ref} nabídne agenty`, p1.includes('PICKER:'), p1.slice(0, 60))
      const d1 = await say(String(agent.number))
      check(`přidáno k agentovi ${agent.id}`, d1.startsWith('Hotovo'), d1.slice(0, 80))
      const p2 = await say(`/remove ${ref}`)
      check(`/remove ${ref} nabídne agenta`, p2.includes('PICKER:') && p2.includes(agent.id), p2.slice(0, 80))
      const d2 = await say(String(agent.number))
      check('odebráno zpět', d2.startsWith('Hotovo'), d2.slice(0, 80))
    }
  }

  console.log(`\nVýsledek: ${ok} v pořádku, ${fail} chyb`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })