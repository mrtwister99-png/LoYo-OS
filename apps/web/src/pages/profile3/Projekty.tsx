
import { useState, useEffect } from 'react'
type Projekt = { id: number; name: string; client: string; status: 'todo'|'doing'|'done'|'paid'; budget: string; createdAt: string }
const KEY = 'loyo-projekty'
export default function Projekty() {
  const [items, setItems] = useState<Projekt[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [{ id: 1, name: 'Web pro klienta XY', client: 'XY s.r.o.', status: 'doing', budget: '45k', createdAt: new Date().toISOString() }] })
  const [name, setName] = useState(''); const [client, setClient] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => { const n = name.trim(); if (!n) return; setItems(p=>[{ id: Date.now(), name: n, client: client.trim()||'Bez klienta', status: 'todo', budget: '', createdAt: new Date().toISOString() }, ...p]); setName(''); setClient('') }
  return (
    <div className="min-h-full bg-[#2b2b2b] p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="bg-[#444] text-[#f0f0f0] border border-[#444] p-5 flex justify-between items-center"><h1 className="font-black text-xl">PROJEKTY • {items.length}</h1><div className="text-[10px] opacity-60">JOB PROFIL</div></div>
        <div className="bg-[#3a3a3a] border border-[#444] p-4 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Název projektu..." className="flex-1 border border-[#444] px-3 py-2 text-sm bg-[#2b2b2b]" /><input value={client} onChange={e=>setClient(e.target.value)} placeholder="Klient..." className="w-[200px] border border-[#444] px-3 py-2 text-sm bg-[#2b2b2b]" /><button onClick={add} className="bg-[#444] border border-[#444] px-6 font-black">+ PŘIDAT</button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{items.map(p => (<div key={p.id} className="bg-[#3a3a3a] border border-[#444] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"><div className="flex justify-between"><div className="font-black text-sm">{p.name}</div><span className={`text-[10px] px-2 py-1 border border-[#444] font-black ${p.status==='paid'?'bg-[#444]':p.status==='done'?'bg-[#444] text-[#f0f0f0]':p.status==='doing'?'bg-[#444]':'bg-[#3a3a3a]'}`}>{p.status.toUpperCase()}</span></div><div className="text-xs opacity-60 mt-1">{p.client} • {p.budget}</div><div className="flex gap-1 mt-3"><button onClick={()=>setItems(prev=>prev.map(x=>x.id===p.id?{...x, status: x.status==='todo'?'doing':x.status==='doing'?'done':x.status==='done'?'paid':'todo'}:x))} className="text-[10px] bg-[#2b2b2b] border border-[#444] px-2 py-1">STATUS</button><button onClick={()=>setItems(prev=>prev.filter(x=>x.id!==p.id))} className="text-[10px] bg-[#444] text-[#f0f0f0] border border-[#444] px-2 py-1">X</button></div></div>))}</div>
      </div>
    </div>
  )
}
