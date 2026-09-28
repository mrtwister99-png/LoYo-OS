
import { useState, useEffect } from 'react'
type Idea = { id: number; title: string; createdAt: string }
const KEY = 'loyo-helenevim'
export default function HeleNevim() {
  const [ideas, setIdeas] = useState<Idea[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [] })
  const [name, setName] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ideas)) } catch {} }, [ideas])
  const add = () => { const t = name.trim(); if (!t) return; setIdeas(p=>[{ id: Date.now(), title: t, createdAt: new Date().toISOString() }, ...p]); setName('') }
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1000px] mx-auto space-y-4">
        <div className="bg-[#ff6f00] border-[3px] border-black p-5"><h1 className="font-black text-xl">HELE NEVIM • {ideas.length}</h1><p className="text-xs mt-1 opacity-70">Dump nápadů - rychlé poznámky</p></div>
        <div className="bg-white border-[3px] border-black p-4 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Co tě napadlo?..." className="flex-1 bg-[#ededed] border-2 border-black px-3 py-2 text-sm" /><button onClick={add} className="bg-black text-white px-6 font-black border-2 border-black">+ PŘIDAT</button></div>
        <div className="space-y-2">{ideas.map(i => (<div key={i.id} className="bg-white border-[3px] border-black p-3 flex justify-between shadow-[3px_3px_0px_#000]"><div><div className="font-bold text-sm">{i.title}</div><div className="text-[10px] opacity-60">{new Date(i.createdAt).toLocaleString('cs-CZ')}</div></div><button onClick={()=>setIdeas(p=>p.filter(x=>x.id!==i.id))} className="w-8 h-8 bg-[#ac0001] text-white border-2 border-black font-black">X</button></div>))}</div>
      </div>
    </div>
  )
}
