
import { useState, useEffect } from 'react'
type Projekt = { id: number; name: string; client: string; status: 'todo'|'doing'|'done'|'paid'; budget: string; createdAt: string }
const KEY = 'loyo-projekty'
export default function Projekty() {
  const [items, setItems] = useState<Projekt[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [{ id: 1, name: 'Web pro klienta XY', client: 'XY s.r.o.', status: 'doing', budget: '45k', createdAt: new Date().toISOString() }] })
  const [name, setName] = useState(''); const [client, setClient] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => { const n = name.trim(); if (!n) return; setItems(p=>[{ id: Date.now(), name: n, client: client.trim()||'Bez klienta', status: 'todo', budget: '', createdAt: new Date().toISOString() }, ...p]); setName(''); setClient('') }
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="bg-black text-white border-[3px] border-black p-5 flex justify-between items-center"><h1 className="font-black text-xl">PROJEKTY • {items.length}</h1><div className="text-[10px] opacity-60">JOB PROFIL</div></div>
        <div className="bg-white border-[3px] border-black p-4 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Název projektu..." className="flex-1 border-2 border-black px-3 py-2 text-sm bg-[#ededed]" /><input value={client} onChange={e=>setClient(e.target.value)} placeholder="Klient..." className="w-[200px] border-2 border-black px-3 py-2 text-sm bg-[#ededed]" /><button onClick={add} className="bg-[#ff6f00] border-2 border-black px-6 font-black">+ PŘIDAT</button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{items.map(p => (<div key={p.id} className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_#000]"><div className="flex justify-between"><div className="font-black text-sm">{p.name}</div><span className={`text-[10px] px-2 py-1 border-2 border-black font-black ${p.status==='paid'?'bg-[#d9ff00]':p.status==='done'?'bg-black text-white':p.status==='doing'?'bg-[#ff6f00]':'bg-white'}`}>{p.status.toUpperCase()}</span></div><div className="text-xs opacity-60 mt-1">{p.client} • {p.budget}</div><div className="flex gap-1 mt-3"><button onClick={()=>setItems(prev=>prev.map(x=>x.id===p.id?{...x, status: x.status==='todo'?'doing':x.status==='doing'?'done':x.status==='done'?'paid':'todo'}:x))} className="text-[10px] bg-[#ededed] border-2 border-black px-2 py-1">STATUS</button><button onClick={()=>setItems(prev=>prev.filter(x=>x.id!==p.id))} className="text-[10px] bg-[#ac0001] text-white border-2 border-black px-2 py-1">X</button></div></div>))}</div>
      </div>
    </div>
  )
}
