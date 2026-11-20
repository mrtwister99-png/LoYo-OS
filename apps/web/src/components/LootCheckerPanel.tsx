// D:\dev\loyo-os\apps\web\src\components\LootCheckerPanel.tsx
// LOYO OS // LOOT CHECKER — panel v detailu agenta (Agenti → Loot Checker)
// VZOR: apps/web/src/components/TridilPanel.tsx — stejný styl, stejný API pattern, žádná ui/ složka v agentovi
import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ACCENT = '#12a4ff'

type TargetFolder = { name: string; path: string; description: string; belongs: string; notBelongs: string }
type LootConfig = { dir: string; fallbackFolder: string; targetFolders: TargetFolder[]; visionModel: string; confidenceThreshold: number; belowThreshold: 'leave' | 'ostatni' }

type SortResult = {
  message: string
  dryRun: boolean
  model: string
  threshold: number
  sorted: number
  sortedFiles: { file: string; from: string; to: string; folder: string; confidence: number; reason: string }[]
  lowConfidence: { file: string; folder: string; confidence: number; reason: string }[]
  lowCount: number
  skipped: number
  errors: { file: string; error: string }[]
  txtPath: string | null
  reportPath?: string | null
}

type RunResult = {
  message: string
  dryRun: boolean
  kept: number
  moved: number
  movedFiles: { file: string; from: string; to: string; original: string }[]
  errors: { file: string; error: string }[]
  txtPath: string | null
  kosDir: string
  reportPath?: string | null
}

type LootJob = {
  id: string
  kind: 'duplicity' | 'sort'
  dryRun: boolean
  status: 'running' | 'done' | 'error'
  startedAt: string
  finishedAt: string | null
  progress: { done: number; total: number; current: string }
  message: string | null
  result: any | null
  reportPath: string | null
  error: string | null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new Error('API neběží (localhost:3001), spusť pnpm dev v apps/api')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json as T
}

export default function LootCheckerPanel() {
  const [cfg, setCfg] = useState<LootConfig | null>(null)
  const [dirInput, setDirInput] = useState('')
  const [resolvedDir, setResolvedDir] = useState('')
  const [dirExists, setDirExists] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [createdInfo, setCreatedInfo] = useState('')
  const [restoredFromBackup, setRestoredFromBackup] = useState(false)
  const [running, setRunning] = useState<'' | 'preview' | 'run'>('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState('')
  const [sortRunning, setSortRunning] = useState<'' | 'preview' | 'run'>('')
  const [sortResult, setSortResult] = useState<SortResult | null>(null)
  const [sortError, setSortError] = useState('')
  // V5 - behy na pozadi: joby preziji zavreni okna, po navratu se panel zase napoji
  const [jobs, setJobs] = useState<LootJob[]>([])
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentJob, setCurrentJob] = useState<LootJob | null>(null)
  // Animace tecek: KONTROLUJI. -> .. -> ... -> . dokola, dokud to bezi
  const [dots, setDots] = useState(1)
  const isBusy = running !== '' || sortRunning !== ''
  useEffect(() => {
    if (!isBusy) return
    setDots(1)
    const id = setInterval(() => setDots((d) => (d >= 3 ? 1 : d + 1)), 450)
    return () => clearInterval(id)
  }, [isBusy])
  const dotsStr = '.'.repeat(dots)

  const load = async () => {
    setLoadError('')
    try {
      const r = await api<{ config: LootConfig; resolvedDir: string; dirExists: boolean }>('/api/agents/loot-checker/config')
      // Migrace starých configů: description -> Patří / Nepatří (split na "Nepatří sem:")
      const migrated = {
        ...r.config,
        targetFolders: (r.config.targetFolders || []).map((f: any) => {
          if (typeof f.belongs === 'string') return { belongs: '', notBelongs: '', ...f }
          const desc = (f.description || '') as string
          const idx = desc.indexOf('Nepatří sem:')
          if (idx >= 0) return { ...f, belongs: desc.slice(0, idx).trim(), notBelongs: desc.slice(idx + 'Nepatří sem:'.length).trim(), description: desc }
          return { ...f, belongs: desc, notBelongs: '', description: desc }
        }),
      }
      // Zalohovani: kdyz API vrati prazdne slozky (napr. config.json prepsal novy zip), obnov ze zalohy prohlizece
      let finalCfg: any = migrated
      try {
        const backupRaw = localStorage.getItem('loot-checker-targetFolders')
        const backup = backupRaw ? JSON.parse(backupRaw) : []
        const apiEmpty = !(migrated as any).targetFolders || (migrated as any).targetFolders.length === 0
        if (apiEmpty && Array.isArray(backup) && backup.length > 0) {
          finalCfg = { ...(migrated as any), targetFolders: backup }
          setRestoredFromBackup(true)
          // Hned to zapis zpet na disk, at to drzi i po restartu
          fetch(`${API_URL}/api/agents/loot-checker/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetFolders: backup }) }).catch(() => {})
        }
      } catch {}
      setCfg(finalCfg)
      setDirInput(r.config.dir)
      setResolvedDir(r.resolvedDir)
      setDirExists(r.dirExists)
    } catch (e: any) {
      setLoadError(e.message)
    }
  }
  // V5 - po navratu (i po zavreni okna) nacti joby a napoj se na bezici job
  const loadJobs = async () => {
    try {
      const r = await api<{ jobs: LootJob[] }>('/api/agents/loot-checker/jobs')
      setJobs(r.jobs || [])
      const runningJob = (r.jobs || []).find((j) => j.status === 'running')
      if (runningJob) {
        setCurrentJobId(runningJob.id)
        setCurrentJob(runningJob)
        if (runningJob.kind === 'duplicity') setRunning(runningJob.dryRun ? 'preview' : 'run')
        else setSortRunning(runningJob.dryRun ? 'preview' : 'run')
      } else {
        // Posledni dokonceny job - ukaz vysledek i po navratu
        const lastDone = (r.jobs || []).find((j) => j.status === 'done' || j.status === 'error')
        if (lastDone && lastDone.result) {
          if (lastDone.kind === 'duplicity') {
            const res = lastDone.result
            setResult({ message: lastDone.message || '', dryRun: lastDone.dryRun, kept: res.kept ?? 0, moved: res.moved?.length ?? 0, movedFiles: (res.moved || []).slice(0, 200), errors: res.errors || [], txtPath: res.txtPath || null, kosDir: res.kosDir || 'data/kos', reportPath: lastDone.reportPath })
          } else {
            const res = lastDone.result
            setSortResult({ message: lastDone.message || '', dryRun: lastDone.dryRun, model: res.model || '', threshold: res.threshold ?? 0, sorted: res.sorted?.length ?? 0, sortedFiles: (res.sorted || []).slice(0, 200), lowConfidence: res.lowConfidence || [], lowCount: res.lowConfidence?.length ?? 0, skipped: res.skipped?.length ?? 0, errors: res.errors || [], txtPath: res.txtPath || null, reportPath: lastDone.reportPath })
          }
        }
      }
    } catch {}
  }
  useEffect(() => { load(); loadJobs() }, [])
  // Polling beziciho jobu kazde 2s - prezije i zavreni okna, protoze job bezi na API, ne ve frontendu
  useEffect(() => {
    if (!currentJobId) return
    const id = setInterval(async () => {
      try {
        const r = await api<{ job: LootJob }>(`/api/agents/loot-checker/jobs/${currentJobId}`)
        const job = r.job
        setCurrentJob(job)
        setJobs((prev) => { const next = prev.map((j) => (j.id === job.id ? job : j)); return next.some((j) => j.id === job.id) ? next : [job, ...prev] })
        if (job.status !== 'running') {
          clearInterval(id)
          setCurrentJobId(null)
          if (job.kind === 'duplicity') {
            setRunning('')
            if (job.result) {
              const res = job.result
              setResult({ message: job.message || '', dryRun: job.dryRun, kept: res.kept ?? 0, moved: res.moved?.length ?? 0, movedFiles: (res.moved || []).slice(0, 200), errors: res.errors || [], txtPath: res.txtPath || null, kosDir: res.kosDir || 'data/kos', reportPath: job.reportPath })
            } else if (job.error) setRunError(job.error)
          } else {
            setSortRunning('')
            if (job.result) {
              const res = job.result
              setSortResult({ message: job.message || '', dryRun: job.dryRun, model: res.model || '', threshold: res.threshold ?? 0, sorted: res.sorted?.length ?? 0, sortedFiles: (res.sorted || []).slice(0, 200), lowConfidence: res.lowConfidence || [], lowCount: res.lowConfidence?.length ?? 0, skipped: res.skipped?.length ?? 0, errors: res.errors || [], txtPath: res.txtPath || null, reportPath: job.reportPath })
            } else if (job.error) setSortError(job.error)
          }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(id)
  }, [currentJobId])

  const save = async (patch: Partial<LootConfig>) => {
    setSaveMsg('')
    try {
      const r = await api<{ config: LootConfig; resolvedDir: string; dirExists: boolean; createdFolders?: string[]; ensureErrors?: { folder: string; error: string }[] }>('/api/agents/loot-checker/config', {
        method: 'POST',
        body: JSON.stringify(patch),
      })
      // Po ulozeni slozek: potvrdit pocet + cas, at je jasne ze to drzi do priste
      const savedCfg: any = r.config
      if (patch && (patch as any).targetFolders) {
        try { localStorage.setItem('loot-checker-targetFolders', JSON.stringify((patch as any).targetFolders)) } catch {}
        setLastSavedAt(new Date().toLocaleString('cs-CZ'))
        const names = ((patch as any).targetFolders || []).map((f: any) => f.name).filter(Boolean).join(', ')
        const created = (r as any).createdFolders || []
        const ensureErrs = (r as any).ensureErrors || []
        if (ensureErrs.length > 0) {
          setSaveMsg(`✕ Složky uloženy, ale nevytvořeno: ${ensureErrs.map((e: any) => e.folder + ': ' + e.error).join(', ')}`)
          setCreatedInfo('')
        } else if (created.length > 0) {
          const short = created.map((p: string) => p.split(/[\\/]/).pop()).join(', ')
          setSaveMsg(`✓ Uloženo — ${(patch as any).targetFolders.length} složky (${names}) zůstanou i po restartu`)
          setCreatedInfo(`✓ Vytvořeno na disku: ${created.length} nové složky (${short})`)
        } else {
          setSaveMsg(`✓ Uloženo — ${(patch as any).targetFolders.length} složky (${names}) zůstanou i po restartu`)
          setCreatedInfo(`✓ Všechny složky už existují na disku — nic nového nebylo potřeba vytvořit`)
        }
        // Migrace zpet pro UI (belongs/notBelongs)
        const migratedSaved = { ...savedCfg, targetFolders: ((patch as any).targetFolders || []) }
        setCfg(migratedSaved as any)
      } else {
        setCfg(savedCfg)
        setSaveMsg('✓ uloženo')
        setTimeout(() => setSaveMsg(''), 1500)
      }
      setResolvedDir(r.resolvedDir)
      setDirExists(r.dirExists)
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

  // V5 - POST jen zalozí job na pozadi a hned vrátí jobId. Vysledek prijde pollingem, i kdyz zavres okno.
  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'preview' : 'run')
    setRunError('')
    setResult(null)
    try {
      const r = await api<{ jobId: string; status: string; message: string; job?: LootJob }>('/api/agents/loot-checker/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun }),
      })
      if (r.jobId) setCurrentJobId(r.jobId)
      else setRunning('')
    } catch (e: any) {
      // 409 = uz bezi na pozadi - napoj se na nej
      const msg = e.message || ''
      if (msg.includes('uz bezi')) { loadJobs() } else { setRunError(msg); setRunning('') }
    }
  }

  const runSort = async (dryRun: boolean) => {
    setSortRunning(dryRun ? 'preview' : 'run')
    setSortError('')
    setSortResult(null)
    try {
      const r = await api<{ jobId: string; status: string; message: string; job?: LootJob }>('/api/agents/loot-checker/sort', {
        method: 'POST',
        body: JSON.stringify({ dryRun, model: cfg?.visionModel, threshold: cfg?.confidenceThreshold }),
      })
      if (r.jobId) setCurrentJobId(r.jobId)
      else setSortRunning('')
    } catch (e: any) {
      const msg = e.message || ''
      if (msg.includes('uz bezi')) { loadJobs() } else { setSortError(msg); setSortRunning('') }
    }
  }

  // --- Cílové složky: Název + Popis (pro FÁZI 2) ---
  const updateFolder = (idx: number, key: keyof TargetFolder, v: string) => {
    if (!cfg) return
    const next = [...cfg.targetFolders]
    const cur = { ...next[idx], [key]: v }
    // description držíme v syncu pro backend / staré configy: Patří + Nepatří
    if (key === 'belongs' || key === 'notBelongs') {
      cur.description = `${cur.belongs || ''}${cur.notBelongs ? ` Nepatří sem: ${cur.notBelongs}` : ''}`.trim()
    }
    next[idx] = cur
    setCfg({ ...cfg, targetFolders: next })
  }
  const addFolder = () => {
    if (!cfg) return
    setCfg({ ...cfg, targetFolders: [...cfg.targetFolders, { name: '', path: '', description: '', belongs: '', notBelongs: '' }] })
  }
  const removeFolder = (idx: number) => {
    if (!cfg) return
    setCfg({ ...cfg, targetFolders: cfg.targetFolders.filter((_, i) => i !== idx) })
  }
  const saveFolders = () => {
    if (!cfg) return
    // Prazdne radky (jen kliknute + PRIDAT, ale nevyplnene) pred ulozenim vyhod - jinak by API vratilo 400 a nic by se neulozilo
    const cleaned = cfg.targetFolders.filter((f) => f.name && f.name.trim() !== '')
    if (cleaned.length !== cfg.targetFolders.length) {
      setCfg({ ...cfg, targetFolders: cleaned })
    }
    if (cleaned.length === 0) { setSaveMsg('✕ Nejdřív vyplň aspoň Název složky'); return }
    return save({ targetFolders: cleaned })
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
        <div className="text-[11px] font-bold tracking-[0.2em]">LOOT CHECKER — DUPLICITY</div>
        <div className="mt-2 text-[11px] font-mono text-[#ff6b6b]">{loadError}</div>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-full border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">ZKUSIT ZNOVU</button>
      </div>
    )
  }
  if (!cfg) return <div className="text-[11px] font-mono text-[#9a9a9a]">Načítám nastavení Loot Checkera...</div>

  return (
    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">LOOT CHECKER — DUPLICITY</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">FÁZE 1 duplicity + FÁZE 2 vision · jen přesun, nikdy nemazat</div>
        </div>
        {saveMsg && <div className={`text-[10px] font-mono ${saveMsg.startsWith('✕') ? 'text-[#ff6b6b]' : 'text-[#9a9a9a]'}`}>{saveMsg}</div>}
      </div>

      {/* V5 - BEZI NA POZADI: prezije zavreni okna, po navratu se ukaze prubeh */}
      {currentJob && currentJob.status === 'running' && (
        <div className="p-3 rounded-xl border border-[#22c55e] bg-[#22c55e]/10 space-y-1">
          <div className="text-[11px] font-black tracking-widest text-[#22c55e]">BEŽÍ NA POZADÍ — MŮŽEŠ ZAVŘÍT OKNO, DOBĚHNE TO SAMO</div>
          <div className="text-[11px] font-mono text-[#f0f0f0]">{currentJob.kind === 'duplicity' ? 'FÁZE 1 duplicity' : 'FÁZE 2 třídění'} {currentJob.dryRun ? '(kontrola, nic se nepřesouvá)' : '(naostro)'} — {currentJob.progress.done} / {currentJob.progress.total || '?'}</div>
          {currentJob.progress.total > 0 && (
            <div className="h-2 rounded-full bg-[#444] overflow-hidden"><div className="h-full bg-[#22c55e] transition-all" style={{ width: `${Math.round((currentJob.progress.done / currentJob.progress.total) * 100)}%` }} /></div>
          )}
          {currentJob.progress.current && <div className="text-[10px] font-mono text-[#9a9a9a]">Aktuálně: {currentJob.progress.current}</div>}
          <div className="text-[10px] font-mono text-[#9a9a9a]">Po dokončení: report do data/reports + zpráva do chatu + aktivita. Nemusíš tu čekat.</div>
        </div>
      )}
      {jobs.length > 0 && (
        <div className="p-3 rounded-xl border border-[#444] space-y-1">
          <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">POSLEDNÍ BĚHY (přežijí zavření okna)</div>
          {jobs.slice(0, 5).map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#9a9a9a]">
              <span>{j.kind === 'duplicity' ? 'FÁZE 1' : 'FÁZE 2'} {j.dryRun ? 'kontrola' : 'naostro'} · {new Date(j.startedAt).toLocaleString('cs-CZ')} · {j.status === 'running' ? `BĚŽÍ ${j.progress.done}/${j.progress.total}` : j.status === 'done' ? 'HOTOVO' : 'CHYBA'}</span>
              {j.reportPath && <span className="text-[#22c55e]">📄 {j.reportPath.split(/[\\/]/).pop()}</span>}
            </div>
          ))}
        </div>
      )}

      {/* CESTA DO SLOŽKY */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">CESTA DO SLOŽKY — ZDROJ</div>
        <div className="mt-2 flex gap-2">
          <input
            value={dirInput}
            onChange={(e) => setDirInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirInput !== cfg.dir) save({ dir: dirInput }) }}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#444] bg-transparent text-[12px] font-mono outline-none focus:border-[#12a4ff]"
            placeholder="D:\loot\nesetrideno"
          />
          <button onClick={pickFolder} className="shrink-0 px-3.5 py-2.5 rounded-xl border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] hover:border-[#12a4ff] transition">VYBRAT…</button>
          {dirInput !== cfg.dir && (
            <button onClick={() => save({ dir: dirInput })} className="shrink-0 px-3.5 py-2.5 rounded-xl text-[10px] font-black tracking-widest text-[#f0f0f0]" style={{ background: ACCENT }}>ULOŽIT</button>
          )}
        </div>
        <div className={`mt-1.5 text-[10px] font-mono ${dirExists ? 'text-[#9a9a9a]/70' : 'text-[#ff6b6b]'}`}>
          {dirExists ? `→ ${resolvedDir} · koš: data/kos/` : `složka neexistuje: ${resolvedDir}`}
        </div>
      </div>

      {/* CÍLOVÉ SLOŽKY — NÁZEV + POPIS */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">CÍLOVÉ SLOŽKY — PRO FÁZI 2 · Patří / Nepatří jde vision modelu</div>
        <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">ULOŽIT SLOŽKY = uloží do config.json + rovnou vytvoří chybějící složky na disku, zůstanou i po restartu a po rozbalení nové verze (nové zipy config.json neobsahují). Záloha je i v prohlížeči.</div>
        {lastSavedAt && <div className="mt-1 text-[10px] font-mono text-[#22c55e]">✓ Naposledy uloženo: {lastSavedAt} — {cfg.targetFolders.length} složky</div>}
        {restoredFromBackup && <div className="mt-1 text-[10px] font-mono text-[#22c55e]">✓ Obnoveno ze zálohy prohlížeče — config.json byl přepsán, složky jsem vrátil zpět a uložil znovu na disk.</div>}
        {createdInfo && <div className="mt-1 text-[10px] font-mono text-[#22c55e]">{createdInfo}</div>}
        <div className="mt-2 space-y-2">
          {cfg.targetFolders.map((f, idx) => (
            <div key={idx} className="p-3 rounded-xl border border-[#444] space-y-2">
              <div className="flex gap-2">
                <input
                  value={f.name}
                  onChange={(e) => updateFolder(idx, 'name', e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#444] bg-transparent text-[12px] font-mono outline-none focus:border-[#12a4ff]"
                  placeholder="Název složky — např. zbrane"
                />
                <button onClick={() => removeFolder(idx)} className="shrink-0 px-3 py-2 rounded-xl border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#ff6b6b] transition">SMAZAT</button>
              </div>
              <div>
                <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">PATŘÍ</div>
                <textarea
                  value={f.belongs || ''}
                  onChange={(e) => updateFolder(idx, 'belongs', e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#444] bg-transparent text-[12px] outline-none focus:border-[#12a4ff]"
                  placeholder="Co tam patří: Celá abeceda A-Z v řadách, font specimen, typografie..."
                />
              </div>
              <div>
                <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">NEPATŘÍ</div>
                <textarea
                  value={f.notBelongs || ''}
                  onChange={(e) => updateFolder(idx, 'notBelongs', e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#444] bg-transparent text-[12px] outline-none focus:border-[#12a4ff]"
                  placeholder="Co tam nepatří: jeden nápis / slovo, meme s textem, logo, obrázek bez písmen..."
                />
              </div>
              <input
                value={f.path}
                onChange={(e) => updateFolder(idx, 'path', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#444] bg-transparent text-[12px] font-mono outline-none focus:border-[#12a4ff]"
                placeholder="Cesta (volitelné, prázdné = zdroj / název)"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={addFolder} className="px-4 py-2.5 rounded-xl border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">+ PŘIDAT SLOŽKU</button>
          <button onClick={saveFolders} className="px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest text-[#f0f0f0]" style={{ background: ACCENT }}>ULOŽIT + VYTVOŘIT SLOŽKY</button>
        </div>
      </div>

      {/* SPUŠTĚNÍ KROKU 1 */}
      <div className="flex gap-2">
        <button onClick={() => run(true)} disabled={running !== '' || sortRunning !== ''} className="flex-1 px-4 py-2.5 rounded-xl border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition disabled:opacity-100" style={running === 'preview' ? { color: '#22c55e', borderColor: '#22c55e' } : undefined}>
          {running === 'preview' ? `KONTROLUJI${dotsStr}` : '🔍 ZKONTROLOVAT DUPLICITY'}
        </button>
        <button onClick={() => run(false)} disabled={running !== '' || sortRunning !== ''} className="flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest text-[#f0f0f0] disabled:opacity-100" style={running === 'run' ? { background: 'transparent', color: '#ff5555', border: '1px solid #ff5555' } : { background: ACCENT }}>
          {running === 'run' ? `Pracuji${dotsStr}` : '♻️ PŘESUNOUT DO KOŠE'}
        </button>
      </div>

      {runError && <div className="text-[11px] font-mono text-[#ff6b6b]">{runError}</div>}
      {result && (
        <div className="p-3 rounded-xl border border-[#444] space-y-1">
          <div className="text-[12px] font-bold">{result.message}</div>
          <div className="text-[11px] font-mono text-[#9a9a9a]">Ponecháno: {result.kept} · Přesunuto / k přesunu: {result.moved} · Koš: {result.kosDir}</div>
          {result.txtPath && <div className="text-[11px] font-mono text-[#9a9a9a]">📄 Seznam: {result.txtPath}</div>}
          {result.reportPath && <div className="text-[11px] font-mono text-[#9a9a9a]">📄 Report: {result.reportPath} — nic nebylo smazáno, jen přesunuto</div>}
          {result.movedFiles.slice(0, 20).map((m, i) => (
            <div key={i} className="text-[11px] font-mono text-[#9a9a9a]">• {m.file} → koš <span className="opacity-60">(originál: {m.original})</span></div>
          ))}
          {result.errors.map((e, i) => (
            <div key={'e' + i} className="text-[11px] font-mono text-[#ff6b6b]">✕ {e.file}: {e.error}</div>
          ))}
        </div>
      )}

      {/* ============ FÁZE 2 — VISION TŘÍDĚNÍ ============ */}
      <div className="pt-2 border-t border-[#444] space-y-4">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">FÁZE 2 — VISION TŘÍDĚNÍ</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">Model čte Patří / Nepatří každé složky a obrázek zařadí sám.</div>
        </div>

        <div>
          <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">VISION MODEL — musí být stažený v Ollama</div>
          <div className="mt-2 flex gap-2">
            <select
              value={cfg.visionModel || 'moondream'}
              onChange={(e) => { const v = e.target.value; setCfg({ ...cfg, visionModel: v }); save({ visionModel: v }) }}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#444] bg-transparent text-[12px] font-mono outline-none focus:border-[#12a4ff]"
            >
              <option value="moondream">moondream — lehký, rychlý</option>
              <option value="qwen2.5vl:7b">qwen2.5vl:7b — těžší, přesnější</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">PRÁH JISTOTY 0–100</div>
            <input
              type="number" min={0} max={100}
              value={cfg.confidenceThreshold ?? 60}
              onChange={(e) => cfg && setCfg({ ...cfg, confidenceThreshold: Number(e.target.value) })}
              onBlur={() => save({ confidenceThreshold: cfg.confidenceThreshold })}
              className="mt-2 w-full px-3 py-2.5 rounded-xl border border-[#444] bg-transparent text-[12px] font-mono outline-none focus:border-[#12a4ff]"
            />
            <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">Pod prahem se obrázek nepřesouvá.</div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">POD PRAHEM</div>
            <select
              value={cfg.belowThreshold || 'leave'}
              onChange={(e) => { const v = e.target.value as 'leave' | 'ostatni'; setCfg({ ...cfg, belowThreshold: v }); save({ belowThreshold: v }) }}
              className="mt-2 w-full px-3 py-2.5 rounded-xl border border-[#444] bg-transparent text-[12px] outline-none"
            >
              <option value="leave">Nechat na místě</option>
              <option value="ostatni">Přesunout do ostatní</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => runSort(true)} disabled={sortRunning !== '' || running !== ''} className="flex-1 px-4 py-2.5 rounded-xl border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition disabled:opacity-100" style={sortRunning === 'preview' ? { color: '#22c55e', borderColor: '#22c55e' } : undefined}>
            {sortRunning === 'preview' ? `KONTROLUJI${dotsStr}` : '🧠 ZKONTROLOVAT TŘÍDĚNÍ'}
          </button>
          <button onClick={() => runSort(false)} disabled={sortRunning !== '' || running !== ''} className="flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest text-[#f0f0f0] disabled:opacity-100" style={sortRunning === 'run' ? { background: 'transparent', color: '#ff5555', border: '1px solid #ff5555' } : { background: ACCENT }}>
            {sortRunning === 'run' ? `Pracuji${dotsStr}` : '🧠 TŘÍDIT OBRÁZKY'}
          </button>
        </div>

        {sortError && <div className="text-[11px] font-mono text-[#ff6b6b]">{sortError}</div>}
        {sortResult && (
          <div className="p-3 rounded-xl border border-[#444] space-y-1">
            <div className="text-[12px] font-bold">{sortResult.message}</div>
            <div className="text-[11px] font-mono text-[#9a9a9a]">Model: {sortResult.model} · Práh: {sortResult.threshold} · Roztříděno: {sortResult.sorted} · Necháno (nízká jistota): {sortResult.lowCount}</div>
            {sortResult.reportPath && <div className="text-[11px] font-mono text-[#9a9a9a]">📄 Report: {sortResult.reportPath} — nic nebylo smazáno, jen přesunuto</div>}
            {sortResult.sortedFiles.slice(0, 20).map((m, i) => (
              <div key={i} className="text-[11px] font-mono text-[#9a9a9a]">• {m.file} → {m.folder}/ <span className="opacity-60">({m.confidence}% · {m.reason})</span></div>
            ))}
            {sortResult.lowConfidence.slice(0, 10).map((m, i) => (
              <div key={'l' + i} className="text-[11px] font-mono text-[#9a9a9a]">• {m.file} → NECHÁNO <span className="opacity-60">(navrhoval {m.folder}, {m.confidence}% · {m.reason})</span></div>
            ))}
            {sortResult.errors.map((e, i) => (
              <div key={'se' + i} className="text-[11px] font-mono text-[#ff6b6b]">✕ {e.file}: {e.error}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
