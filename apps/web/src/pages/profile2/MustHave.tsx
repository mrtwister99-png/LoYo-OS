
import { useState, useEffect } from 'react'
type Item = { id: number; title: string; createdAt: string; prio: 'high'|'mid'|'low' }
const KEY = 'loyo-musthave'
export default function MustHave() {
  const [items, setItems] = useState<Item[]>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
    return []
  })
  const [name, setName] = useState('')
  const [prio, setPrio] = useState<Item['prio']>('high')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => {
    const t = name.trim(); if (!t) return
    setItems(p => [{ id: Date.now(), title: t, prio, createdAt: new Date().toISOString() }, ...p])
    setName('')
  }
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="bg-[#d9ff00] border-[3px] border-black p-5">
          <div className="text-[10px] tracking-[0.3em] font-black">MUST HAVE • POVINNÉ</div>
          <h1 className="font-black text-xl mt-1">MUST HAVE • {items.length}</h1>
        </div>
        <div className="bg-white border-[3px] border-black p-4 flex gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Co musí být hotové..." className="flex-1 bg-[#ededed] border-2 border-black px-3 py-2 text-sm outline-none" />
          <select value={prio} onChange={e=>setPrio(e.target.value as any)} className="border-2 border-black px-3 py-2 text-sm bg-white font-black"><option value="high">HIGH</option><option value="mid">MID</option><option value="low">LOW</option></select>
          <button onClick={add} className="bg-black text-white px-6 py-2 font-black border-2 border-black">+ PŘIDAT</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(it => (
            <div key={it.id} className={`border-[3px] border-black p-4 shadow-[4px_4px_0px_#000] flex justify-between ${it.prio==='high'?'bg-[#ac0001] text-white': it.prio==='mid'?'bg-[#CDA24D]':'bg-white'}`}>
              <div><div className="font-black text-sm">{it.title}</div><div className="text-[10px] opacity-70 mt-1">{it.prio.toUpperCase()} • {new Date(it.createdAt).toLocaleString('cs-CZ')}</div></div>
              <button onClick={()=>setItems(p=>p.filter(x=>x.id!==it.id))} className="w-8 h-8 bg-black text-white border-2 border-black font-black">X</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
