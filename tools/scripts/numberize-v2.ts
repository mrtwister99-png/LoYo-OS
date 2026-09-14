// tools/scripts/numberize-v2.ts — NOVÉ LOGICKÉ ČÍSLOVÁNÍ 1_01, 2_01...
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const ROOT = process.cwd()
const CAPS = join(ROOT, 'data', 'capabilities')

// tvoje logika
const TYPE_PREFIX: Record<string, number> = {
  agents: 1,
  mcp: 2,
  skills: 3,
  cli: 4,
  api: 5,
  loops: 6,
  teams: 7,
  workflows: 8,
  rag: 9,
}

function formatNumber(type: string, seq: number){
  const prefix = TYPE_PREFIX[type]
  return `${prefix}_${String(seq).padStart(2,'0')}`
}
function extractSeq(num: any){
  const s = String(num||0)
  if(s.includes('_')) return parseInt(s.split('_')[1])||0
  return parseInt(s)||0
}

async function processType(type: string){
  const base = join(CAPS, type)
  if (!existsSync(base)) { console.log(`skip ${type}`); return }
  const dirs = await readdir(base).catch(()=>[] as string[])
  const items: any[] = []
  for (const d of dirs){
    if (d.includes('.json')) continue
    const mfPath = join(base, d, 'manifest.json')
    if (!existsSync(mfPath)) continue
    try{
      const mf = JSON.parse(await readFile(mfPath,'utf-8'))
      items.push({dir:d, mf, path: mfPath, oldSeq: extractSeq(mf.number), oldNum: mf.number})
    }catch{}
  }
  // seřaď podle starého čísla aby zůstalo pořadí
  items.sort((a,b)=> a.oldSeq - b.oldSeq || a.dir.localeCompare(b.dir))

  let seq=1
  for (const it of items){
    const newNum = formatNumber(type, seq)
    console.log(`${type.padEnd(10)} ${String(it.oldNum).padEnd(8)} → ${newNum} ${it.dir}`)
    it.mf.number = newNum
    await writeFile(it.path, JSON.stringify(it.mf, null, 2), 'utf-8')
    seq++
  }
  const indexItems = items.map(i=>({ id: i.mf.id || i.dir, number: i.mf.number, displayName: i.mf.displayName || i.dir, folder: i.dir }))
  await writeFile(join(base,'index.json'), JSON.stringify({ items: indexItems }, null, 2), 'utf-8')
  console.log(`✔ ${type} index.json → ${indexItems.length}\n`)
}

async function run(){
  // pořadí podle prefixu
  const order = Object.entries(TYPE_PREFIX).sort((a,b)=>a[1]-b[1]).map(x=>x[0])
  for (const type of order) await processType(type)
}
run()