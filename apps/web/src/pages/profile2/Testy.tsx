
import { useState, useEffect } from 'react'
type Test = { id: number; name: string; status: 'pass'|'fail'|'todo'; createdAt: string }
const KEY = 'loyo-testy'
export default function Testy() {
  const [items, setItems] = useState<Test[]>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
    return []
  })
  const [name, setName] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => {
    const t = name.trim(); if (!t) return
    setItems(p => [{ id: Date.now(), name: t, status: 'todo', createdAt: new Date().toISOString() }, ...p])
    setName('')
  }
  const toggle = (id: number) => setItems(p => p.map(i => i.id===id ? {...i, status: i.status==='todo'?'pass': i.status==='pass'?'fail':'todo'} : i))
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="bg-[#040b8d] text-white border-[3px] border-black p-5">
          <h1 className="font-black text-xl">TESTY • {items.length}</h1>
          <div className="text-[10px] opacity-60 mt-1 tracking-[0.2em]">PASS / FAIL / TODO • KLIK ↻ MĚNÍ STATUS</div>
        </div>
        <div className="bg-white border-[3px] border-black p-4 flex gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Název testu..." className="flex-1 bg-[#ededed] border-2 border-black px-3 py-2 text-sm" />
          <button onClick={add} className="bg-black text-white px-6 font-black border-2 border-black">+ PŘIDAT</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(t => (
            <div key={t.id} className={`border-[3px] border-black p-4 flex justify-between shadow-[4px_4px_0px_#000] ${t.status==='pass'?'bg-[#d9ff00]':t.status==='fail'?'bg-[#ac0001] text-white':'bg-white'}`}>
              <div><div className="font-black text-sm">{t.name}</div><div className="text-[10px] mt-1 font-bold">{t.status.toUpperCase()}</div></div>
              <div className="flex gap-1"><button onClick={()=>toggle(t.id)} className="w-8 h-8 bg-white text-black border-2 border-black font-black">↻</button><button onClick={()=>setItems(p=>p.filter(x=>x.id!==t.id))} className="w-8 h-8 bg-black text-white border-2 border-black font-black">X</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
