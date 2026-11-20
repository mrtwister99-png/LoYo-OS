// D:\dev\loyo-os\apps\api\src\services\lootChecker.ts
// LOYO OS // LOOT CHECKER — KROK 1 duplicity (BEZ modelu) + FÁZE 2 vision třídění přes Ollama (jen přesun, nikdy mazání)
// Vzor: apps/api/src/services/tridil.ts — stejné helpery freeTarget / moveNoOverwrite, stejná konvence DATA_DIR

import { readFile, writeFile, readdir, rename, mkdir, access, copyFile, unlink, stat } from 'node:fs/promises'
import { join, extname, basename, resolve } from 'node:path'
import { homedir } from 'node:os'
import { DATA_DIR, AGENTS_DIR } from '../lib/dataPaths.js'

const AGENT_DIR = join(AGENTS_DIR, 'loot-checker')
const CONFIG_FILE = join(AGENT_DIR, 'config.json')
const STATE_FILE = join(AGENT_DIR, 'state.json')
// KONVENCE v3: žádný D:/ hardcode — koš je vždy join(DATA_DIR, 'kos')
const KOS_DIR = join(DATA_DIR, 'kos')
const REPORTS_DIR = join(DATA_DIR, 'reports')

export interface LootTargetFolder {
  name: string
  path?: string // prázdné = dir / name (pro FÁZI 2)
  description: string // legacy — staré configy, drží se pro zpětnou kompatibilitu
  belongs?: string // UI: PATŘÍ — co tam patří (jde do promptu)
  notBelongs?: string // UI: NEPATŘÍ — co tam nepatří (jde do promptu)
}

export interface LootCheckerConfig {
  dir: string
  fallbackFolder: string
  targetFolders: LootTargetFolder[]
  skipExtensions: string[]
  skipPrefixes: string[]
  // FÁZE 2 — vision třídění
  visionModel: string // např. "moondream" — musí být stažený: ollama pull moondream
  confidenceThreshold: number // 0-100, pod touto hodnotou se soubor nepřesouvá (když belowThreshold = 'leave')
  belowThreshold: 'leave' | 'ostatni' // co s obrázkem pod prahem: 'leave' = nechat na místě, 'ostatni' = přesunout do fallbackFolder
}

export interface LootCheckerOptions {
  dir?: string
  dryRun?: boolean
  saveState?: boolean
  onProgress?: (done: number, total: number, current: string) => void
}

export interface LootMove { file: string; from: string; to: string; original: string }
export interface LootCheckerResult {
  dir: string
  kosDir: string
  dryRun: boolean
  kept: number
  moved: LootMove[]
  skipped: { file: string; reason: string }[]
  errors: { file: string; error: string }[]
  txtPath: string | null
  reportPath: string | null
}

const DEFAULT_CONFIG: LootCheckerConfig = {
  dir: 'D:\\loot\\nesetrideno',
  fallbackFolder: 'ostatni',
  targetFolders: [],
  skipExtensions: ['crdownload', 'part', 'tmp', 'download', 'partial'],
  skipPrefixes: ['~$'],
  visionModel: 'moondream',
  confidenceThreshold: 60,
  belowThreshold: 'leave',
}

// ULOZIT SLOZKY = vzdy zapis na disk do config.json, zustane i po restartu.
// Nove zipy (od V4.4) config.json NEOBSAHUJI - jen config.example.json - takze rozbaleni nove verze uz nikdy neprepise uzivatelovy slozky.
// Jako druha vrstva si UI drzi zalohu i v localStorage prohlizece a pri prazdnem configu ji obnovi.
export async function saveLootCheckerConfig(cfg: LootCheckerConfig): Promise<void> {
  await mkdir(AGENT_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf-8')
}

export function resolveLootCheckerDir(dir: string): string {
  const home = process.env.USERPROFILE || homedir()
  return resolve(dir.replace(/%USERPROFILE%/gi, home).replace(/^~(?=[\\/]|$)/, home))
}

export async function loadLootCheckerConfig(): Promise<LootCheckerConfig> {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(await readFile(CONFIG_FILE, 'utf-8')) }
  } catch {
    return DEFAULT_CONFIG
  }
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

// „foto.jpg" → „foto (1).jpg", „foto (2).jpg" … dokud není volné jméno — stejné jako u Třídila
async function freeTarget(folderPath: string, fileName: string): Promise<string> {
  let candidate = join(folderPath, fileName)
  if (!(await exists(candidate))) return candidate
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  for (let i = 1; ; i++) {
    candidate = join(folderPath, `${stem} (${i})${ext}`)
    if (!(await exists(candidate))) return candidate
  }
}

// přesun bez přepsání; přes disky (EXDEV) copy + unlink zdroje až po úspěšné kopii — stejné jako u Třídila
async function moveNoOverwrite(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest)
  } catch (err: any) {
    if (err?.code !== 'EXDEV') throw err
    await copyFile(src, dest, 1 /* COPYFILE_EXCL */)
    await unlink(src)
  }
}

// --- Parse názvu — REKURZIVNĚ, protože Windows / kopírování skládá suffixy za sebe ---
// Příklady z reálné složky (viz screenshot dablkopiebohuzel):
//   "4d92... 1e66.png"                        -> base="4d92... 1e66", num=0 (originál)
//   "4d92... 1e66 (1) - kopie.png"            -> base="4d92... 1e66", num=1
//   "25ce... 3610 (2) - kopie.png"            -> base="25ce... 3610", num=2
//   "25ce... 3610 (1) (1) - kopie.png"        -> base="25ce... 3610", num=1 (odloupne kopie, pak (1), pak (1))
//   "mec - kopie.png" / "mec - kopie (1).png" -> base="mec", num=1
// Starý parser bral jen JEDEN suffix, takže "xxx (1) - kopie" měl base="xxx (1)"
// a nikdy se neseskupil s originálem "xxx" — proto po přesunu duplicity pořád zůstávaly.
// Nový parser odloupává suffixy v cyklu, dokud to jde.
export function parseDuplicateName(stem: string): { base: string; num: number } {
  let cur = stem.trim()
  let num = 0
  let changed = true
  while (changed) {
    changed = false
    let m = cur.match(/^(.*?)\s*-\s*kopie(?:\s*\((\d+)\))?\s*$/i)
    if (m) { cur = m[1].trim(); num = Math.max(num, m[2] ? parseInt(m[2], 10) : 1); changed = true; continue }
    m = cur.match(/^(.*?)\s*-\s*copy(?:\s*\((\d+)\))?\s*$/i)
    if (m) { cur = m[1].trim(); num = Math.max(num, m[2] ? parseInt(m[2], 10) : 1); changed = true; continue }
    m = cur.match(/^(.*?)\s*\((\d+)\)\s*$/)
    if (m) { cur = m[1].trim(); num = Math.max(num, parseInt(m[2], 10)); changed = true; continue }
  }
  return { base: cur, num }
}

// --- Cílové složky: když chybí, dovytvoř je ---
// Volá se (1) při uložení configu v UI, (2) při každém běhu před tříděním.
// Bez toho by FÁZE 2 selhala, když uživatel zadá složku, co ještě neexistuje.
// path: prázdné = dir / name, jinak ber path jak je (absolutní nebo relativní k dir).
export function resolveTargetFolderPath(dir: string, t: LootTargetFolder): string {
  const base = resolveLootCheckerDir(dir)
  if (t.path && t.path.trim()) {
    const p = t.path.trim()
    // absolutní (C:\..., D:\..., \\server) -> ber jak je, relativní -> pod dir
    if (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\')) return resolve(p)
    return resolve(base, p)
  }
  return join(base, t.name)
}

export async function ensureTargetFolders(cfg: LootCheckerConfig): Promise<{ created: string[]; errors: { folder: string; error: string }[] }> {
  const created: string[] = []
  const errors: { folder: string; error: string }[] = []
  for (const t of cfg.targetFolders || []) {
    if (!t.name) continue
    try {
      const p = resolveTargetFolderPath(cfg.dir, t)
      const already = await exists(p)
      await mkdir(p, { recursive: true })
      if (!already) created.push(p)
    } catch (err: any) {
      errors.push({ folder: t.name, error: err?.message ?? String(err) })
    }
  }
  return { created, errors }
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.avif', '.tiff', '.tif'])

// Rekurzivní výpis — na rozdíl od Třídila (jen kořen), loot bývá v podsložkách
async function walkRecursive(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walkRecursive(p, out)
    else if (e.isFile()) out.push(p)
  }
  return out
}

export async function findDuplicates(dir: string, cfg: LootCheckerConfig) {
  const resolvedDir = resolveLootCheckerDir(dir)
  const all = await walkRecursive(resolvedDir)
  const skipExts = new Set(cfg.skipExtensions.map((e) => e.toLowerCase()))
  const groups = new Map<string, { num: number; file: string }[]>()
  const skipped: { file: string; reason: string }[] = []

  for (const f of all) {
    const name = basename(f)
    // nikdy neřeš soubory uvnitř koše
    if (f.startsWith(KOS_DIR)) { skipped.push({ file: name, reason: 'uvnitř koše data/kos' }); continue }
    if (name.toLowerCase() === 'desktop.ini') { skipped.push({ file: name, reason: 'systémový soubor' }); continue }
    if (cfg.skipPrefixes.some((p) => name.startsWith(p))) { skipped.push({ file: name, reason: 'dočasný soubor' }); continue }
    const ext = extname(name).slice(1).toLowerCase()
    if (skipExts.has(ext)) { skipped.push({ file: name, reason: `rozstažený/dočasný (.${ext})` }); continue }
    if (!IMAGE_EXTS.has('.' + ext)) { skipped.push({ file: name, reason: `není obrázek (.${ext})` }); continue }
    const { base, num } = parseDuplicateName(basename(name, extname(name)))
    const key = `${base.toLowerCase()}|${ext}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ num, file: f })
  }

  let kept = 0
  const toMove: { original: string; from: string }[] = []
  for (const [, items] of groups) {
    if (items.length <= 1) { kept++; continue }
    items.sort((a, b) => a.num - b.num || a.file.localeCompare(b.file))
    const keep = items[0]
    kept++
    for (const it of items.slice(1)) toMove.push({ original: basename(keep.file), from: it.file })
  }
  return { resolvedDir, groups, kept, toMove, skipped }
}

export async function runLootChecker(opts: LootCheckerOptions = {}): Promise<{ result: LootCheckerResult; message: string }> {
  const cfg = await loadLootCheckerConfig()
  // FÁZE 2: cílové složky z UI dovytvoř, když chybí — jinak by třídění nemělo kam přesouvat
  const ensured = await ensureTargetFolders(cfg).catch(() => ({ created: [] as string[], errors: [] as any[] }))
  const dir = resolveLootCheckerDir(opts.dir ?? cfg.dir)
  const dryRun = !!opts.dryRun
  const startedAt = new Date()

  const { kept, toMove, skipped } = await findDuplicates(dir, cfg)
  const result: LootCheckerResult = { dir, kosDir: KOS_DIR, dryRun, kept, moved: [], skipped, errors: [], txtPath: null, reportPath: null }

  if (!dryRun) await mkdir(KOS_DIR, { recursive: true })

  let txtPath: string | null = null
  opts.onProgress?.(0, toMove.length, '')
  if (!dryRun && toMove.length > 0) {
    const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_')
    txtPath = join(KOS_DIR, `presunute_${stamp}.txt`)
    const lines: string[] = []
    let done1 = 0
    for (const t of toMove) {
      try {
        const dest = await freeTarget(KOS_DIR, basename(t.from))
        await moveNoOverwrite(t.from, dest)
        result.moved.push({ file: basename(t.from), from: t.from, to: dest, original: t.original })
        lines.push(`${t.from} -> ${dest} | original: ${t.original}`)
      } catch (err: any) {
        result.errors.push({ file: basename(t.from), error: err?.message ?? String(err) })
      }
      done1++
      opts.onProgress?.(done1, toMove.length, basename(t.from))
    }
    const header = [
      'Loot Checker — presunute duplicity',
      `Datum: ${startedAt.toLocaleString('cs-CZ')}`,
      `Zdroj: ${dir}`,
      `Kos: ${KOS_DIR}`,
      `Pocet: ${result.moved.length}`,
      '---',
    ]
    await writeFile(txtPath, [...header, ...lines].join('\n') + '\n', 'utf-8')
    result.txtPath = txtPath
  } else {
    // dry-run: jen plán, nic se nepřesouvá
    result.moved = toMove.map((t) => ({ file: basename(t.from), from: t.from, to: join(KOS_DIR, basename(t.from)), original: t.original }))
  }

  // Report V5 - .md do data/reports, vzdy, i kdyz se zavre okno (bezi na pozadi)
  {
    await mkdir(REPORTS_DIR, { recursive: true }).catch(() => {})
    const stamp2 = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_')
    const rName = dryRun ? `duplicity_${stamp2}_dryrun.md` : `duplicity_${stamp2}.md`
    const rPath = join(REPORTS_DIR, rName)
    let verified1 = 0
    if (!dryRun) for (const m of result.moved) if (await exists(m.to)) verified1++
    const md1: string[] = []
    md1.push('# Loot Checker - FAZE 1 duplicity')
    md1.push('')
    md1.push(`- Datum: ${startedAt.toLocaleString('cs-CZ')}`)
    md1.push(`- Zdroj: ${dir}`)
    md1.push(`- Kos: ${KOS_DIR}`)
    md1.push(`- Rezim: ${dryRun ? 'DRY-RUN - nic se nepresunulo' : 'NAOSTRO - presunuto do kose'}`)
    md1.push('')
    md1.push('## Souhrn')
    md1.push('')
    md1.push(`| Ponechano | Presunuto do kose | Preskoceno | Chyby |`)
    md1.push(`| --- | --- | --- | --- |`)
    md1.push(`| ${kept} | ${result.moved.length} | ${skipped.length} | ${result.errors.length} |`)
    md1.push('')
    md1.push('## Nic nebylo smazano')
    md1.push('')
    if (dryRun) md1.push('Dry-run - zadny soubor se nepresunul ani nesmazal.')
    else { md1.push('FAZE 1 nikdy nemaza, jen presouva duplicity do data/kos/. Odtud je kdykoliv vratis zpet.'); md1.push(`Overeni: ${verified1} / ${result.moved.length} presunutych souboru existuje v kosi.`); if (txtPath) md1.push(`Seznam v kosi: ${txtPath}`) }
    md1.push('')
    md1.push('## Presunuto do kose')
    md1.push('')
    if (result.moved.length === 0) md1.push('_Nic._')
    else { md1.push('| Soubor | -> Kos | Original ponechan |'); md1.push('| --- | --- | --- |'); for (const m of result.moved) md1.push(`| ${m.file} | ${m.to} | ${m.original} |`) }
    md1.push('')
    md1.push('## Chyby')
    md1.push('')
    if (result.errors.length === 0) md1.push('_Zadne._')
    else for (const e of result.errors) md1.push(`- ${e.file}: ${e.error}`)
    await writeFile(rPath, md1.join('\n') + '\n', 'utf-8').catch(() => {})
    result.reportPath = rPath
  }
  const createdNote = ensured.created.length ? ` Vytvořené složky: ${ensured.created.map((p) => p.split(/[\\/]/).pop()).join(', ')}.` : ''
  const message = dryRun
    ? `Loot Checker: nasel ${toMove.length} duplicit k presunu do kose, nic se nepresunulo (dry-run). Ponechano: ${kept}. Report: ${result.reportPath}${createdNote}`
    : `Loot Checker: presunul ${result.moved.length} duplicit do data/kos/. Ponechano: ${kept}. Report: ${result.reportPath}${createdNote}${result.errors.length ? ` Chyby: ${result.errors.length}` : ''}`

  const saveState = opts.saveState ?? (!dryRun && !opts.dir)
  if (saveState) {
    await mkdir(AGENT_DIR, { recursive: true })
    await writeFile(STATE_FILE, JSON.stringify({ lastRun: startedAt.toISOString(), lastResult: message }, null, 2), 'utf-8')
  }

  return { result, message }
}


// ================= FÁZE 2 — VISION TŘÍDĚNÍ přes Ollama =================
// Princip: pro každý obrázek pošleme vision modelu JEDEN prompt, který obsahuje
// všechny cílové složky z UI (Název + Popis). Model vrátí JSON { folder, confidence, reason }.
// Kód pak rozhodne: confidence >= práh -> přesun, jinak nechat / ostatní podle belowThreshold.
// Žádný soubor se nikdy nemazá, nikdy se nepřepisuje — stejné záruky jako FÁZE 1.

export interface Phase2Options {
  dir?: string
  dryRun?: boolean
  model?: string
  threshold?: number
  saveState?: boolean
  onProgress?: (done: number, total: number, current: string) => void
}

export interface Phase2Move { file: string; from: string; to: string; folder: string; confidence: number; reason: string }
export interface Phase2Result {
  dir: string
  model: string
  threshold: number
  dryRun: boolean
  sorted: Phase2Move[]
  lowConfidence: { file: string; folder: string; confidence: number; reason: string }[]
  skipped: { file: string; reason: string }[]
  errors: { file: string; error: string }[]
  txtPath: string | null
  reportPath: string | null
}

function buildPhase2Prompt(folders: LootTargetFolder[]): string {
  const list = folders.map((f) => {
    const belongs = (f.belongs ?? '').trim()
    const notBelongs = (f.notBelongs ?? '').trim()
    const desc = (f.description ?? '').trim()
    // Nové UI: Patří / Nepatří. Starý config jen s description -> ber description jako Patří.
    if (belongs || notBelongs) {
      const parts = []
      if (belongs) parts.push(`Patří: ${belongs}`)
      if (notBelongs) parts.push(`Nepatří: ${notBelongs}`)
      return `- "${f.name}": ${parts.join('. ')}`
    }
    return `- "${f.name}": ${desc || '(bez popisu — ber jen podle názvu složky)'}`
  }).join('\n')
  return `You are an image classifier. Look at the image carefully.

Available folders (choose EXACTLY ONE folder name from this list, never invent a new one):
${list}

Rules:
- Use the folder DESCRIPTION, not just the folder name. The description is the rule.
- If the image clearly fits a folder, return that folder with high confidence (80-100).
- If it only vaguely fits, return lower confidence (40-70).
- If it fits NO folder, return folder "ostatni" with low confidence (0-30).
- Answer ONLY with valid JSON, no other text.

Return exactly:
{"folder": "<one of the folder names or ostatn>", "confidence": <0-100 number>, "reason": "<one short sentence in Czech why>"}`
}

function parsePhase2Json(text: string): { folder: string; confidence: number; reason: string } | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as any
    if (typeof j.folder !== 'string') return null
    const confidence = typeof j.confidence === 'number' ? Math.max(0, Math.min(100, j.confidence)) : 0
    return { folder: j.folder.trim(), confidence, reason: typeof j.reason === 'string' ? j.reason : '' }
  } catch {
    return null
  }
}

// Vision model podporuje jen tyhle přípony — gif / avif / tiff přeskočíme s důvodem
const VISION_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp'])

export async function runPhase2Sort(opts: Phase2Options = {}): Promise<{ result: Phase2Result; message: string }> {
  const cfg = await loadLootCheckerConfig()
  const model = (opts.model || cfg.visionModel || 'moondream').trim()
  const threshold = opts.threshold ?? cfg.confidenceThreshold ?? 60
  const dryRun = !!opts.dryRun
  const startedAt = new Date()

  if (!cfg.targetFolders || cfg.targetFolders.filter((t) => t.name).length === 0) {
    throw new Error('Nejdřív zadej cílové složky v UI (Název + Popis) a dej ULOŽIT SLOŽKY.')
  }
  if (!model) throw new Error('Není nastavený vision model. Zadej např. moondream.')

  // Cílové složky dovytvoř — bez toho by třídění nemělo kam přesouvat (už z V3.2)
  const ensured = await ensureTargetFolders(cfg).catch(() => ({ created: [] as string[], errors: [] as any[] }))

  const dir = resolveLootCheckerDir(opts.dir ?? cfg.dir)
  const targetPaths = new Set(cfg.targetFolders.map((t) => resolveTargetFolderPath(cfg.dir, t).toLowerCase()))
  // fallback složka (ostatní) taky dovytvoř, kdyby byla potřeba pro belowThreshold = 'ostatni'
  const fallbackPath = join(dir, cfg.fallbackFolder)
  await mkdir(fallbackPath, { recursive: true }).catch(() => {})

  // Vylistuj obrázky, ale PŘESKOČ soubory, co už jsou v cílové složce nebo v koši — ty už jsou roztříděné
  const all = await walkRecursive(dir)
  const skipExts = new Set(cfg.skipExtensions.map((e) => e.toLowerCase()))
  const candidates: string[] = []
  const skipped: { file: string; reason: string }[] = []
  for (const f of all) {
    const name = basename(f)
    const lower = f.toLowerCase()
    if (f.startsWith(KOS_DIR)) { skipped.push({ file: name, reason: 'uvnitř koše data/kos' }); continue }
    if ([...targetPaths].some((tp) => lower.startsWith(tp + '\\') || lower.startsWith(tp + '/'))) {
      skipped.push({ file: name, reason: 'už je v cílové složce' }); continue
    }
    if (name.toLowerCase() === 'desktop.ini') { skipped.push({ file: name, reason: 'systémový soubor' }); continue }
    if (cfg.skipPrefixes.some((p) => name.startsWith(p))) { skipped.push({ file: name, reason: 'dočasný soubor' }); continue }
    const ext = extname(name).slice(1).toLowerCase()
    if (skipExts.has(ext)) { skipped.push({ file: name, reason: `rozstažený/dočasný (.${ext})` }); continue }
    if (!IMAGE_EXTS.has('.' + ext)) { skipped.push({ file: name, reason: `není obrázek (.${ext})` }); continue }
    if (!VISION_EXTS.has('.' + ext)) { skipped.push({ file: name, reason: `formát .${ext} vision model nepodporuje (převeď na png/jpg)` }); continue }
    candidates.push(f)
  }

  const result: Phase2Result = { dir, model, threshold, dryRun, sorted: [], lowConfidence: [], skipped, errors: [], txtPath: null, reportPath: null }

  // Ollama — stejný klient jako v apps/api/src/index.ts
  const { Ollama } = await import('ollama')
  const ollama = new Ollama({ host: 'http://localhost:11434' })
  const prompt = buildPhase2Prompt(cfg.targetFolders)

  // Sekvenčně, ne paralelně — vision model na jednom PC by se jinak dusil a padal na paměti
  let done2 = 0
  opts.onProgress?.(0, candidates.length, '')
  for (const file of candidates) {
    const name = basename(file)
    try {
      const buf = await readFile(file)
      const b64 = buf.toString('base64')
      let res: any
      try {
        res = await ollama.chat({
          model,
          messages: [{ role: 'user', content: prompt, images: [b64] }],
          options: { temperature: 0, num_ctx: 4096 },
        })
      } catch (err: any) {
        const msg = err?.message ?? String(err)
        if (/model.*not found|does not exist|no such model/i.test(msg)) {
          throw new Error(`Vision model "${model}" není stažený. V terminálu spusť: ollama pull ${model} — a pak to zkus znovu.`)
        }
        throw err
      }
      const parsed = parsePhase2Json(res?.message?.content ?? '')
      if (!parsed) {
        result.errors.push({ file: name, error: `Model nevrátil platné JSON: ${(res?.message?.content ?? '').slice(0, 120)}` })
        done2++; opts.onProgress?.(done2, candidates.length, name); continue
      }
      const folderNames = new Set(cfg.targetFolders.map((t) => t.name))
      let folder = parsed.folder
      // Model si vymyslel složku, co neexistuje -> ber jako ostatní s nízkou jistotou
      if (folder !== cfg.fallbackFolder && !folderNames.has(folder)) {
        result.lowConfidence.push({ file: name, folder: parsed.folder, confidence: parsed.confidence, reason: `Model vrátil neznámou složku "${parsed.folder}", beru jako ostatní. ${parsed.reason}` })
        folder = cfg.fallbackFolder
      }
      if (parsed.confidence < threshold) {
        if (cfg.belowThreshold === 'ostatni') {
          // pod prahem, ale uživatel chce i tak do ostatní
          const destFolder = join(dir, cfg.fallbackFolder)
          const dest = await freeTarget(destFolder, name)
          if (!dryRun) await moveNoOverwrite(file, dest)
          result.sorted.push({ file: name, from: file, to: dest, folder: cfg.fallbackFolder, confidence: parsed.confidence, reason: `Pod prahem ${threshold}, přesunuto do ostatní. ${parsed.reason}` })
        } else {
          result.lowConfidence.push({ file: name, folder: parsed.folder, confidence: parsed.confidence, reason: parsed.reason })
        }
        done2++; opts.onProgress?.(done2, candidates.length, name); continue
      }
      // nad prahem -> přesun do cílové složky
      const target = cfg.targetFolders.find((t) => t.name === folder)
      const destFolder = target ? resolveTargetFolderPath(cfg.dir, target) : fallbackPath
      const dest = await freeTarget(destFolder, name)
      if (!dryRun) await moveNoOverwrite(file, dest)
      result.sorted.push({ file: name, from: file, to: dest, folder, confidence: parsed.confidence, reason: parsed.reason })
    } catch (err: any) {
      if (/ollama pull/.test(err?.message ?? '')) throw err
      result.errors.push({ file: name, error: err?.message ?? String(err) })
    }
    done2++
    opts.onProgress?.(done2, candidates.length, name)
  }

  // Report V5 - .md do data/reports, vzdy, i kdyz se zavre okno
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_')
  const reportName = dryRun ? `trideni_${stamp}_dryrun.md` : `trideni_${stamp}.md`
  await mkdir(REPORTS_DIR, { recursive: true }).catch(() => {})
  const reportPath = join(REPORTS_DIR, reportName)
  let verified = 0
  if (!dryRun) { for (const s of result.sorted) { if (await exists(s.to)) verified++ } }
  const md: string[] = []
  md.push('# Loot Checker - FAZE 2 vision trideni')
  md.push('')
  md.push(`- Datum: ${startedAt.toLocaleString('cs-CZ')}`)
  md.push(`- Zdroj: ${dir}`)
  md.push(`- Model: ${model} | Prah: ${threshold} | Pod prahem: ${cfg.belowThreshold}`)
  md.push(`- Rezim: ${dryRun ? 'DRY-RUN - nic se nepresunulo, jen nahled' : 'NAOSTRO - presunuto'}`)
  md.push('')
  md.push('## Souhrn')
  md.push('')
  md.push('| Roztrideno | Nechano (nizka jistota) | Preskoceno | Chyby |')
  md.push('| --- | --- | --- | --- |')
  md.push(`| ${result.sorted.length} | ${result.lowConfidence.length} | ${result.skipped.length} | ${result.errors.length} |`)
  md.push('')
  md.push('## Nic nebylo smazano')
  md.push('')
  if (dryRun) { md.push('Dry-run - zadny soubor se nepresunul ani nesmazal.') } else { md.push('FAZE 2 nikdy nemaza, jen presouva.'); md.push(`Overeni po presunu: ${verified} / ${result.sorted.length} presunutych souboru existuje v cili.`); md.push('Druhy run ty same fotky znovu nepresune ani nesmaze - soubory co uz jsou v cilove slozce se preskoci jako uz je v cilove slozce.') }
  md.push('')
  md.push('## Roztrideno')
  md.push('')
  if (result.sorted.length === 0) md.push('_Nic - vsechno bud zustalo, nebo bylo preskoceno._')
  else { md.push('| Soubor | -> Slozka | Jistota | Duvod |'); md.push('| --- | --- | --- | --- |'); for (const s of result.sorted) md.push(`| ${s.file} | ${s.folder}/ | ${s.confidence}% | ${s.reason} |`) }
  md.push('')
  md.push('## Nechano na miste')
  md.push('')
  if (result.lowConfidence.length === 0) md.push('_Nic._')
  else { md.push('| Soubor | Navrhoval | Jistota | Duvod |'); md.push('| --- | --- | --- | --- |'); for (const s of result.lowConfidence) md.push(`| ${s.file} | ${s.folder} | ${s.confidence}% | ${s.reason} |`) }
  md.push('')
  md.push('## Preskoceno')
  md.push('')
  if (result.skipped.length === 0) md.push('_Nic._')
  else { md.push('| Soubor | Duvod |'); md.push('| --- | --- |'); for (const s of result.skipped.slice(0,200)) md.push(`| ${s.file} | ${s.reason} |`) }
  md.push('')
  md.push('## Chyby')
  md.push('')
  if (result.errors.length === 0) md.push('_Zadne._')
  else for (const e of result.errors) md.push(`- ${e.file}: ${e.error}`)
  await writeFile(reportPath, md.join('\n') + '\n', 'utf-8').catch(() => {})
  result.reportPath = reportPath
  result.txtPath = reportPath

  const createdNote = ensured.created.length ? ` Vytvořené složky: ${ensured.created.map((p) => p.split(/[\\\\/]/).pop()).join(', ')}.` : ''
  const message = dryRun
    ? `FAZE 2 (dry-run): model ${model} by roztridil ${result.sorted.length} obrazku, ${result.lowConfidence.length} nechal na miste (pod prahem ${threshold}), nic se nepresunulo. Report: ${result.reportPath}${createdNote}`
    : `FAZE 2: model ${model} roztridil ${result.sorted.length} obrazku do cilovych slozek, ${result.lowConfidence.length} nechal na miste (pod prahem ${threshold}). Report: ${result.reportPath}${createdNote}${result.errors.length ? ` Chyby: ${result.errors.length}` : ''}`

  const saveState = opts.saveState ?? (!dryRun && !opts.dir)
  if (saveState) {
    await mkdir(AGENT_DIR, { recursive: true })
    await writeFile(STATE_FILE, JSON.stringify({ lastRun: startedAt.toISOString(), lastResult: message }, null, 2), 'utf-8')
  }

  return { result, message }
}
