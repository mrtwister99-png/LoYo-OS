// apps/web/src/components/NapadyPanel.tsx — NÁPADY na prvním dashboardu (vpravo, ~40 % výšky)
// Velké + = nový nápad · malé světlejší + u nápadu = okýnko s podrobnostmi (přidat / odebrat).
// Z chatu / Telegramu: /napad <text>
import { useEffect, useRef, useState } from 'react'

const API_URL = 'http://localhost:3001'

type Note = { text: string; at: string }
type Napad = { id: string; title: string; notes: Note[]; createdAt: string; source: string; done?: boolean }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json as T
}

export default function NapadyPanel() {
  const [list, setList] = useState<Napad[]>([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    try { setList((await api<{ napady: Napad[] }>('/api/napady')).napady); setError('') } catch { setError('API neběží') }
  }
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t) }, [])
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const add = async () => {
    if (!text.trim()) { setAdding(false); return }
    await api('/api/napady', { method: 'POST', body: JSON.stringify({ title: text }) }).catch((e) => setError(e.message))
    setText(''); setAdding(false); load()
  }
  const update = async (id: string, body: any) => {
    await api(`/api/napady/${id}`, { method: 'PUT', body: JSON.stringify(body) }).catch((e) => setError(e.message))
    load()
  }
  const remove = async (id: string) => {
    if (!confirm('Smazat nápad?')) return
    await api(`/api/napady/${id}`, { method: 'DELETE' }).catch((e) => setError(e.message))
    setOpenId(null); load()
  }

  const open = list.find((n) => n.id === openId) ?? null
  const visible = [...list].sort((a, b) => Number(!!a.done) - Number(!!b.done))

  return (
    <div className="relative h-full bg-[#2b2b2b] border border-[#444] flex flex-col overflow-hidden border-t-2" style={{ borderTopColor: '#facc15' }}>
      {/* nadpis + velké + */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444] shrink-0">
        <div>
          <h2 className="font-black text-sm tracking-[0.25em]">💡 NÁPADY</h2>
          <div className="text-[9px] opacity-50 mt-0.5">{list.filter((n) => !n.done).length} otevřených · /napad v chatu</div>
        </div>
        <button onClick={() => setAdding(true)} title="Nový nápad"
          className="w-9 h-9 flex items-center justify-center text-xl font-black text-[#111] hover:brightness-110 active:translate-y-[1px] transition"
          style={{ background: '#facc15', border: '1px solid black', boxShadow: '2px 2px 0 black' }}>+</button>
      </div>

      {adding && (
        <div className="px-3 py-2 border-b border-[#444] flex gap-2 shrink-0">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setText('') } }}
            placeholder="Co tě napadlo…" className="flex-1 bg-[#3a3a3a] border border-[#444] px-2 py-1.5 text-xs outline-none focus:border-[#facc15]" />
          <button onClick={add} className="px-3 text-[10px] font-black bg-[#444] border border-[#444] hover:bg-[#3a3a3a]">ULOŽIT</button>
        </div>
      )}

      {/* seznam */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {error && <div className="text-[10px] text-[#ff6b6b] px-2">{error}</div>}
        {!list.length && !error && <div className="text-[10px] opacity-40 px-2 py-4 text-center">Zatím nic. Klikni na + nebo napiš Mary „/napad …“</div>}
        {visible.map((n) => (
          <div key={n.id} className={`group flex items-start gap-2 px-2.5 py-2 bg-[#3a3a3a] border border-[#444] hover:border-[#555] ${n.done ? 'opacity-40' : ''}`}>
            <button onClick={() => update(n.id, { done: !n.done })} title={n.done ? 'Vrátit' : 'Hotovo'}
              className="mt-0.5 w-3.5 h-3.5 shrink-0 border border-[#666] text-[9px] leading-none flex items-center justify-center"
              style={n.done ? { background: '#4ade80', borderColor: '#4ade80', color: '#111' } : undefined}>{n.done ? '✓' : ''}</button>
            <button onClick={() => { setOpenId(n.id); setNote('') }} className="flex-1 min-w-0 text-left">
              <div className={`text-[11px] font-bold leading-snug break-words ${n.done ? 'line-through' : ''}`}>{n.title}</div>
              {n.notes.length > 0 && <div className="text-[9px] opacity-50 mt-0.5">📝 {n.notes.length} podrobností</div>}
            </button>
            {/* menší a světlejší + → okýnko s podrobnostmi */}
            <button onClick={() => { setOpenId(n.id); setNote('') }} title="Přidat podrobnosti"
              className="w-5 h-5 shrink-0 flex items-center justify-center text-[13px] font-bold text-[#cfcfcf] bg-[#4a4a4a] border border-[#5a5a5a] hover:bg-[#5a5a5a] hover:text-white transition">+</button>
          </div>
        ))}
      </div>

      {/* vyskakovací okýnko s podrobnostmi — nad panelem */}
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" onClick={() => setOpenId(null)}>
          <div className="w-full max-w-md bg-[#2b2b2b] border border-[#444] shadow-[0_24px_60px_rgba(0,0,0,0.6)] border-t-2" style={{ borderTopColor: '#facc15' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-[#444]">
              <div className="min-w-0">
                <div className="text-[9px] tracking-[0.3em] opacity-50">💡 NÁPAD</div>
                <div className="font-black text-sm mt-1 break-words">{open.title}</div>
                <div className="text-[9px] opacity-40 mt-1">{new Date(open.createdAt).toLocaleString('cs-CZ')} · {open.source === 'chat' ? 'z chatu' : 'z dashboardu'}</div>
              </div>
              <button onClick={() => setOpenId(null)} className="w-7 h-7 shrink-0 bg-white/5 hover:bg-[#444]">✕</button>
            </div>
            <div className="p-4 space-y-2 max-h-[45vh] overflow-y-auto">
              {open.notes.length === 0 && <div className="text-[10px] opacity-40">Zatím bez podrobností.</div>}
              {open.notes.map((x, i) => (
                <div key={i} className="group flex gap-2 text-[11px] bg-[#3a3a3a] border border-[#444] px-3 py-2">
                  <span className="flex-1 whitespace-pre-wrap break-words">{x.text}</span>
                  <button onClick={() => update(open.id, { removeNote: i })} title="Odebrat" className="opacity-40 hover:opacity-100 hover:text-[#ff6b6b] shrink-0">−</button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#444] space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && note.trim()) { update(open.id, { note }); setNote('') } }}
                placeholder="Podrobnost, souvislost, další krok… (Ctrl+Enter uloží)"
                className="w-full bg-[#3a3a3a] border border-[#444] px-3 py-2 text-xs outline-none focus:border-[#facc15] resize-y" />
              <div className="flex gap-2">
                <button disabled={!note.trim()} onClick={() => { update(open.id, { note }); setNote('') }}
                  className="flex-1 py-2 text-[10px] font-black text-[#111] disabled:opacity-40" style={{ background: '#facc15', border: '1px solid black' }}>+ PŘIDAT PODROBNOST</button>
                <button onClick={() => remove(open.id)} className="px-3 py-2 text-[10px] font-bold border border-[#444] text-[#9a9a9a] hover:text-[#ff6b6b]">SMAZAT NÁPAD</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
