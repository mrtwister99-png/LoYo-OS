// D:\dev\loyo-os\tools\scripts\rag.ts
// pnpm rag:init | rag:index [--reset] | rag:search <dotaz> | rag:status
import { initRagFolders, indexAll, ragSearch, ragStatus } from '../../apps/api/src/lib/ragStore.js'

const [cmd, ...rest] = process.argv.slice(2).filter(a => a !== '--')
const log = (s: string) => console.log(s)

async function main() {
  if (cmd === 'init') {
    const r = await initRagFolders(log)
    console.log(`✓ RAG/ připraveno (${r.created} nových souborů)`)
  } else if (cmd === 'index') {
    const r = await indexAll({ reset: rest.includes('--reset'), log })
    console.log(`✓ ${r.files} souborů (${r.changed} změněných, ${r.unchanged} beze změny, ${r.removed} smazaných), ${r.chunks} kousků za ${(r.ms / 1000).toFixed(1)} s`)
  } else if (cmd === 'search') {
    const q = rest.filter(a => !a.startsWith('--')).join(' ')
    if (!q) { console.log('Použití: pnpm rag:search <dotaz>'); return }
    const hits = await ragSearch(q, 5)
    if (!hits.length) console.log('Nic nenalezeno.')
    for (const h of hits) console.log(`[${h.score.toFixed(2)}] ${h.path}${h.title ? ' — ' + h.title : ''}\n    ${h.text.slice(0, 160).replace(/\n/g, ' ')}…`)
  } else if (cmd === 'status') {
    const s = await ragStatus()
    console.log(`Qdrant: ${s.online ? 'online' : 'NEDOSTUPNÝ'} • kolekce ${s.collection}: ${s.points} bodů • ${s.files} souborů v indexu`)
  } else {
    console.log('Použití: pnpm rag:init | rag:index [--reset] | rag:search <dotaz> | rag:status')
  }
}
main().catch(e => { console.error('✗', e.message); process.exit(1) })