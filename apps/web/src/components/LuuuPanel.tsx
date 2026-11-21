// D:\dev\loyo-os\apps\web\src\components\LuuuPanel.tsx
// LOYO OS // LUUU — mailař: kontrola pošty, spam / newslettery do koše, seznamy odesílatelů.
// VZOR: StepanPanel.tsx — stejný styl, stejný API pattern
import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ACCENT = '#12a4ff'

type Status = {
  configured: boolean
  user: string | null
  host: string | null
  important: string[]
  del: string[]
  lastRun: string | null
  lastCounts: Record<string, number> | null
  lastSummary: string | null
  setupHelp: string | null
}

const COUNT_LABEL: Record<string, string> = {
  dulezite: '⭐ důležité', faktury: '🧾 faktury', ostatni: '📨 ostatní', newsletter: '📰 newslettery', spam: '🗑 spam',
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new Error('API neběží (localhost:3001), spusť pnpm dev:api')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`)
  return json as T
}

const btn = 'px-4 py-2 rounded-full text-[10px] font-black tracking-widest border transition disabled:opacity-40'

function SenderList({ title, hint, items, onChange }: { title: string; hint: string; items: string[]; onChange: (v: string[]) => void }) {
  const [value, setValue] = useState('')
  const add = () => {
    const v = value.trim().toLowerCase()
    if (!v) return
    if (!/^(@[\w.-]+\.[a-z]{2,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})$/i.test(v)) { alert('Zadej e-mail (news@alza.cz) nebo doménu (@alza.cz).'); return }
    if (!items.includes(v)) onChange([...items, v])
    setValue('')
  }
  return (
    <div>
      <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">{title}</div>
      <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/50">{hint}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((x) => (
          <span key={x} className="px-3 py-1 rounded-full bg-[#353535] border border-[#444] text-[11px] font-mono flex items-center gap-2">
            {x}
            <button onClick={() => onChange(items.filter((i) => i !== x))} title="Odebrat" className="text-[#9a9a9a] hover:text-[#ff6b6b]">×</button>
          </span>
        ))}
        {!items.length && <span className="text-[10px] font-mono text-[#9a9a9a]/50">prázdné</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="news@alza.cz nebo @alza.cz"
          className="flex-1 px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-mono outline-none focus:border-[#12a4ff]"
        />
        <button onClick={add} className={`${btn} border-[#444] text-[#9a9a9a] hover:text-[#f0f0f0]`}>+ PŘIDAT</button>
      </div>
    </div>
  )
}

export default function LuuuPanel() {
  const [st, setSt] = useState<Status | null>(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [output, setOutput] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoadError('')
    try { setSt(await api<Status>('/api/agents/luuu/state')) } catch (e: any) { setLoadError(e.message) }
  }
  useEffect(() => { load() }, [])

  const run = async (key: string, path: string, body: any, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setBusy(key); setError(''); setOutput('')
    try {
      const r = await api<{ text: string }>(path, { method: 'POST', body: JSON.stringify(body) })
      setOutput(r.text)
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(null) }
  }

  // celá schránka: sken → seznam odesílatelů s checkboxy → do koše jen zaškrtnuté
  type Group = { addr: string; name: string; count: number; junk: number }
  type Scan = { id: string; cat: 'spam' | 'newsletter'; scanned: number; total: number; groups: Group[] }
  const [scan, setScan] = useState<Scan | null>(null)
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const startScan = async (category: 'spam' | 'newsletter') => {
    setBusy(`scan-${category}`); setError(''); setOutput(''); setScan(null); setUnchecked(new Set())
    try { setScan(await api<Scan>('/api/agents/luuu/wipe/scan', { method: 'POST', body: JSON.stringify({ category }) })) }
    catch (e: any) { setError(e.message) } finally { setBusy(null) }
  }
  const toggle = (addr: string) => setUnchecked((prev) => { const n = new Set(prev); n.has(addr) ? n.delete(addr) : n.add(addr); return n })
  const chosenCount = scan ? scan.groups.filter((g) => !unchecked.has(g.addr)).reduce((n, g) => n + g.count, 0) : 0
  const chosenSenders = scan ? scan.groups.filter((g) => !unchecked.has(g.addr)).length : 0
  const runWipe = async () => {
    if (!scan || !chosenCount) return
    if (!confirm(`Přesunout ${chosenCount} mailů od ${chosenSenders} odesílatelů do Koše?
(Gmail je tam drží 30 dní, pak je sám vysype.)`)) return
    setBusy('wipe'); setError('')
    try {
      const r = await api<{ text: string }>('/api/agents/luuu/wipe/run', { method: 'POST', body: JSON.stringify({ id: scan.id, exclude: [...unchecked] }) })
      setOutput(r.text); setScan(null); await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(null) }
  }

  const saveLists = async (lists: { important?: string[]; del?: string[] }) => {
    setError('')
    try {
      setSt(await api<Status>('/api/agents/luuu/lists', { method: 'PUT', body: JSON.stringify(lists) }))
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch (e: any) { setError(e.message) }
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
        <div className="text-[11px] font-bold tracking-[0.2em]">LUUU · POŠTA</div>
        <div className="mt-2 text-[11px] font-mono text-[#ff6b6b]">{loadError}</div>
        <button onClick={load} className={`mt-3 ${btn} border-[#444] text-[#9a9a9a] hover:text-[#f0f0f0]`}>ZKUSIT ZNOVU</button>
      </div>
    )
  }
  if (!st) return <div className="text-[11px] font-mono text-[#9a9a9a]">Načítám Luua...</div>

  const counts = st.lastCounts ? Object.entries(st.lastCounts).filter(([, n]) => n > 0) : []

  return (
    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444] space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">LUUU · POŠTA</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">
            {st.configured ? <>● {st.user} · {st.host}</> : <span className="text-[#facc15]">○ není připojený k mailu</span>}
          </div>
        </div>
        {st.lastRun && (
          <div className="text-[9px] font-mono text-[#9a9a9a]/70 text-right shrink-0">
            naposledy<br />{new Date(st.lastRun).toLocaleString('cs-CZ')}
          </div>
        )}
      </div>

      {!st.configured && st.setupHelp && (
        <pre className="p-3 rounded-xl bg-[#353535] border border-[#444] text-[10px] font-mono whitespace-pre-wrap text-[#cfcfcf]">{st.setupHelp}</pre>
      )}

      {/* TLAČÍTKA */}
      <div className="flex flex-wrap gap-2">
        <button disabled={!st.configured || !!busy} onClick={() => run('new', '/api/agents/luuu/run', {})}
          className={`${btn} text-white`} style={{ background: ACCENT, borderColor: ACCENT }}>
          {busy === 'new' ? 'ČTU…' : '📬 ZKONTROLOVAT POŠTU'}
        </button>
        <button disabled={!st.configured || !!busy} onClick={() => run('3d', '/api/agents/luuu/run', { days: 3 })}
          className={`${btn} border-[#444] text-[#f0f0f0] hover:border-[#12a4ff]`}>
          {busy === '3d' ? 'ČTU…' : '📅 POSLEDNÍ 3 DNY'}
        </button>
        <button disabled={!st.configured || !!busy}
          onClick={() => run('spam', '/api/agents/luuu/trash', { category: 'spam', days: 7 }, 'Přesunout spam za posledních 7 dní do Koše? (Gmail ho tam drží 30 dní, jde vrátit.)')}
          className={`${btn} border-[#444] text-[#f0f0f0] hover:border-[#ff6b6b]`}>
          {busy === 'spam' ? 'MAŽU…' : '🗑 SMAZAT SPAM'}
        </button>
        <button disabled={!st.configured || !!busy}
          onClick={() => run('news', '/api/agents/luuu/trash', { category: 'newsletter', days: 7 }, 'Přesunout newslettery a reklamu za posledních 7 dní do Koše? (jde vrátit z Koše)')}
          className={`${btn} border-[#444] text-[#f0f0f0] hover:border-[#ff6b6b]`}>
          {busy === 'news' ? 'MAŽU…' : '📰 SMAZAT NEWSLETTERY'}
        </button>
      </div>
      {/* CELÁ SCHRÁNKA — sken, pak odesílatelé s checkboxy (odškrtnutý = všechny jeho maily zůstanou) */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">CELÁ SCHRÁNKA (všechny maily, nejen 7 dní)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button disabled={!st.configured || !!busy} onClick={() => startScan('spam')}
            className={`${btn} border-[#444] text-[#f0f0f0] hover:border-[#ff6b6b]`}>
            {busy === 'scan-spam' ? 'PROJÍŽDÍM SCHRÁNKU…' : '🗑 VŠECHEN SPAM Z GMAILU'}
          </button>
          <button disabled={!st.configured || !!busy} onClick={() => startScan('newsletter')}
            className={`${btn} border-[#444] text-[#f0f0f0] hover:border-[#ff6b6b]`}>
            {busy === 'scan-newsletter' ? 'PROJÍŽDÍM SCHRÁNKU…' : '📰 VŠECHNY NEWSLETTERY'}
          </button>
        </div>

        {scan && (
          <div className="mt-3 rounded-xl border border-[#444] bg-[#353535] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#444]">
              <div className="text-[10px] font-mono">
                {scan.cat === 'spam' ? '🗑 spam' : '📰 newslettery'} · {scan.total} mailů od {scan.groups.length} odesílatelů
                <span className="text-[#9a9a9a]/60"> (prošel jsem {scan.scanned})</span>
              </div>
              <div className="flex gap-2 text-[10px] font-mono">
                <button onClick={() => setUnchecked(new Set())} className="text-[#7cc8ff] hover:underline">vše</button>
                <button onClick={() => setUnchecked(new Set(scan.groups.map((g) => g.addr)))} className="text-[#7cc8ff] hover:underline">nic</button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {scan.groups.length === 0 && <div className="px-3 py-4 text-[11px] font-mono text-[#9a9a9a]">Nic k mazání. 🎉</div>}
              {scan.groups.map((g) => {
                const on = !unchecked.has(g.addr)
                return (
                  <label key={g.addr} className={`flex items-center gap-3 px-3 py-1.5 border-b border-[#3f3f3f] cursor-pointer hover:bg-[#3c3c3c] ${on ? '' : 'opacity-45'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(g.addr)} className="accent-[#ff6b6b] w-3.5 h-3.5" />
                    <span className="flex-1 min-w-0 text-[11px] font-mono truncate" title={g.addr}>
                      {g.name && g.name !== g.addr ? <><b>{g.name}</b> <span className="text-[#9a9a9a]">&lt;{g.addr}&gt;</span></> : g.addr}
                    </span>
                    {g.junk > 0 && <span className="text-[9px] font-mono text-[#facc15]" title="z toho ve složce Spam">spam {g.junk}</span>}
                    <span className="shrink-0 min-w-[42px] text-right text-[11px] font-black font-mono">{g.count}×</span>
                  </label>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-[#444]">
              <button disabled={!!busy || !chosenCount} onClick={runWipe}
                className={`${btn} text-[#111]`} style={{ background: '#facc15', borderColor: '#facc15' }}>
                {busy === 'wipe' ? 'MAŽU…' : `🗑 DO KOŠE ${chosenCount} mailů (${chosenSenders} odesílatelů)`}
              </button>
              <button disabled={!!busy} onClick={() => { setScan(null); setUnchecked(new Set()) }}
                className={`${btn} border-[#444] text-[#9a9a9a] hover:text-[#f0f0f0]`}>ZRUŠIT</button>
              {unchecked.size > 0 && <span className="text-[10px] font-mono text-[#9a9a9a]">ponechám {unchecked.size} odesílatelů</span>}
            </div>
          </div>
        )}
      </div>
      {error && <div className="text-[11px] font-mono text-[#ff6b6b]">{error}</div>}

      {/* POSLEDNÍ BĚH */}
      {counts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {counts.map(([k, n]) => (
            <span key={k} className="px-3 py-1 rounded-full bg-[#353535] border border-[#444] text-[10px] font-mono">{COUNT_LABEL[k] ?? k}: {n}</span>
          ))}
        </div>
      )}
      {(output || st.lastSummary) && (
        <pre className="p-3 rounded-xl bg-[#353535] border border-[#444] text-[11px] font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">{output || st.lastSummary}</pre>
      )}

      {/* SEZNAMY */}
      <div className="grid gap-5 md:grid-cols-2">
        <SenderList title="⭐ VŽDY DŮLEŽITÍ" hint="Maily od nich jsou vždy nahoře." items={st.important} onChange={(important) => saveLists({ important })} />
        <SenderList title="🗑 ROVNOU DO KOŠE" hint="Při každé kontrole je Luuu přesune do Koše." items={st.del} onChange={(del) => saveLists({ del })} />
      </div>
      {saved && <div className="text-[10px] font-mono text-[#4ade80]">✓ uloženo do .env</div>}
    </div>
  )
}
