// D:\dev\loyo-os\apps\web\src\pages\Activity.tsx
import { useEffect, useRef, useState } from 'react'

type ActivityEvent = {
  id: string
  ts: string
  agent: string
  type: string
  action: string
  meta?: Record<string, unknown>
}

const AGENT_COLORS: Record<string, string> = {
  Mary_Jane: '#1000a1',
  Lubor_Nehleda: '#ae1710',
  SYSTEM: '#7a7a7a',
}

const TYPE_LABELS: Record<string, string> = {
  routing: 'ROUTING',
  chat: 'CHAT',
  report: 'REPORT',
  error: 'CHYBA',
  system: 'SYSTÉM',
  cli: 'CLI',
  save: 'ULOŽENO',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hod = Math.floor(min / 60)
  if (hod < 24) return `${hod}h`
  const den = Math.floor(hod / 24)
  return `${den}d`
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function Activity() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [logModal, setLogModal] = useState<{ runId: string; data: any; loading: boolean; error?: string } | null>(null)
  const pollRef = useRef<number | null>(null)

  const load = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterAgent !== 'all') params.set('agent', filterAgent)
      const res = await fetch(`/api/activity?${params.toString()}`)
      const data = await res.json()
      setEvents(data.events || [])
      setError(null)
    } catch {
      setError('Nepodařilo se načíst activity feed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    pollRef.current = window.setInterval(load, 5000)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgent])

  const openRunLog = async (runId: string) => {
    setLogModal({ runId, data: null, loading: true })
    try {
      const res = await fetch(`/api/logs/runs/${runId}`)
      if (!res.ok) throw new Error('Log nenalezen')
      const data = await res.json()
      setLogModal({ runId, data, loading: false })
    } catch {
      setLogModal({ runId, data: null, loading: false, error: 'Nepodařilo se načíst log běhu.' })
    }
  }

  const deleteRunLog = async (runId: string) => {
    if (!confirm('Opravdu trvale smazat tento log ze disku?')) return
    try {
      const res = await fetch(`/api/logs/runs/${runId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Smazání selhalo')
      // teprve po úspěšném smazání na backendu zavřeme modal (odebrání ze state)
      setLogModal(null)
    } catch {
      setLogModal(prev => prev ? { ...prev, error: 'Nepodařilo se smazat log na disku.' } : prev)
    }
  }

  const clearFeed = async () => {
    if (!confirm('Opravdu vymazat celý activity feed?')) return
    await fetch('/api/activity', { method: 'DELETE' })
    load()
  }

  const agents = Array.from(new Set(events.map(e => e.agent)))

  return (
    <div className="p-6 md:p-10 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-[0.15em]">ACTIVITY</h1>
          <p className="text-xs opacity-50 font-mono mt-1">reálný záznam toho, co agenti dělají</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="bg-white/10 text-white text-xs font-mono px-3 py-2 rounded outline-none border border-white/10"
          >
            <option value="all">Všichni agenti</option>
            {agents.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
          </select>
          <button
            onClick={load}
            className="text-xs font-bold px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
          >
            ⟳ Obnovit
          </button>
          <button
            onClick={clearFeed}
            className="text-xs font-bold px-3 py-2 rounded bg-[#ae1710] hover:bg-[#8a1108] transition-colors"
          >
            Vymazat
          </button>
        </div>
      </div>

      {loading && <div className="text-sm opacity-50 font-mono">Načítám...</div>}
      {error && <div className="text-sm text-[#ae1710] font-mono">{error}</div>}
      {!loading && !error && events.length === 0 && (
        <div className="text-sm opacity-40 font-mono border border-white/10 rounded p-6 text-center">
          Zatím žádná aktivita. Napiš Mary zprávu v chatu a objeví se tady.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {events.map(ev => (
          <div
            key={ev.id}
            className="flex items-start gap-4 px-4 py-3 bg-white/[0.03] border border-white/10 rounded hover:border-white/30 transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: AGENT_COLORS[ev.agent] || '#7a7a7a' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold tracking-wide">{ev.agent.replace('_', ' ')}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/20 opacity-70">
                  {TYPE_LABELS[ev.type] || ev.type.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono opacity-40 ml-auto" title={formatTime(ev.ts)}>
                  {timeAgo(ev.ts)} • {formatTime(ev.ts)}
                </span>
              </div>
              <p className="text-sm font-mono mt-1 break-words opacity-90">{ev.action}</p>
              {typeof ev.meta?.runId === 'string' && (
                <button
                  onClick={() => openRunLog(ev.meta!.runId as string)}
                  className="text-[10px] font-mono mt-2 px-2 py-1 rounded border border-white/20 opacity-70 hover:opacity-100 hover:border-white/40 transition-colors"
                >
                  🔍 Zobrazit log běhu
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {logModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setLogModal(null)}
        >
          <div
            className="bg-[#111] border border-white/20 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold font-mono opacity-70">RUN LOG — {logModal.runId}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteRunLog(logModal.runId)}
                  className="text-xs font-bold px-2 py-1 rounded bg-[#ae1710] hover:bg-[#8a1108]"
                >
                  🗑 Smazat log
                </button>
                <button
                  onClick={() => setLogModal(null)}
                  className="text-xs font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
            </div>
            {logModal.loading && <div className="text-sm opacity-50 font-mono">Načítám...</div>}
            {logModal.error && <div className="text-sm text-[#ae1710] font-mono">{logModal.error}</div>}
            {logModal.data && (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words opacity-90">
                {JSON.stringify(logModal.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
