// apps/api/src/services/fileCommands.ts
// LOYO OS // MARY JANE — soubory: koukání (výpis složky, čtení souboru, hledání).
// Jen čtení — nic nemaže ani nepřepisuje. Funguje z UI i Telegramu, i obyčejnou větou:
// „vypiš mi soubory na ploše“, „co mám ve stažených“, „přečti plocha/poznamky.txt“.
import { existsSync } from 'node:fs'
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths.js'
import { desktopDir, resolveUserPath } from './scriptRunner.js'

type CommandResult = { reply: string; steps: string[] }

const MAX_LIST = 150
const MAX_READ_BYTES = 200_000
const MAX_SHOW_CHARS = 3_500

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// známé složky podle českých i anglických slov
function knownDir(word: string): string | null {
  const w = norm(word)
  const home = homedir()
  const pick = (...c: string[]) => c.find((p) => existsSync(p)) ?? c[0]
  // podle začátku slova, ať projde každý pád i psaní bez diakritiky (plocha/ploše/plose/plochu…)
  if (/^(ploch|plos|desktop)/.test(w)) return desktopDir()
  if (/^(stazen|stahov|download)/.test(w)) return pick(join(home, 'Downloads'), join(home, 'Stažené soubory'))
  if (/^(dokument|document)/.test(w)) return pick(join(home, 'Documents'), join(home, 'OneDrive', 'Documents'))
  if (/^(obraz|picture)/.test(w)) return pick(join(home, 'Pictures'), join(home, 'OneDrive', 'Pictures'))
  if (/^(hudb|music)/.test(w)) return join(home, 'Music')
  if (/^(vide)/.test(w)) return join(home, 'Videos')
  if (/^(domov|home|uzivatel)/.test(w)) return home
  if (/^(projekt|loyo)/.test(w)) return join(DATA_DIR, '..')
  if (w === 'data') return DATA_DIR
  return null
}

function resolveDir(input: string): string {
  const t = input.trim().replace(/^["']|["']$/g, '')
  if (!t) return desktopDir()
  return knownDir(t) ?? resolveUserPath(t)
}

const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} kB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(1)} GB`
const fmtDate = (d: Date) => d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

// ---------- výpis složky ----------
export async function listDirectory(input: string): Promise<CommandResult> {
  const dir = resolveDir(input)
  const steps = [`📁 výpis ${dir}`]
  const info = await stat(dir).catch(() => null)
  if (!info) return { reply: `📁 Složka neexistuje: ${dir}`, steps }
  if (!info.isDirectory()) return readFileCommand(dir)

  const entries = await readdir(dir, { withFileTypes: true }).catch((e) => { throw new Error(`Do složky nevidím: ${e.message}`) })
  const visible = entries.filter((e) => !e.name.startsWith('.') && !/^desktop\.ini$/i.test(e.name))
  const dirs = visible.filter((e) => e.isDirectory()).map((e) => e.name).sort((a, b) => a.localeCompare(b, 'cs'))
  const files = await Promise.all(
    visible.filter((e) => !e.isDirectory()).map(async (e) => {
      const s = await stat(join(dir, e.name)).catch(() => null)
      return { name: e.name, size: s?.size ?? 0, mtime: s?.mtime ?? new Date(0) }
    }),
  )
  files.sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  const lines = [`📁 ${dir}`, `${dirs.length} složek · ${files.length} souborů`, '']
  let shown = 0
  for (const d of dirs) { if (shown++ >= MAX_LIST) break; lines.push(`📂 ${d}/`) }
  for (const f of files) {
    if (shown++ >= MAX_LIST) break
    lines.push(`📄 ${f.name} · ${fmtSize(f.size)} · ${fmtDate(f.mtime)}`)
  }
  if (dirs.length + files.length > MAX_LIST) lines.push(`… a dalších ${dirs.length + files.length - MAX_LIST}`)
  if (!dirs.length && !files.length) lines.push('(prázdná složka)')
  lines.push('', 'Otevřít: /cat <soubor> · podsložka: /ls <cesta> · hledat: /najdi <název>')
  return { reply: lines.join('\n'), steps }
}

// ---------- čtení souboru ----------
export async function readFileCommand(input: string): Promise<CommandResult> {
  const file = resolveUserPath(input.trim().replace(/^["']|["']$/g, ''))
  const steps = [`📄 čtení ${file}`]
  const info = await stat(file).catch(() => null)
  if (!info) return { reply: `📄 Soubor neexistuje: ${file}\nTip: /ls plocha ukáže, co tam je.`, steps }
  if (info.isDirectory()) return listDirectory(file)

  const fh = await open(file, 'r')
  try {
    const len = Math.min(info.size, MAX_READ_BYTES)
    const buf = Buffer.alloc(len)
    await fh.read(buf, 0, len, 0)
    // binárka = nulové bajty v prvních 8 kB
    if (buf.subarray(0, 8192).includes(0)) {
      return { reply: `📄 ${basename(file)} · ${fmtSize(info.size)} · ${extname(file) || 'bez přípony'}\nJe to binární soubor (obrázek, archiv, program…) — text z něj nevypíšu.`, steps }
    }
    let text = buf.toString('utf8').replace(/^﻿/, '')
    const cut = text.length > MAX_SHOW_CHARS || info.size > MAX_READ_BYTES
    if (text.length > MAX_SHOW_CHARS) text = text.slice(0, MAX_SHOW_CHARS)
    return {
      reply: `📄 ${file} · ${fmtSize(info.size)} · ${fmtDate(info.mtime)}\n\n${text}${cut ? `\n\n… (zkráceno, celý soubor má ${fmtSize(info.size)})` : ''}`,
      steps,
    }
  } finally {
    await fh.close()
  }
}

// ---------- hledání podle názvu ----------
export async function findFiles(input: string): Promise<CommandResult> {
  const m = input.match(/^(.*?)(?:\s+(?:v|ve|in)\s+(.+))?$/i)
  const query = norm((m?.[1] ?? '').trim().replace(/^["']|["']$/g, ''))
  const root = resolveDir(m?.[2] ?? '')
  const steps = [`🔎 hledání "${query}" v ${root}`]
  if (!query) return { reply: 'Jak na to: /najdi <část názvu> [v plocha|stažené|dokumenty|cesta]\nnapř. /najdi faktura v dokumenty', steps }

  // * a ? jako zástupné znaky, jinak „obsahuje“
  const re = /[*?]/.test(query)
    ? new RegExp('^' + query.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    : null
  const hits: string[] = []
  const SKIP = new Set(['node_modules', '.git', 'AppData', '$Recycle.Bin', 'target', 'dist'])
  async function walk(dir: string, depth: number) {
    if (hits.length >= 60 || depth > 5) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (hits.length >= 60) return
      const name = norm(e.name)
      if (re ? re.test(name) : name.includes(query)) hits.push(join(dir, e.name) + (e.isDirectory() ? '\\' : ''))
      if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')) await walk(join(dir, e.name), depth + 1)
    }
  }
  await walk(root, 0)
  return {
    reply: hits.length
      ? [`🔎 „${query}“ v ${root} — ${hits.length}${hits.length >= 60 ? '+' : ''} výsledků`, '', ...hits.map((h) => (h.endsWith('\\') ? `📂 ${h}` : `📄 ${h}`))].join('\n')
      : `🔎 V ${root} nic jako „${query}“ (hledám do hloubky 5 složek).`,
    steps,
  }
}

// ---------- obyčejná věta ----------
// \w v JS nebere české znaky → \p{L}
// „na ploše“, „ve stažených“, „v dokumentech“, „z plochy“ — předložka je povinná, ať to nechytá „ukaž mi video o…“
const PLACE = String.raw`((?:plo[cšs]|desktop|sta[zž]en|stahov|download|dokument|document|obr[aá]z|picture|hudb|music|vide|domov)\p{L}*)`
const LIST_RE = new RegExp(String.raw`(vyp[ií][sš]|uka[zž]|zobraz|na[cč]ti|projdi|list|co\s+(je|m[aá]m|le[zž][ií])|jak[eé]\s+(soubory|v[eě]ci|slo[zž]ky)|soubory)[\s\S]*?(?<![\p{L}])(?:na|ve?|z|ze|do|in|from|on)\s+${PLACE}`, 'iu')
const READ_RE = /(?:p[rř]e[cč]ti|otev[rř]i|uka[zž]\s+obsah|co\s+je\s+v\s+souboru)\s+(?:mi\s+)?(?:soubor\s+)?["„]?([^\s"“]+\.[a-z0-9]{1,6})/iu

export async function tryNaturalFileIntent(text: string): Promise<CommandResult | null> {
  const read = text.match(READ_RE)
  if (read) return readFileCommand(read[1])
  const list = text.match(LIST_RE)
  if (list) {
    const dir = knownDir(list[list.length - 1])
    if (dir) return listDirectory(dir)
  }
  return null
}
