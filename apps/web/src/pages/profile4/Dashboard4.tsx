
import { useState, useEffect } from 'react'
type Task = { id: number; title: string; createdAt: string }
const KEY = 'loyo-grafik-dashboard4'
export default function Dashboard4() {
  const [tasks, setTasks] = useState<Task[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [] })
  const [name, setName] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(tasks)) } catch {} }, [tasks])
  const add = () => { const t = name.trim(); if (!t) return; setTasks(p=>[{ id: Date.now(), title: t, createdAt: new Date().toISOString() }, ...p]); setName('') }
  return (
    <div className="min-h-full bg-[#2b2b2b] p-4 md:p-6">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="bg-[#444] border border-[#444] p-6 text-[#f0f0f0]"><div className="text-[10px] tracking-[0.3em] font-black opacity-60">GRAFIK • DASHBOARD 4</div><h1 className="font-black text-2xl mt-1">GRAFIK DASHBOARD • {tasks.length}</h1></div>
        <div className="bg-[#3a3a3a] border border-[#444] p-4 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Nový grafik úkol..." className="flex-1 bg-[#2b2b2b] border border-[#444] px-3 py-2 text-sm" /><button onClick={add} className="bg-[#444] text-[#f0f0f0] px-6 font-black border border-[#444]">+ PŘIDAT</button></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{tasks.map(t => (<div key={t.id} className="bg-[#3a3a3a] border border-[#444] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"><div className="font-bold text-sm">{t.title}</div><div className="text-[10px] opacity-60 mt-1">{new Date(t.createdAt).toLocaleString('cs-CZ')}</div><button onClick={()=>setTasks(p=>p.filter(x=>x.id!==t.id))} className="mt-2 text-[10px] bg-[#444] text-[#f0f0f0] px-2 py-1 border border-[#444]">SMAZAT</button></div>))}</div>
      </div>
    </div>
  )
}
