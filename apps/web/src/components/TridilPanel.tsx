// D:\dev\loyo-os\apps\web\src\components\TridilPanel.tsx
// LOYO OS // TŘÍDIL — nastavení (cesta, složky, přípony) + ruční „Roztřídit teď“ v detailu agenta
import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ACCENT = '#12a4ff'

type TridilConfig = {
  dir: string
  fallbackFolder: string
  mapping: Record<string, string[]>
  disabledFolders?: string[]
  disabledExtensions?: string[]
}

type RunResult = {
  message: string
  dryRun: boolean
  movedFiles: { file: string; folder: string; target: string }[]
  errors: { file: string; error: string }[]
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new Error('API neběží (localhost:3001), spusť pnpm dev:api')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json as T
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className="inline-flex w-4 h-4 rounded-[5px] border items-center justify-center text-[10px] font-black shrink-0"
      style={on ? { background: ACCENT, borderColor: ACCENT, color: '#fff' } : { borderColor: '#555' }}
    >
      {on ? '✓' : ''}
    </span>
  )
}

export default function TridilPanel() {
  const [cfg, setCfg] = useState<TridilConfig | null>(null)
  const [dirInput, setDirInput] = useState('')
  const [resolvedDir, setResolvedDir] = useState('')
  const [dirExists, setDirExists] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [running, setRunning] = useState<'' | 'preview' | 'run'>('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState('')
  const [newExt, setNewExt] = useState<Record<string, string>>({})

  const load = async () => {
    setLoadError('')
    try {
      const r = await api<{ config: TridilConfig; resolvedDir: string; dirExists: boolean }>('/api/agents/tridil/config')
      setCfg(r.config)
      setDirInput(r.config.dir)
      setResolvedDir(r.resolvedDir)
      setDirExists(r.dirExists)
    } catch (e: any) {
      setLoadError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  const save = async (patch: Partial<TridilConfig>) => {
    setSaveMsg('')
    try {
      const r = await api<{ config: TridilConfig; resolvedDir: string; dirExists: boolean }>('/api/agents/tridil/config', {
        method: 'POST',
        body: JSON.stringify(patch),
      })
      setCfg(r.config)
      setResolvedDir(r.resolvedDir)
      setDirExists(r.dirExists)
      setSaveMsg('✓ uloženo')
      setResult(null)
      setTimeout(() => setSaveMsg(''), 1500)
      return true
    } catch (e: any) {
      setSaveMsg(`✕ ${e.message}`)
      return false
    }
  }

  const pickFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const picked = await open({ directory: true, multiple: false, defaultPath: resolvedDir || undefined })
      if (typeof picked === 'string' && picked) {
        setDirInput(picked)
        await save({ dir: picked })
      }
    } catch {
      setSaveMsg('✕ Výběr složky funguje jen v desktop appce, cestu napiš ručně')
    }
  }

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'preview' : 'run')
    setRunError('')
    setResult(null)
    try {
      const r = await api<RunResult>('/api/agents/tridil/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun, all: !onlyNew }),
      })
      setResult(r)
    } catch (e: any) {
      setRunError(e.message)
    } finally {
      setRunning('')
    }
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
        <div className="text-[11px] font-bold tracking-[0.2em]">TŘÍDĚNÍ SOUBORŮ</div>
        <div className="mt-2 text-[11px] font-mono text-[#ff6b6b]">{loadError}</div>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-full border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">ZKUSIT ZNOVU</button>
      </div>
    )
  }
  if (!cfg) return <div className="text-[11px] font-mono text-[#9a9a9a]">Načítám nastavení Třídila...</div>

  const offFolders = new Set(cfg.disabledFolders ?? [])
  const offExts = new Set(cfg.disabledExtensions ?? [])
  const folders = [...Object.keys(cfg.mapping), cfg.fallbackFolder]

  const toggleFolder = (f: string) => {
    const next = new Set(offFolders)
    next.has(f) ? next.delete(f) : next.add(f)
    save({ disabledFolders: [...next] })
  }
  const toggleExt = (e: string) => {
    const next = new Set(offExts)
    next.has(e) ? next.delete(e) : next.add(e)
    save({ disabledExtensions: [...next] })
  }
  const addExt = async (folder: string) => {
    const ext = (newExt[folder] || '').trim().toLowerCase().replace(/^\./, '')
    if (!ext) return
    // přípona smí být jen v jedné složce — z ostatních ji odeber
    const mapping: Record<string, string[]> = {}
    for (const [f, exts] of Object.entries(cfg.mapping)) mapping[f] = exts.filter(x => x !== ext)
    mapping[folder] = [...mapping[folder], ext]
    if (await save({ mapping })) setNewExt({ ...newExt, [folder]: '' })
  }

  return (
    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">TŘÍDĚNÍ SOUBORŮ</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">automaticky denně 00:00 · jen přesouvá, nikdy nemaže</div>
        </div>
        {saveMsg && <div className={`text-[10px] font-mono ${saveMsg.startsWith('✕') ? 'text-[#ff6b6b]' : 'text-[#9a9a9a]'}`}>{saveMsg}</div>}
      </div>

      {/* CESTA */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">SLOŽKA K TŘÍDĚNÍ</div>
        <div className="mt-2 flex gap-2">
          <input
            value={dirInput}
            onChange={e => setDirInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && dirInput !== cfg.dir) save({ dir: dirInput }) }}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#444] bg-transparent text-[12px] font-mono outline-none focus:border-[#12a4ff]"
            placeholder="%USERPROFILE%\Downloads"
          />
          <button onClick={pickFolder} className="shrink-0 px-3.5 py-2.5 rounded-xl border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] hover:border-[#12a4ff] transition">VYBRAT…</button>
          {dirInput !== cfg.dir && (
            <button onClick={() => save({ dir: dirInput })} className="shrink-0 px-3.5 py-2.5 rounded-xl text-[10px] font-black tracking-widest text-[#f0f0f0]" style={{ background: ACCENT }}>ULOŽIT</button>
          )}
        </div>
        <div className={`mt-1.5 text-[10px] font-mono ${dirExists ? 'text-[#9a9a9a]/70' : 'text-[#ff6b6b]'}`}>
          {dirExists ? `→ ${resolvedDir}` : `složka neexistuje: ${resolvedDir}`}
        </div>
      </div>

      {/* SLOŽKY A PŘÍPONY */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">KAM SE TŘÍDÍ · odškrtnuté zůstanou ležet</div>
        <div className="mt-2 space-y-2">
          {folders.map(folder => {
            const folderOn = !offFolders.has(folder)
            const isFallback = folder === cfg.fallbackFolder
            const exts = cfg.mapping[folder] ?? []
            return (
              <div key={folder} className={`p-3 rounded-xl border border-[#444] ${folderOn ? '' : 'opacity-50'}`}>
                <button onClick={() => toggleFolder(folder)} className="flex items-center gap-2 text-[12px] font-bold">
                  <Check on={folderOn} />
                  <span className="font-mono">{folder}/</span>
                  {isFallback && <span className="text-[10px] font-mono font-normal text-[#9a9a9a]/70">všechny ostatní přípony</span>}
                </button>
                {!isFallback && (
                  <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                    {exts.map(ext => {
                      const on = folderOn && !offExts.has(ext)
                      return (
                        <button
                          key={ext}
                          onClick={() => toggleExt(ext)}
                          disabled={!folderOn}
                          className="px-2.5 py-1 rounded-full text-[10px] font-mono border transition disabled:cursor-not-allowed"
                          style={on ? { background: ACCENT, borderColor: ACCENT, color: '#fff' } : { borderColor: '#444', color: '#9a9a9a', textDecoration: 'line-through' }}
                        >
                          .{ext}
                        </button>
                      )
                    })}
                    <input
                      value={newExt[folder] || ''}
                      onChange={e => setNewExt({ ...newExt, [folder]: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') addExt(folder) }}
                      disabled={!folderOn}
                      className="w-16 px-2 py-1 rounded-full border border-dashed border-[#555] bg-transparent text-[10px] font-mono outline-none focus:border-[#12a4ff]"
                      placeholder="+ přípona"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* SPUŠTĚNÍ */}
      <div>
        <div className="flex gap-4 text-[11px]">
          <button onClick={() => setOnlyNew(false)} className="flex items-center gap-2"><Check on={!onlyNew} /> všechny soubory ve složce</button>
          <button onClick={() => setOnlyNew(true)} className="flex items-center gap-2"><Check on={onlyNew} /> jen nové od posledního běhu</button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => run(true)}
            disabled={!!running || !dirExists}
            className="px-5 py-3 rounded-full border border-[#444] text-[11px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition disabled:opacity-50"
          >
            {running === 'preview' ? 'POČÍTÁM...' : 'NÁHLED'}
          </button>
          <button
            onClick={() => run(false)}
            disabled={!!running || !dirExists}
            className="flex-1 px-5 py-3 rounded-full text-[#f0f0f0] text-[11px] font-black tracking-widest hover:opacity-90 transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {running === 'run' ? 'TŘÍDÍM...' : 'ROZTŘÍDIT TEĎ'}
          </button>
        </div>
        {runError && <div className="mt-3 text-[11px] font-mono text-[#ff6b6b]">{runError}</div>}
        {result && (
          <div className="mt-3 text-[11px] font-mono">
            <div className={`whitespace-pre-line ${result.errors.length ? 'text-[#ff6b6b]' : 'text-[#f0f0f0]'}`}>
              {result.dryRun ? '👁 NÁHLED · ' : ''}{result.message}
            </div>
            {result.movedFiles.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5 text-[10px] text-[#9a9a9a]">
                {result.movedFiles.map((m, i) => (
                  <div key={i} className="truncate">{m.file} → {m.folder}/{m.target !== m.file ? m.target : ''}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
