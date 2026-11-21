// apps/web/src/components/ActivityLog.tsx — živý log akcí v horní liště
// V liště: poslední akce (nová = bliknutí). Klik → přes celou šířku se rozjede seznam posledních akcí;
// záznam jde rozkliknout: detail (meta) + odkaz na job (run log / report / agent).
import { useEffect, useRef, useState } from 'react'
import { openExternal } from './LinkifiedText'

const API_URL = 'http://localhost:3001'

type Ev = { id: string; ts: string; agent: string; type: string; action: string; meta?: Record<string, any> }

const ICON: Record<string, string> = { chat: '💬', routing: '🧭', research: '🔎', cli: '⚙', save: '💾', error: '❌', system: '⚡' }
const ago = (ts: string) => {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) return `${Math.round(s / 3600)} h`
  return new Date(ts).toLocaleDateString('cs-CZ')
}

function JobLinks({ ev }: { ev: Ev }) {
  const [runLog, setRunLog] = useState<string | null>(null)
  const m = ev.meta ?? {}
  const runId = m.runId ?? m.run_id ?? m.jobId
  const files = [m.file, m.report, m.path, m.target].filter((x) => typeof x === 'string' && /[\\/]/.test(x)) as string[]
  const urls = Object.values(m).filter((x) => typeof x === 'string' && /^https?:\/\//.test(x)) as string[]
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {runId && (
          <button onClick={async () => {
            if (runLog) { setRunLog(null); return }
            const r = await fetch(`${API_URL}/api/logs/runs/${encodeURIComponent(runId)}`).then((x) => x.json()).catch(() => null)
            setRunLog(r ? JSON.stringify(r, null, 2) : 'Run log nenalezen.')
          }} className="px-2 py-1 text-[10px] font-bold border border-[#12a4ff] text-[#7cc8ff] hover:bg-[#12a4ff]/10">📄 RUN LOG {String(runId).slice(0, 18)}</button>
        )}
        {files.map((f) => (
          <button key={f} onClick={() => navigator.clipboard?.writeText(f)} title="Zkopírovat cestu"
            className="px-2 py-1 text-[10px] font-mono border border-[#444] text-[#cfcfcf] hover:border-[#facc15] max-w-full truncate">📁 {f}</button>
        ))}
        {urls.map((u) => (
          <button key={u} onClick={() => openExternal(u)} className="px-2 py-1 text-[10px] font-mono border border-[#444] text-[#7cc8ff] hover:border-[#12a4ff] truncate max-w-[340px]">🔗 {u}</button>
        ))}
        <button onClick={() => window.dispatchEvent(new CustomEvent('loyo:navigate', { detail: { page: 'agenti', agent: ev.agent } }))}
          className="px-2 py-1 text-[10px] font-bold border border-[#444] text-[#9a9a9a] hover:text-[#f0f0f0]">🤖 {ev.agent} →</button>
      </div>
      {Object.keys(m).length > 0 && (
        <pre className="text-[10px] font-mono bg-[#232323] border border-[#3a3a3a] p-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto text-[#bdbdbd]">{JSON.stringify(m, null, 2)}</pre>
      )}
      {runLog && <pre className="text-[10px] font-mono bg-[#232323] border border-[#12a4ff]/40 p-2 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{runLog}</pre>}
    </div>
  )
}

export default function ActivityLog() {
  const [events, setEvents] = useState<Ev[]>([])
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const j = await fetch(`${API_URL}/api/activity?limit=80`).then((r) => r.json())
        const evs: Ev[] = j.events ?? []
        if (!alive) return
        if (known.current) {
          const nw = evs.filter((e) => !known.current!.has(e.id)).map((e) => e.id)
          if (nw.length) { setFresh(new Set(nw)); setTimeout(() => setFresh(new Set()), 4000) }
        }
        known.current = new Set(evs.map((e) => e.id))
        setEvents(evs)
      } catch {}
    }
    load()
    const t = setInterval(load, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const last = events[0]
  const isFresh = last && fresh.has(last.id)
  const shown = filter ? events.filter((e) => `${e.agent} ${e.action}`.toLowerCase().includes(filter.toLowerCase())) : events

  return (
    <>
      <style>{`
        @keyframes logFlash { 0%,100% { background: transparent; } 30% { background: rgba(250,204,21,0.18); } }
        @keyframes logDrop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
      `}</style>
      <button onClick={() => setOpen((v) => !v)} title="Log akcí — klikni pro celý seznam"
        className="w-full h-full flex flex-col items-center justify-center min-w-0 px-1"
        style={{ animation: isFresh ? 'logFlash 1.2s ease-in-out 2' : undefined, borderRadius: 6 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 800, letterSpacing: '0.1em', color: '#ff1e00', textTransform: 'uppercase', lineHeight: 1 }}>
          Aktivita {open ? '▴' : '▾'}
        </span>
        <span className="w-full truncate text-center" style={{ fontSize: 9, color: isFresh ? '#facc15' : '#9a9a9a', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
          {last ? `${ICON[last.type] ?? '•'} ${last.agent}: ${last.action}` : '—'}
        </span>
      </button>

      {open && (
        <div className="fixed left-[2.5%] right-[2.5%] top-[52px] z-[90] bg-[#2b2b2b] border border-[#444] shadow-[0_24px_60px_rgba(0,0,0,0.55)] flex flex-col"
          style={{ maxHeight: '72vh', animation: 'logDrop 0.18s ease-out', borderTop: '2px solid #ff1e00' }}>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[#444] shrink-0">
            <span className="text-[11px] font-black tracking-[0.25em]">⚡ LOG AKCÍ</span>
            <span className="text-[10px] opacity-50">{events.length} posledních · živě</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filtr (agent / akce)…"
              className="ml-auto w-56 bg-[#3a3a3a] border border-[#444] px-2 py-1 text-[11px] outline-none focus:border-[#12a4ff]" />
            <button onClick={() => setOpen(false)} className="w-7 h-7 bg-white/5 hover:bg-[#444]">✕</button>
          </div>
          <div className="overflow-y-auto">
            {shown.map((e) => {
              const ex = expanded === e.id
              return (
                <div key={e.id} className={`border-b border-[#3a3a3a] ${fresh.has(e.id) ? 'bg-[#facc15]/10' : ''}`}>
                  <button onClick={() => setExpanded(ex ? null : e.id)} className="w-full flex items-center gap-3 px-4 py-1.5 text-left hover:bg-[#333]">
                    <span className="w-14 shrink-0 text-[10px] font-mono opacity-50 text-right" title={new Date(e.ts).toLocaleString('cs-CZ')}>{ago(e.ts)}</span>
                    <span className="w-4 shrink-0 text-center">{ICON[e.type] ?? '•'}</span>
                    <span className="w-32 shrink-0 text-[10px] font-black truncate" style={{ color: e.type === 'error' ? '#ff6b6b' : '#7cc8ff' }}>{e.agent}</span>
                    <span className="flex-1 min-w-0 text-[11px] truncate">{e.action}</span>
                    <span className="text-[10px] opacity-40">{ex ? '▴' : '▾'}</span>
                  </button>
                  {ex && (
                    <div className="px-4 pb-3 pl-[7.5rem]">
                      <div className="text-[11px] whitespace-pre-wrap break-words">{e.action}</div>
                      <div className="text-[9px] opacity-40 mt-1">{new Date(e.ts).toLocaleString('cs-CZ')} · {e.type} · id {e.id.slice(0, 8)}</div>
                      <JobLinks ev={e} />
                    </div>
                  )}
                </div>
              )
            })}
            {!shown.length && <div className="px-4 py-6 text-center text-[11px] opacity-40">Nic tu není.</div>}
          </div>
        </div>
      )}
    </>
  )
}
