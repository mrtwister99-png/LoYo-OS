
import { useState, useEffect } from 'react'
type Item = { id: number; title: string; createdAt: string; status: 'todo'|'doing'|'done' }
const KEY = 'loyo-rozdelane'
export default function Rozdelane() {
  const [items, setItems] = useState<Item[]>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
    return []
  })
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<'all'|'todo'|'doing'|'done'>('all')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => {
    const t = name.trim(); if (!t) return
    setItems(p => [{ id: Date.now(), title: t, createdAt: new Date().toISOString(), status: 'doing' }, ...p])
    setName('')
  }
  const toggle = (id: number) => setItems(p => p.map(i => i.id===id ? {...i, status: i.status==='done'?'todo': i.status==='doing'?'done':'doing'} : i))
  const remove = (id: number) => setItems(p => p.filter(i => i.id!==id))
  const filtered = items.filter(i => filter==='all' ? true : i.status===filter)
  return (
    <div className="min-h-full bg-[#2b2b2b] p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="bg-[#444] text-[#f0f0f0] border border-[#444] p-5 flex justify-between items-center">
          <div><div className="text-[10px] tracking-[0.3em] opacity-60">LOYO OS • ROZDĚLANÉ</div><h1 className="font-black text-xl mt-1">ROZDĚLANÉ • {items.length}</h1></div>
          <div className="flex gap-2">{(['all','todo','doing','done'] as const).map(f => (<button key={f} onClick={()=>setFilter(f)} className={`text-[10px] px-3 py-1 border border-[#444] font-black ${filter===f? 'bg-[#12a4ff] text-white':'bg-[#3a3a3a] text-[#f0f0f0]'}`}>{f.toUpperCase()}</button>))}</div>
        </div>
        <div className="bg-[#3a3a3a] border border-[#444] p-4 flex gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Nový rozdělaný projekt..." className="flex-1 bg-[#2b2b2b] border border-[#444] px-3 py-2 text-sm outline-none focus:bg-[#3a3a3a]" />
          <button onClick={add} className="bg-[#444] text-[#f0f0f0] px-6 py-2 font-black border border-[#444] hover:bg-[#12a4ff]">+ PŘIDAT</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.length===0 ? <div className="col-span-2 bg-[#3a3a3a] border border-[#444] border-dashed p-10 text-center opacity-40 text-sm">Žádné položky - přidej první přes +</div> : filtered.map(it => (
            <div key={it.id} className="bg-[#3a3a3a] border border-[#444] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex justify-between">
              <div className="min-w-0"><div className="font-black text-sm truncate">{it.title}</div><div className="text-[10px] opacity-60 mt-1">{new Date(it.createdAt).toLocaleString('cs-CZ')} • {it.status}</div></div>
              <div className="flex gap-1 shrink-0"><button onClick={()=>toggle(it.id)} className="w-8 h-8 bg-[#444] border border-[#444] font-black text-xs">↻</button><button onClick={()=>remove(it.id)} className="w-8 h-8 bg-[#444] text-[#f0f0f0] border border-[#444] font-black text-xs">X</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
