// D:\dev\loyo-os\apps\web\src\components\LopatinkaPanel.tsx
// LOYO OS // LOPATINKA — ruční spuštění hledání na Sbazaru/Aukru + poslední tipy
// VZOR: apps/web/src/components/TridilPanel.tsx — stejný styl, stejný API pattern
import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ACCENT = '#12a4ff'

type Pick = {
  title: string
  price: number
  median: number
  discount: number
  portal: string
  url: string
  inBand?: boolean
  slot?: 'main' | 'bonus'
  source?: 'main' | 'watch'
  isNew?: boolean
  watchLabel?: string | null
  profit?: number | null
  profitMargin?: number | null
}

type WatchItem = {
  id: string
  query: string
  label?: string
  maxPrice: number | null
  active?: boolean
  lastRun?: string | null
  lastCount?: number | null
  lastBest?: { title: string; price: number; url: string } | null
}



type State = {
  lastRun: string | null
  lastResult: string
  lastReport?: string
  lastErrors?: string[]
  lastPicks: Pick[]
}

type Config = {
  budgetCzk: number
  preferredPriceCzk?: { min: number; max: number }
  pickCount: number
  bonusPickCount?: number
  queries: string[]
  profit?: { enabled?: boolean; resaleFactor?: number; riskPercent?: number; shippingCzk?: number } | null
}

type RunResult = {
  ok: boolean
  exitCode?: number
  dryRun?: boolean
  output?: string
  error?: string
}

const fmt = (v: number) => `${Math.round(v).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč`

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

export default function LopatinkaPanel() {
  const [config, setConfig] = useState<Config | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [telegramOk, setTelegramOk] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [running, setRunning] = useState<'' | 'preview' | 'run'>('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState('')
  const [watchQuery, setWatchQuery] = useState('')
  const [watchPrice, setWatchPrice] = useState('')
  const [watchItems, setWatchItems] = useState<WatchItem[]>([])
  const [watchBusy, setWatchBusy] = useState(false)
  const [watchError, setWatchError] = useState('')

  const load = async () => {
    setLoadError('')
    try {
      const r = await api<{
        config: Config
        state: State
        telegramConfigured: boolean
        watchlist?: WatchItem[]
      }>('/api/agents/lopatinka/state')
      setConfig(r.config)
      setState(r.state)
      setTelegramOk(r.telegramConfigured)
      setWatchItems(r.watchlist ?? [])
    } catch (e: any) {
      setLoadError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'preview' : 'run')
    setRunError('')
    setResult(null)
    try {
      const r = await api<RunResult>('/api/agents/lopatinka/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun }),
      })
      setResult(r)
      await load()
    } catch (e: any) {
      setRunError(e.message)
    } finally {
      setRunning('')
    }
  }

  const addWatch = async () => {
    if (!watchQuery.trim()) {
      setWatchError('Napiš, co má hlídat (např. iphone 13).')
      return
    }
    setWatchBusy(true)
    setWatchError('')
    try {
      const r = await api<{ items: WatchItem[] }>('/api/agents/lopatinka/watchlist', {
        method: 'POST',
        body: JSON.stringify({ query: watchQuery.trim(), maxPrice: watchPrice.trim() || null }),
      })
      setWatchItems(r.items ?? [])
      setWatchQuery('')
      setWatchPrice('')
    } catch (e: any) {
      setWatchError(e.message)
    } finally {
      setWatchBusy(false)
    }
  }

  const removeWatch = async (id: string) => {
    setWatchBusy(true)
    setWatchError('')
    try {
      const r = await api<{ items: WatchItem[] }>('/api/agents/lopatinka/watchlist/remove', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      setWatchItems(r.items ?? [])
    } catch (e: any) {
      setWatchError(e.message)
    } finally {
      setWatchBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
        <div className="text-[11px] font-bold tracking-[0.2em]">LOPATINKA · BAZARY</div>
        <div className="mt-2 text-[11px] font-mono text-[#ff6b6b]">{loadError}</div>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-full border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">ZKUSIT ZNOVU</button>
      </div>
    )
  }
  if (!config) return <div className="text-[11px] font-mono text-[#9a9a9a]">Načítám Lopatinku...</div>

  const band = config.preferredPriceCzk
    ? `${fmt(config.preferredPriceCzk.min)}–${fmt(config.preferredPriceCzk.max)}`
    : `do ${fmt(config.budgetCzk)}`
  const picks = state?.lastPicks ?? []

  return (
    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444] space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">LOPATINKA · BAZARY</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">
            Sbazar + Aukro → Telegram · priority {band} · {config.pickCount} tipy
            {config.bonusPickCount ? ` + ${config.bonusPickCount} bonusy` : ''}
          </div>
        </div>
        {state?.lastRun && (
          <div className="text-[9px] font-mono text-[#9a9a9a]/70 text-right shrink-0">
            naposledy<br />{new Date(state.lastRun).toLocaleString('cs-CZ')}
          </div>
        )}
      </div>

      {!telegramOk && (
        <div className="text-[10px] font-mono text-[#ffb020]">
          ⚠ Telegram není nastavený (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID v .env) — ostrý běh skončí chybou.
        </div>
      )}

      {/* SPUŠTĚNÍ */}
      <div>
        <div className="flex gap-2">
          <button
            onClick={() => run(true)}
            disabled={!!running}
            className="px-5 py-3 rounded-full border border-[#444] text-[11px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition disabled:opacity-50"
          >
            {running === 'preview' ? 'HLEDÁM...' : 'NÁHLED'}
          </button>
          <button
            onClick={() => run(false)}
            disabled={!!running}
            className="flex-1 px-5 py-3 rounded-full text-[#f0f0f0] text-[11px] font-black tracking-widest hover:opacity-90 transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {running === 'run' ? 'HLEDÁM A POSÍLÁM...' : 'SPUSTIT A POSLAT DO TELEGRAMU'}
          </button>
        </div>
        <div className="mt-1.5 text-[9px] font-mono text-[#9a9a9a]/70">
          Náhled nic neposílá, jen vypíše, co by šlo do Telegramu. Běh trvá ~20–60 s (prochází {config.queries.length} dotazů na obou portálech).
        </div>

        {runError && <div className="mt-3 text-[11px] font-mono text-[#ff6b6b]">{runError}</div>}
        {result && (
          <div className="mt-3 text-[11px] font-mono">
            <div className={result.ok ? 'text-[#f0f0f0]' : 'text-[#ff6b6b]'}>
              {result.ok
                ? `${result.dryRun ? '👁 NÁHLED' : '✓ ODESLÁNO'} · ${picks.length} ${picks.length === 1 ? 'nabídka' : picks.length < 5 ? 'nabídky' : 'nabídek'}`
                : `✕ ${result.error || 'běh selhal'}`}
            </div>
            {result.output && (
              <div className="mt-2 max-h-40 overflow-y-auto text-[10px] text-[#9a9a9a] whitespace-pre-wrap break-words">
                {result.output.trim()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* HLÍDANÉ DOTAZY */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">HLÍDANÉ DOTAZY</div>
          <div className="text-[9px] font-mono text-[#9a9a9a]/50">{watchItems.filter((w) => w.active !== false).length}</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={watchQuery}
            onChange={(e) => setWatchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addWatch() }}
            placeholder="co hlídat (iphone 13)"
            className="flex-1 min-w-[160px] px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-mono outline-none focus:border-[#12a4ff]"
          />
          <input
            value={watchPrice}
            onChange={(e) => setWatchPrice(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') addWatch() }}
            placeholder="max Kč"
            className="w-[100px] px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-mono outline-none focus:border-[#12a4ff]"
          />
          <button
            onClick={addWatch}
            disabled={watchBusy}
            className="px-4 py-2 rounded-full text-[#f0f0f0] text-[10px] font-black tracking-widest hover:opacity-90 transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {watchBusy ? '...' : 'HLÍDAT'}
          </button>
        </div>
        {watchError && <div className="mt-2 text-[10px] font-mono text-[#ff6b6b]">{watchError}</div>}
        {watchItems.length === 0 ? (
          <div className="mt-2 text-[10px] font-mono text-[#9a9a9a]/60">
            Zatím nic. Hlídaný dotaz se prohledává při každém běhu a nové nabídky dostanou 🔔.
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {watchItems.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#353535] border border-[#444]">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono truncate">
                    🔔 {w.query} <span className="text-[#9a9a9a]/60">{w.maxPrice ? `do ${fmt(w.maxPrice)}` : 'bez limitu'}</span>
                  </div>
                  <div className="text-[9px] font-mono text-[#9a9a9a]/60 truncate">
                    {w.lastRun
                      ? `${w.lastCount ?? 0} kandidátů${w.lastBest ? ` · ${w.lastBest.title} (${fmt(w.lastBest.price)})` : ''}`
                      : 'ještě neproběhl běh'}
                  </div>
                </div>
                <button
                  onClick={() => removeWatch(w.id)}
                  disabled={watchBusy}
                  title="Přestat hlídat"
                  className="w-7 h-7 rounded-full border border-[#444] text-[#9a9a9a] hover:text-[#ff8a8a] transition shrink-0 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POSLEDNÍ TIPY */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">POSLEDNÍ TIPY</div>
          {state?.lastReport && (
            <div className="text-[9px] font-mono text-[#9a9a9a]/50 truncate max-w-[220px]" title={state.lastReport}>
              {state.lastReport.split(/[\\/]/).pop()}
            </div>
          )}
        </div>
        {picks.length === 0 ? (
          <div className="mt-2 text-[11px] font-mono text-[#9a9a9a]/70">Zatím žádný běh.</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {picks.map((p, i) => (
              <a
                key={`${p.url}-${i}`}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block p-2.5 rounded-xl border border-[#444] hover:border-[#12a4ff] transition"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-bold truncate">{i + 1}) {p.title}</span>
                  <span className="text-[11px] font-mono shrink-0" style={{ color: ACCENT }}>{fmt(p.price)}</span>
                </div>
                <div className="mt-0.5 text-[9px] font-mono text-[#9a9a9a]/70">
                  {p.portal}
                  {p.source === 'watch' ? ` · 🔔 ${p.watchLabel ?? 'hlídané'}${p.isNew ? ' · NOVÉ' : ''}` : ''}
                  {p.slot === 'bonus' ? ' · bonus mimo pásmo' : p.inBand === false ? ' · mimo pásmo' : ''}
                  {p.discount > 0
                    ? ` · −${p.discount} % vs. medián ${fmt(p.median)}`
                    : p.discount < 0
                      ? ` · ⚠️ +${Math.abs(p.discount)} % nad mediánem ${fmt(p.median)}`
                      : ''}
                </div>
                {p.profit != null && (
                  <div className="mt-0.5 text-[9px] font-mono text-[#1f9d55]">
                    zisk ~{fmt(p.profit)}{p.profitMargin != null ? ` (${p.profitMargin} %)` : ''} po dopravě a riziku
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
