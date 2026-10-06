// D:\dev\loyo-os\apps\api\src\lib\ragStore.ts
// LOYO RAG – složka RAG/ + poznámky + reporty → Qdrant (ÚKOL 31 + 33)
// Bez dalších závislostí: Qdrant i Ollama se volají přes REST (fetch). Embedding: nomic-embed-text.
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { DATA_DIR, RAG_DIR, REPORTS_DIR, JA_POZNAMKY_DIR, AGENTS_DIR } from './dataPaths.js'

const QDRANT = (process.env.QDRANT_URL || 'http://localhost:6333').replace(/\/$/, '')
const OLLAMA = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '')
const COLLECTION = process.env.RAG_COLLECTION || 'loyo_rag'
const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'nomic-embed-text'
const ROOT_DIR = join(DATA_DIR, '..')
const STATE_FILE = join(DATA_DIR, 'cache', 'rag-index.json')

// co se indexuje: RAG/ (znalosti agentů, paměť), poznámky a reporty z research
const SOURCES = [
  { dir: RAG_DIR, source: 'rag' },
  { dir: JA_POZNAMKY_DIR, source: 'note' },
  { dir: REPORTS_DIR, source: 'report' },
]

type RagState = { files: Record<string, { hash: string; chunks: number }> }
export type RagHit = { score: number; path: string; source: string; title: string; text: string }

const sha = (s: string) => createHash('sha1').update(s).digest('hex')
// deterministické UUID z textu (Qdrant chce UUID nebo číslo)
function uuidFor(key: string): string {
  const h = sha(key)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}
const toRel = (abs: string) => relative(ROOT_DIR, abs).replace(/\\/g, '/')
async function exists(p: string): Promise<boolean> { try { await stat(p); return true } catch { return false } }

// ---------- REST: Qdrant a Ollama ----------
async function qd(path: string, method: string = 'GET', body?: unknown): Promise<any> {
  let res: Response
  try {
    res = await fetch(`${QDRANT}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error(`Qdrant neběží na ${QDRANT}. Spusť: docker run -d --name loyo-qdrant -p 6333:6333 -v <cesta>/data/qdrant:/qdrant/storage qdrant/qdrant`)
  }
  if (!res.ok) {
    const e: any = new Error(`Qdrant ${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

// kind: nomic-embed-text chce předponu podle toho, jestli jde o dokument nebo dotaz
async function embed(texts: string[], kind: 'doc' | 'query'): Promise<number[][]> {
  const prefix = kind === 'doc' ? 'search_document: ' : 'search_query: '
  let res: Response
  try {
    res = await fetch(`${OLLAMA}/api/embed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: EMBED_MODEL, input: texts.map(t => prefix + t) }) })
  } catch { throw new Error(`Ollama neběží na ${OLLAMA}.`) }
  if (!res.ok) throw new Error(`Embedding (${EMBED_MODEL}) selhal: ${res.status}. Spusť: ollama pull ${EMBED_MODEL}`)
  const data: any = await res.json()
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) throw new Error('Ollama vrátila neočekávaný počet vektorů')
  return data.embeddings
}

async function collectionExists(): Promise<boolean> {
  try { await qd(`/collections/${COLLECTION}`); return true } catch (e: any) { if (e.status === 404) return false; throw e }
}
async function ensureCollection(size: number) {
  if (await collectionExists()) return
  await qd(`/collections/${COLLECTION}`, 'PUT', { vectors: { size, distance: 'Cosine' } })
  for (const field_name of ['path', 'source']) {
    try { await qd(`/collections/${COLLECTION}/index`, 'PUT', { field_name, field_schema: 'keyword' }) } catch {}
  }
}
async function deleteByPath(rel: string) {
  try { await qd(`/collections/${COLLECTION}/points/delete?wait=true`, 'POST', { filter: { must: [{ key: 'path', match: { value: rel } }] } }) } catch {}
}

// ---------- stav indexu (co už je zaindexované) ----------
async function loadState(): Promise<RagState> {
  try { return JSON.parse(await readFile(STATE_FILE, 'utf-8')) as RagState } catch { return { files: {} } }
}
async function saveState(s: RagState) {
  await mkdir(join(DATA_DIR, 'cache'), { recursive: true })
  await writeFile(STATE_FILE, JSON.stringify(s, null, 2), 'utf-8')
}

// ---------- soubory a dělení na kousky ----------
async function walkMd(dir: string): Promise<string[]> {
  const out: string[] = []
  let entries: any[] = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walkMd(p))
    else if (e.name.toLowerCase().endsWith('.md')) out.push(p)
  }
  return out
}

// dělí podle nadpisů a odstavců (~900 znaků); nadpis se vrací do každého kousku pro kontext
function chunkMarkdown(text: string, maxLen = 900): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = []
  let heading = ''
  let buf = ''
  const flush = () => {
    const t = buf.trim()
    if (t.length > 20) out.push({ title: heading, text: heading ? `${heading}\n${t}` : t })
    buf = ''
  }
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const h = line.match(/^#{1,4}\s+(.+)$/)
    if (h) { flush(); heading = h[1].trim(); continue }
    buf += line + '\n'
    if (buf.length >= maxLen && (line.trim() === '' || buf.length >= maxLen * 1.5)) flush()
  }
  flush()
  return out
}

// ---------- ÚKOL 33: indexace ----------
export async function indexAll(opts: { reset?: boolean; log?: (s: string) => void } = {}) {
  const log = opts.log || (() => {})
  const t0 = Date.now()
  let state: RagState = opts.reset ? { files: {} } : await loadState()
  if (opts.reset) { try { await qd(`/collections/${COLLECTION}`, 'DELETE') } catch {} }
  // kolekce zmizela (např. smazaný Docker volume) → index od nuly
  if (!opts.reset && Object.keys(state.files).length && !(await collectionExists())) { state = { files: {} }; log('Kolekce v Qdrantu chybí, indexuji znovu vše.') }

  const files: { abs: string; rel: string; source: string }[] = []
  for (const s of SOURCES) for (const abs of await walkMd(s.dir)) files.push({ abs, rel: toRel(abs), source: s.source })
  const seen = new Set(files.map(f => f.rel))

  let removed = 0
  for (const rel of Object.keys(state.files)) {
    if (!seen.has(rel)) { await deleteByPath(rel); delete state.files[rel]; removed++; log(`- ${rel}`) }
  }

  const todo: { rel: string; source: string; hash: string; mtime: number; chunks: { title: string; text: string }[] }[] = []
  for (const f of files) {
    const text = await readFile(f.abs, 'utf-8')
    const hash = sha(text)
    if (state.files[f.rel]?.hash === hash) continue
    todo.push({ rel: f.rel, source: f.source, hash, mtime: (await stat(f.abs)).mtimeMs, chunks: chunkMarkdown(text) })
  }

  const all = todo.flatMap(t => t.chunks.map((c, i) => ({ t, c, i })))
  let upserted = 0
  if (all.length) {
    const vectors: number[][] = []
    for (let i = 0; i < all.length; i += 32) vectors.push(...await embed(all.slice(i, i + 32).map(x => x.c.text), 'doc'))
    await ensureCollection(vectors[0].length)
    for (const t of todo) if (state.files[t.rel]) await deleteByPath(t.rel)   // staré kousky změněných souborů pryč
    for (let i = 0; i < all.length; i += 128) {
      const points = all.slice(i, i + 128).map((x, k) => ({
        id: uuidFor(`${x.t.rel}#${x.i}`),
        vector: vectors[i + k],
        payload: { path: x.t.rel, source: x.t.source, title: x.c.title, chunk: x.i, text: x.c.text, mtime: x.t.mtime },
      }))
      await qd(`/collections/${COLLECTION}/points?wait=true`, 'PUT', { points })
      upserted += points.length
    }
  }
  for (const t of todo) { state.files[t.rel] = { hash: t.hash, chunks: t.chunks.length }; log(`+ ${t.rel} (${t.chunks.length})`) }
  await saveState(state)
  return { files: files.length, changed: todo.length, unchanged: files.length - todo.length, removed, chunks: upserted, ms: Date.now() - t0 }
}

// ---------- vyhledávání ----------
export async function ragSearch(query: string, limit = 5, source?: string): Promise<RagHit[]> {
  const [vector] = await embed([query], 'query')
  const body: any = { vector, limit, with_payload: true }
  if (source) body.filter = { must: [{ key: 'source', match: { value: source } }] }
  const r = await qd(`/collections/${COLLECTION}/points/search`, 'POST', body)
  return (r.result || []).map((p: any) => ({ score: p.score, path: p.payload?.path, source: p.payload?.source, title: p.payload?.title || '', text: p.payload?.text || '' }))
}

export async function ragStatus() {
  const state = await loadState()
  let points = 0
  let online = true
  try { points = (await qd(`/collections/${COLLECTION}`)).result?.points_count ?? 0 } catch (e: any) { if (e.status !== 404) online = false }
  return { online, collection: COLLECTION, points, files: Object.keys(state.files).length }
}

// ---------- ÚKOL 31: struktura RAG/ ----------
// RAG/agents/<číslo>-<id>/{agentRAG.md, 01_CORE_IDENTITY.rag.md}, dále prázdné složky teams, mcp, skills, loops
export async function initRagFolders(log: (s: string) => void = () => {}) {
  for (const t of ['agents', 'teams', 'mcp', 'skills', 'loops']) {
    const d = join(RAG_DIR, t)
    await mkdir(d, { recursive: true })
    if (t !== 'agents' && !(await exists(join(d, '.gitkeep')))) await writeFile(join(d, '.gitkeep'), '', 'utf-8')   // ať git složku udrží
  }
  const base = join(RAG_DIR, 'agents')
  let created = 0
  let ids: string[] = []
  try { ids = await readdir(AGENTS_DIR) } catch {}
  for (const id of ids) {
    let mf: any
    try { mf = JSON.parse(await readFile(join(AGENTS_DIR, id, 'manifest.json'), 'utf-8')) } catch { continue }
    const existing = (await readdir(base)).find(d => d === id || new RegExp(`^\\d+-${id}$`).test(d))
    const dir = join(base, existing ?? (mf.number != null ? `${mf.number}-${id}` : id))
    await mkdir(dir, { recursive: true })
    const rag = join(dir, 'agentRAG.md')
    if (!(await exists(rag))) {
      await writeFile(rag, `# RAG – ${mf.displayName || id}\n<!-- Znalosti, postupy a odkazy aktuální podle internetu (ÚKOL 32). Indexuje se přes pnpm rag:index. -->\n\n## Znalosti\n\n## Postupy\n\n## Zdroje\n`, 'utf-8')
      created++; log(`+ ${toRel(rag)}`)
    }
    const idf = join(dir, '01_CORE_IDENTITY.rag.md')
    if (!(await exists(idf))) {
      let core = ''
      try { core = await readFile(join(AGENTS_DIR, id, '01_CORE_IDENTITY.md'), 'utf-8') } catch {}
      await writeFile(idf, `<!-- RAG verze identity: začíná jako kopie 01_CORE_IDENTITY.md, upraví se podle research (ÚKOL 32) -->\n\n${core}`, 'utf-8')
      created++; log(`+ ${toRel(idf)}`)
    }
  }
  return { created }
}