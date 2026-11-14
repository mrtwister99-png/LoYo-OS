// D:\dev\loyo-os\apps\api\src\services\tridil.ts
// LOYO OS // TŘÍDIL — noční třídění Stažených souborů podle přípony (jen přesun, nikdy mazání)

import { readFile, writeFile, readdir, stat, rename, mkdir, access, copyFile, unlink } from 'node:fs/promises'
import { join, extname, basename, resolve } from 'node:path'
import { homedir } from 'node:os'
import { AGENTS_DIR } from '../lib/dataPaths.js'

const AGENT_DIR = join(AGENTS_DIR, 'tridil')
const CONFIG_FILE = join(AGENT_DIR, 'config.json')
const STATE_FILE = join(AGENT_DIR, 'state.json')

export interface TridilConfig
{
  dir: string
  fallbackFolder: string
  mapping: Record<string, string[]>
  proposedExtensions?: Record<string, string[]>
  skipExtensions: string[]
  skipPrefixes: string[]
  // odškrtnuté v UI — soubory s nimi zůstanou ležet, nepřesouvají se nikam
  disabledFolders?: string[]      // např. ["ostatni"] = neznámé přípony nech být
  disabledExtensions?: string[]   // např. ["png"] = png nech být
}

export interface TridilOptions
{
  dir?: string          // přepíše config.dir (testy)
  since?: Date          // hranice „nových“ souborů; default lastRun nebo včerejší půlnoc
  all?: boolean         // ignoruj datum, vezmi všechny volné soubory
  dryRun?: boolean      // nic nepřesouvej, jen vrať plán
  saveState?: boolean   // zapsat lastRun (default: true, pokud není dryRun a není vlastní dir)
}

export interface TridilMove { file: string; folder: string; target: string }

export interface TridilResult
{
  dir: string
  since: string | null
  dryRun: boolean
  moved: TridilMove[]
  skipped: { file: string; reason: string }[]
  errors: { file: string; error: string }[]
}

const DEFAULT_CONFIG: TridilConfig = {
  dir: '%USERPROFILE%\\Downloads',
  fallbackFolder: 'ostatni',
  mapping: {
    mp3: ['mp3'],
    zip: ['zip'],
    obrazky: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'],
    pdf: ['pdf'],
  },
  skipExtensions: ['crdownload', 'part', 'tmp', 'download', 'partial'],
  skipPrefixes: ['~$'],
}

export async function saveTridilConfig(cfg: TridilConfig): Promise<void>
{
  await mkdir(AGENT_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf-8')
}

export function resolveTridilDir(dir: string): string
{
  return expandDir(dir)
}

export async function loadTridilConfig(): Promise<TridilConfig>
{
  try
  {
    return { ...DEFAULT_CONFIG, ...JSON.parse(await readFile(CONFIG_FILE, 'utf-8')) }
  }
  catch
  {
    return DEFAULT_CONFIG
  }
}

function expandDir(dir: string): string
{
  const home = process.env.USERPROFILE || homedir()
  return resolve(dir.replace(/%USERPROFILE%/gi, home).replace(/^~(?=[\\/]|$)/, home))
}

async function loadLastRun(): Promise<Date | null>
{
  try
  {
    const s = JSON.parse(await readFile(STATE_FILE, 'utf-8'))
    return s.lastRun ? new Date(s.lastRun) : null
  }
  catch
  {
    return null
  }
}

async function exists(p: string): Promise<boolean>
{
  try { await access(p); return true } catch { return false }
}

// „foto.jpg“ → „foto (1).jpg“, „foto (2).jpg“ … dokud není volné jméno
async function freeTarget(folderPath: string, fileName: string): Promise<string>
{
  let candidate = join(folderPath, fileName)
  if (!(await exists(candidate))) return candidate
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  for (let i = 1; ; i++)
  {
    candidate = join(folderPath, `${stem} (${i})${ext}`)
    if (!(await exists(candidate))) return candidate
  }
}

// přesun bez přepsání; přes disky (EXDEV) copy + unlink zdroje až po úspěšné kopii
async function moveNoOverwrite(src: string, dest: string): Promise<void>
{
  try
  {
    await rename(src, dest)
  }
  catch (err: any)
  {
    if (err?.code !== 'EXDEV') throw err
    await copyFile(src, dest, 1 /* COPYFILE_EXCL */)
    await unlink(src)
  }
}

export function folderForExtension(cfg: TridilConfig, ext: string): string
{
  const e = ext.toLowerCase()
  for (const [folder, exts] of Object.entries(cfg.mapping))
  {
    if (exts.map(x => x.toLowerCase()).includes(e)) return folder
  }
  return cfg.fallbackFolder
}

export async function sortDownloads(opts: TridilOptions = {}): Promise<TridilResult>
{
  const cfg = await loadTridilConfig()
  const dir = expandDir(opts.dir ?? cfg.dir)
  const dryRun = !!opts.dryRun
  const startedAt = new Date()

  let since: Date | null = null
  if (!opts.all)
  {
    since = opts.since ?? (await loadLastRun())
    if (!since)
    {
      const y = new Date(startedAt)
      y.setDate(y.getDate() - 1)
      y.setHours(0, 0, 0, 0)
      since = y
    }
  }

  const result: TridilResult = { dir, since: since?.toISOString() ?? null, dryRun, moved: [], skipped: [], errors: [] }
  const targetFolders = new Set([...Object.keys(cfg.mapping), cfg.fallbackFolder].map(f => f.toLowerCase()))
  const skipExts = new Set(cfg.skipExtensions.map(e => e.toLowerCase()))
  const offFolders = new Set((cfg.disabledFolders ?? []).map(f => f.toLowerCase()))
  const offExts = new Set((cfg.disabledExtensions ?? []).map(e => e.toLowerCase()))

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries)
  {
    const name = entry.name
    // složky (včetně cílových mp3/zip/obrazky/pdf/ostatni) a symlinky nikdy nepřesouváme
    if (!entry.isFile())
    {
      if (entry.isDirectory() && targetFolders.has(name.toLowerCase())) continue
      result.skipped.push({ file: name, reason: entry.isDirectory() ? 'složka' : 'není běžný soubor' })
      continue
    }

    const ext = extname(name).slice(1).toLowerCase()
    if (skipExts.has(ext))
    {
      result.skipped.push({ file: name, reason: `rozstažený/dočasný (.${ext})` })
      continue
    }
    if (cfg.skipPrefixes.some(p => name.startsWith(p)))
    {
      result.skipped.push({ file: name, reason: 'dočasný soubor' })
      continue
    }
    if (name.toLowerCase() === 'desktop.ini')
    {
      result.skipped.push({ file: name, reason: 'systémový soubor' })
      continue
    }

    const src = join(dir, name)
    try
    {
      if (since)
      {
        const st = await stat(src)
        // čas příchodu do Downloads = birthtime; mtime jako pojistka (některé prohlížeče ji nastavují)
        const arrived = Math.max(st.birthtimeMs || 0, st.mtimeMs || 0)
        if (arrived < since.getTime())
        {
          result.skipped.push({ file: name, reason: 'starší než hranice běhu' })
          continue
        }
      }

      const folder = folderForExtension(cfg, ext)
      if (offFolders.has(folder.toLowerCase()) || (ext && offExts.has(ext)))
      {
        result.skipped.push({ file: name, reason: offFolders.has(folder.toLowerCase()) ? `složka ${folder} vypnutá` : `přípona .${ext} vypnutá` })
        continue
      }
      const folderPath = join(dir, folder)
      if (!dryRun) await mkdir(folderPath, { recursive: true })
      const target = await freeTarget(folderPath, name)
      if (!dryRun) await moveNoOverwrite(src, target)
      result.moved.push({ file: name, folder, target })
    }
    catch (err: any)
    {
      result.errors.push({ file: name, error: err?.message ?? String(err) })
    }
  }

  const saveState = opts.saveState ?? (!dryRun && !opts.dir)
  if (saveState)
  {
    await mkdir(AGENT_DIR, { recursive: true })
    await writeFile(STATE_FILE, JSON.stringify({ lastRun: startedAt.toISOString(), lastResult: summarize(result) }, null, 2), 'utf-8')
  }

  return result
}

export function summarize(r: TridilResult): string
{
  const byFolder: Record<string, number> = {}
  for (const m of r.moved) byFolder[m.folder] = (byFolder[m.folder] ?? 0) + 1
  const parts = Object.entries(byFolder).map(([f, n]) => `${f}: ${n}`).join(', ')
  const verb = r.dryRun ? 'by přesunul' : 'přesunul'
  const head = r.moved.length
    ? `🗂 Třídil ${verb} ${r.moved.length} souborů (${parts})`
    : '🗂 Třídil: nic nového k roztřídění'
  const skippedTmp = r.skipped.filter(s => s.reason.startsWith('rozstažený')).length
  const skippedOld = r.skipped.filter(s => s.reason.startsWith('starší')).length
  const skippedOff = r.skipped.filter(s => s.reason.endsWith('vypnutá')).length
  const tail = [
    skippedOld ? `starších než poslední běh (nechány): ${skippedOld}` : '',
    skippedOff ? `vypnuté v nastavení (nechány): ${skippedOff}` : '',
    skippedTmp ? `přeskočeno rozstažených: ${skippedTmp}` : '',
    r.errors.length ? `chyby: ${r.errors.length} (${r.errors.map(e => e.file).join(', ')})` : '',
  ].filter(Boolean).join(' · ')
  return tail ? `${head}\n${tail}` : head
}

// běh + zápis do activity feedu (stejně jako ostatní agenti)
export async function runTridil(opts: TridilOptions = {}): Promise<{ result: TridilResult; message: string }>
{
  const { logActivity } = await import('../routes/activity.js')
  try
  {
    const result = await sortDownloads(opts)
    const message = summarize(result)
    await logActivity({
      agent: 'Tridil',
      type: result.errors.length ? 'error' : 'save',
      action: message.split('\n')[0],
      meta: {
        dir: result.dir,
        since: result.since,
        dryRun: result.dryRun,
        moved: result.moved.map(m => `${m.file} → ${m.folder}/${basename(m.target)}`),
        errors: result.errors,
      },
    })
    return { result, message }
  }
  catch (err: any)
  {
    const message = `🗂 Třídil selhal: ${err?.message ?? String(err)}`
    await logActivity({ agent: 'Tridil', type: 'error', action: message })
    throw err
  }
}
