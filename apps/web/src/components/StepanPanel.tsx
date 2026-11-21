// D:\dev\loyo-os\apps\web\src\components\StepanPanel.tsx
// LOYO OS // STĚPÁN — hodíš věc, on zjistí cenu na trhu a napíše inzerát
// VZOR: apps/web/src/components/LopatinkaPanel.tsx — stejný styl, stejný API pattern
import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ACCENT = '#12a4ff'

type Condition = { id: string; label: string; factor: number }
type Price = {
  count: number
  min: number
  p25: number
  median: number
  p75: number
  max: number
  recommended: number
  quick: number
  patient: number
  lowConfidence: boolean
}
type Comparable = { title: string; price: number; portal: string; location?: string; url: string }
type Listing = { title: string; body: string; price: number | null }
type State = {
  lastRun: string | null
  item?: string
  conditionLabel?: string
  query?: string
  detectedCategory?: string
  comparableCount?: number
  price?: Price | null
  listing?: Listing
  comparables?: Comparable[]
  lastReport?: string
  lastErrors?: string[]
  userPrice?: number | null
  sbazar?: { ok?: boolean; filled?: string[]; missing?: string[]; photos?: number; loggedIn?: boolean; error?: string; at?: string }
  lastSbazarText?: string
}
type Config = { conditions: Condition[]; defaultCondition: string; minComparableCount: number; portals: string[] }
type RunResult = { ok: boolean; output?: string; error?: string; state?: State }

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

export default function StepanPanel() {
  const [config, setConfig] = useState<Config | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [item, setItem] = useState('')
  const [condition, setCondition] = useState('dobry')
  const [loadError, setLoadError] = useState('')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [userPrice, setUserPrice] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoFolder, setPhotoFolder] = useState('')
  const [postToSbazar, setPostToSbazar] = useState(true)
  const [sbazarMsg, setSbazarMsg] = useState('')

  // fotky → base64 → API je uloží do stepan/fotky/<čas>/ a vrátí složku pro Sbazar
  const uploadPhotos = async (): Promise<string> => {
    if (!photoFiles.length) return photoFolder.trim()
    const files = await Promise.all(
      photoFiles.map(
        (f) =>
          new Promise<{ name: string; data: string }>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve({ name: f.name, data: String(r.result) })
            r.onerror = () => reject(new Error(`Nejde načíst ${f.name}`))
            r.readAsDataURL(f)
          }),
      ),
    )
    const res = await api<{ folder: string }>('/api/agents/stepan/photos', { method: 'POST', body: JSON.stringify({ files }) })
    return res.folder
  }

  const sbazarLogin = async () => {
    setSbazarMsg('')
    try {
      await api('/api/agents/stepan/sbazar/login', { method: 'POST', body: '{}' })
      setSbazarMsg('Na počítači se otevřel Edge — přihlas se k Seznamu. Okno se pak samo zavře.')
    } catch (e: any) {
      setSbazarMsg(e.message)
    }
  }

  const sbazarPostNow = async () => {
    setSbazarMsg('')
    try {
      const photos = await uploadPhotos()
      await api('/api/agents/stepan/sbazar/post', { method: 'POST', body: JSON.stringify({ photos }) })
      setSbazarMsg('Otevírám Sbazar v Edge a vyplňuju poslední inzerát. Zveřejníš sám.')
      setTimeout(load, 15000)
    } catch (e: any) {
      setSbazarMsg(e.message)
    }
  }

  const load = async () => {
    setLoadError('')
    try {
      const r = await api<{ config: Config; state: State | null }>('/api/agents/stepan/state')
      setConfig(r.config)
      setState(r.state)
      if (r.state?.conditionLabel) {
        const found = r.config.conditions.find((c) => c.label === r.state?.conditionLabel)
        if (found) setCondition(found.id)
      }
    } catch (e: any) {
      setLoadError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  const run = async () => {
    if (!item.trim()) {
      setRunError('Napiš, co prodáváš (název a model stačí).')
      return
    }
    setRunning(true)
    setRunError('')
    setOutput('')
    setCopied(false)
    try {
      const r = await api<RunResult>('/api/agents/stepan/run', {
        method: 'POST',
        body: JSON.stringify({
          item,
          condition,
          price: userPrice.replace(/\D/g, '') || undefined,
          photos: postToSbazar ? await uploadPhotos() : undefined,
          post: postToSbazar,
        }),
      })
      if (postToSbazar) {
        setSbazarMsg('Edge se otevírá se Sbazarem — inzerát předvyplním, zveřejníš sám.')
        setTimeout(load, 20000)
      }
      if (!r.ok) throw new Error(r.error || 'běh selhal')
      if (r.state) setState(r.state)
      setOutput(r.output ?? '')
    } catch (e: any) {
      setRunError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const copy = async () => {
    const listing = state?.listing
    if (!listing) return
    const text = `${listing.title}\n\n${listing.body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setRunError('Kopírování prohlížeč zablokoval — text označ ručně.')
    }
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
        <div className="text-[11px] font-bold tracking-[0.2em]">STĚPÁN · PRODEJ</div>
        <div className="mt-2 text-[11px] font-mono text-[#ff6b6b]">{loadError}</div>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-full border border-[#444] text-[10px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">ZKUSIT ZNOVU</button>
      </div>
    )
  }
  if (!config) return <div className="text-[11px] font-mono text-[#9a9a9a]">Načítám Stěpána...</div>

  const price = state?.price ?? null
  const listing = state?.listing
  const comparables = state?.comparables ?? []

  return (
    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444] space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em]">STĚPÁN · PRODEJ</div>
          <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">
            {config.portals.join(' + ')} → cena + inzerát · {config.conditions.length} stavů
          </div>
        </div>
        {state?.lastRun && (
          <div className="text-[9px] font-mono text-[#9a9a9a]/70 text-right shrink-0">
            naposledy<br />{new Date(state.lastRun).toLocaleString('cs-CZ')}
          </div>
        )}
      </div>

      {/* ZADÁNÍ VĚCI */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">CO PRODÁVÁŠ</div>
        <textarea
          value={item}
          onChange={(e) => setItem(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="např. iPhone 13 128 GB, baterie 89 %, drobné škrábance na rámečku"
          className="mt-2 w-full px-4 py-3 rounded-xl bg-[#353535] border border-[#444] text-[12px] font-mono outline-none focus:border-[#12a4ff] resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-bold tracking-wide outline-none"
          >
            {config.conditions.map((c) => (
              <option key={c.id} value={c.id}>{c.label.toUpperCase()}</option>
            ))}
          </select>
          <input
            value={userPrice}
            onChange={(e) => setUserPrice(e.target.value)}
            inputMode="numeric"
            placeholder="TVOJE CENA (Kč)"
            className="w-36 px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-bold tracking-wide outline-none focus:border-[#12a4ff]"
          />
          <button
            onClick={run}
            disabled={running}
            className="flex-1 px-5 py-3 rounded-full text-[#f0f0f0] text-[11px] font-black tracking-widest hover:opacity-90 transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {running ? 'ZJIŠŤUJI CENU...' : postToSbazar ? 'OCENIT A VLOŽIT NA SBAZAR' : 'OCENIT A NAPSAT INZERÁT'}
          </button>
        </div>
        <div className="mt-1.5 text-[9px] font-mono text-[#9a9a9a]/70">
          Projde Sbazar i Aukro, najde stejný model a spočítá cenu z mediánu trhu. Trvá ~10–40 s.
        </div>

        {/* SBAZAR */}
        <div className="mt-3 p-3 rounded-xl bg-[#353535] border border-[#444] space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest cursor-pointer">
            <input type="checkbox" checked={postToSbazar} onChange={(e) => setPostToSbazar(e.target.checked)} />
            PŘEDVYPLNIT NA SBAZARU <span className="font-mono font-normal text-[#9a9a9a]/70">(zveřejníš sám)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3 py-1.5 rounded-full border border-[#444] text-[9px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition cursor-pointer">
              📸 FOTKY{photoFiles.length ? ` (${photoFiles.length})` : ''}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setPhotoFiles([...(e.target.files ?? [])].slice(0, 20))}
              />
            </label>
            <input
              value={photoFolder}
              onChange={(e) => setPhotoFolder(e.target.value)}
              placeholder="nebo cesta ke složce, např. D:oto\ps5"
              className="flex-1 min-w-[180px] px-3 py-1.5 rounded-full bg-[#3a3a3a] border border-[#444] text-[10px] font-mono outline-none focus:border-[#12a4ff]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={sbazarLogin} className="px-3 py-1.5 rounded-full border border-[#444] text-[9px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">
              🔑 PŘIHLÁSIT SBAZAR
            </button>
            {listing && (
              <button onClick={sbazarPostNow} className="px-3 py-1.5 rounded-full border border-[#444] text-[9px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">
                📝 VLOŽIT POSLEDNÍ INZERÁT
              </button>
            )}
            <span className="text-[9px] font-mono text-[#9a9a9a]/70">fotky z Telegramu (Mary) se přiberou samy</span>
          </div>
          {sbazarMsg && <div className="text-[10px] font-mono text-[#12a4ff]">{sbazarMsg}</div>}
          {state?.lastSbazarText && (
            <div className="text-[10px] font-mono whitespace-pre-wrap text-[#9a9a9a]">{state.lastSbazarText}</div>
          )}
        </div>

        {runError && <div className="mt-3 text-[11px] font-mono text-[#ff6b6b]">{runError}</div>}
      </div>

      {/* CENA */}
      {price && (
        <div>
          <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">
            CENA {state?.detectedCategory ? `· ${state.detectedCategory}` : ''}
          </div>
          <div className="mt-2 p-4 rounded-xl bg-[#353535] border border-[#444]">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[26px] font-black leading-none">{fmt(price.recommended)}</div>
              <div className="text-[10px] font-mono text-[#9a9a9a]/70 text-right">
                {price.count} nabídek<br />medián {fmt(price.median)}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="px-3 py-2 rounded-lg bg-[#3a3a3a] border border-[#444]">
                <div className="text-[#9a9a9a]/70">RYCHLE PRYČ</div>
                <div className="mt-0.5 text-[12px] font-bold text-[#f0f0f0]">{fmt(price.quick)}</div>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[#3a3a3a] border border-[#444]">
                <div className="text-[#9a9a9a]/70">KDYŽ POČKÁŠ</div>
                <div className="mt-0.5 text-[12px] font-bold text-[#f0f0f0]">{fmt(price.patient)}</div>
              </div>
            </div>
            <div className="mt-2 text-[9px] font-mono text-[#9a9a9a]/70">
              trh {fmt(price.min)} – {fmt(price.max)} · stav {state?.conditionLabel}{state?.query ? ` · dotaz „${state.query}“` : ''}
            </div>
            {price.lowConfidence && (
              <div className="mt-2 text-[10px] font-mono text-[#ffb020]">
                ⚠ Méně než {config.minComparableCount} srovnatelné nabídky — cena je jen orientační.
              </div>
            )}
          </div>
        </div>
      )}

      {/* INZERÁT */}
      {listing && (
        <div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">INZERÁT</div>
            <button
              onClick={copy}
              className="px-3 py-1.5 rounded-full border border-[#444] text-[9px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition"
            >
              {copied ? '✓ ZKOPÍROVÁNO' : 'KOPÍROVAT'}
            </button>
          </div>
          <div className="mt-2 p-4 rounded-xl bg-[#353535] border border-[#444]">
            <div className="text-[13px] font-bold leading-tight">{listing.title}</div>
            <div className="mt-3 text-[11px] font-mono whitespace-pre-wrap break-words text-[#9a9a9a]">{listing.body}</div>
          </div>
        </div>
      )}

      {/* SROVNATELNÉ NABÍDKY */}
      {comparables.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">SROVNATELNÉ NABÍDKY</div>
            {state?.lastReport && (
              <div className="text-[9px] font-mono text-[#9a9a9a]/50 truncate max-w-[220px]" title={state.lastReport}>
                {state.lastReport.split(/[\\/]/).pop()}
              </div>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {comparables.slice(0, 8).map((c, i) => (
              <a
                key={`${c.url}-${i}`}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#353535] border border-[#444] hover:border-[#12a4ff] transition"
              >
                <span className="text-[10px] font-mono truncate">{c.title}</span>
                <span className="text-[10px] font-bold shrink-0">{fmt(c.price)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {state?.lastErrors && state.lastErrors.length > 0 && (
        <div className="text-[9px] font-mono text-[#ffb020]">{state.lastErrors.join('; ')}</div>
      )}

      {output && (
        <details>
          <summary className="text-[9px] font-mono tracking-widest text-[#9a9a9a]/70 cursor-pointer">LOG BĚHU</summary>
          <div className="mt-2 max-h-40 overflow-y-auto text-[10px] text-[#9a9a9a] whitespace-pre-wrap break-words">{output}</div>
        </details>
      )}
    </div>
  )
}
