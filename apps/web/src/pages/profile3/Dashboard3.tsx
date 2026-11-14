
import { useState, useEffect } from 'react'
type JobNote = { id: number; title: string; createdAt: string }
const KEY = 'loyo-job-dashboard3'
export default function Dashboard3() {
  const [notes, setNotes] = useState<JobNote[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [] })
  const [name, setName] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch {} }, [notes])
  const add = () => { const t = name.trim(); if (!t) return; setNotes(p => [{ id: Date.now(), title: t, createdAt: new Date().toISOString() }, ...p]); setName('') }
  return (
    <div className="min-h-full bg-[#2b2b2b] p-4 md:p-6">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="bg-[#444] border border-[#444] p-6 text-[#f0f0f0]"><div className="text-[10px] tracking-[0.3em] font-black opacity-60">JOB • DASHBOARD 3 • PRAZDNY</div><h1 className="font-black text-2xl mt-1">JOB DASHBOARD • {notes.length}</h1><p className="text-sm mt-2 opacity-80">Zatím prázdný - připravený pro job zakázky. Přidej první poznámku +.</p></div>
        <div className="bg-[#3a3a3a] border border-[#444] p-4 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Nová job poznámka..." className="flex-1 bg-[#2b2b2b] border border-[#444] px-3 py-2 text-sm outline-none" /><button onClick={add} className="bg-[#444] text-[#f0f0f0] px-6 font-black border border-[#444]">+ PŘIDAT</button></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{notes.map(n => (<div key={n.id} className="bg-[#3a3a3a] border border-[#444] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"><div className="font-bold text-sm">{n.title}</div><div className="text-[10px] opacity-60 mt-1">{new Date(n.createdAt).toLocaleString('cs-CZ')}</div><button onClick={()=>setNotes(p=>p.filter(x=>x.id!==n.id))} className="mt-2 text-[10px] bg-[#444] text-[#f0f0f0] px-2 py-1 border border-[#444]">SMAZAT</button></div>))}</div>
      </div>
    </div>
  )
}
