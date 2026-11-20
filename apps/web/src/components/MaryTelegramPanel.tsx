// apps/web/src/components/MaryTelegramPanel.tsx
// LOYO OS // MARY JANE — řídicí Telegram bot (celý systém z telefonu)
import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ACCENT = '#12a4ff'

type Status = { running: boolean; pid?: number | null; configured?: boolean }
type StartResult = Status & { ok?: boolean; error?: string; started?: boolean; log?: string }

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

const COMMANDS = [
  ['/agents', 'seznam agentů'],
  ['/zapni vše', 'spustí Lopatinku + Koštěrada'],
  ['/lopatinka [rozpočet]', 'hledat výhodnou elektroniku'],
  ['/stepan <co prodáváš>', 'ocenění + inzerát'],
  ['/julia <téma>', 'hloubkový research s citacemi'],
  ['/kosterad', 'kontrola a oprava manifestů'],
  ['/activity', 'poslední akce agentů'],
  ['/boty', 'stav Telegram botů'],
]

export default function MaryTelegramPanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState('')

  const load = async () => {
    try {
      setStatus(await api<Status>('/api/agents/mary-jane/telegram'))
    } catch (e: any) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  const toggle = async () => {
    if (!status) return
    setBusy(true)
    setError('')
    setLog('')
    try {
      const r = await api<StartResult>(
        status.running ? '/api/agents/mary-jane/telegram/stop' : '/api/agents/mary-jane/telegram/start',
        { method: 'POST' },
      )
      setStatus({ running: !!r.running, pid: r.pid ?? null, configured: r.configured ?? status.configured })
      if (r.log) setLog(r.log)
    } catch (e: any) {
      setError(e.message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444] space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">MARY JANE · TELEGRAM</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">
            Celý systém z telefonu — jeden bot, Mary velí všem agentům.
          </div>
        </div>
        <div className="text-[9px] font-mono text-right shrink-0" style={{ color: status?.running ? '#1f9d55' : '#9a9a9a' }}>
          {status?.running ? `● běží (pid ${status.pid})` : '○ vypnutý'}
        </div>
      </div>

      {!status?.configured && (
        <div className="text-[10px] font-mono text-[#ffb020]">
          ⚠ Chybí <span className="font-bold">TELEGRAM_BOT_TOKEN</span> v .env. Vlož token svého bota
          z @BotFather (jeden bot stačí na všechno — Lopatinka už vlastního nemá). Chat id zjistíš
          příkazem <span className="font-bold">/id</span> a uložíš jako{' '}
          <span className="font-bold">TELEGRAM_CHAT_ID</span>.
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          disabled={busy || !status}
          className={`px-5 py-3 rounded-full text-[11px] font-black tracking-widest hover:opacity-90 transition disabled:opacity-50 ${status?.running ? 'border border-[#8a3b3b] text-[#ff8a8a]' : 'text-[#f0f0f0]'}`}
          style={status?.running ? undefined : { background: ACCENT }}
        >
          {busy ? 'PRACUJI...' : status?.running ? 'VYPNOUT BOTA' : 'ZAPNOUT BOTA'}
        </button>
        <button
          onClick={load}
          disabled={busy}
          className="px-4 py-3 rounded-full border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition disabled:opacity-50"
        >
          OBNOVIT STAV
        </button>
      </div>

      {error && <div className="text-[10px] font-mono text-[#ff6b6b]">{error}</div>}
      {log && <div className="text-[9px] font-mono text-[#9a9a9a]/60 break-all">log: {log}</div>}

      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">CO UMÍ Z TELEFONU</div>
        <div className="mt-2 space-y-1">
          {COMMANDS.map(([cmd, desc]) => (
            <div key={cmd} className="flex items-baseline justify-between gap-3 text-[10px] font-mono">
              <span className="text-[#f0f0f0]">{cmd}</span>
              <span className="text-[#9a9a9a]/70 text-right">{desc}</span>
            </div>
          ))}
          <div className="text-[9px] font-mono text-[#9a9a9a]/60 pt-1">
            Cokoli dalšího jde do Mary Jane stejně jako v UI chatu (poznámky, úkoly, /status, /find…).
          </div>
        </div>
      </div>
    </div>
  )
}
