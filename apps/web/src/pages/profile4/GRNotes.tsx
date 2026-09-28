
import { useState, useEffect } from 'react'
type Note = { id: number; title: string; content: string; createdAt: string }
const KEY = 'loyo-grnotes'
export default function GRNotes() {
  const [notes, setNotes] = useState<Note[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [] })
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [selectedId, setSelectedId] = useState<number|null>(null)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch {} }, [notes])
  const add = () => { const t = title.trim(); if (!t) return; const n: Note = { id: Date.now(), title: t, content, createdAt: new Date().toISOString() }; setNotes(p=>[n, ...p]); setTitle(''); setContent('') }
  const selected = notes.find(n=>n.id===selectedId)
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 bg-white border-[3px] border-black p-4 space-y-3"><h2 className="font-black text-xs tracking-[0.2em]">GR NOTES • {notes.length}</h2><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Název..." className="w-full bg-[#ededed] border-2 border-black px-2 py-2 text-xs" /><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Obsah..." className="w-full bg-[#ededed] border-2 border-black p-2 text-xs min-h-[60px]" /><button onClick={add} className="w-full bg-black text-white py-2 font-black border-2 border-black">+ PŘIDAT</button><div className="max-h-[500px] overflow-auto divide-y divide-black/10 border border-black/10">{notes.map(n => (<div key={n.id} onClick={()=>setSelectedId(n.id)} className={`p-3 cursor-pointer border-l-4 ${selectedId===n.id?'bg-black text-white':'bg-white hover:bg-[#ededed]'}`} style={{borderLeftColor: '#a136ff'}}><div className="font-bold text-xs truncate">{n.title}</div><div className="text-[10px] opacity-60 truncate">{n.content.slice(0,50)}</div></div>))}</div></div>
        <div className="lg:col-span-8 bg-[#fdfdfc] border-[3px] border-black p-6">{selected ? (<div className="space-y-4"><h1 className="font-black text-xl">{selected.title}</h1><div className="text-[10px] bg-[#a136ff] text-white border-2 border-black inline-block px-2 py-1">{new Date(selected.createdAt).toLocaleString('cs-CZ')}</div><div className="bg-white border-2 border-black p-4 min-h-[200px] whitespace-pre-wrap text-sm">{selected.content}</div><button onClick={()=>setNotes(p=>p.filter(x=>x.id!==selected.id))} className="bg-[#ac0001] text-white px-4 py-2 border-2 border-black text-xs font-black">SMAZAT</button></div>) : <div className="h-[400px] flex items-center justify-center opacity-30">Vyber poznámku</div>}</div>
      </div>
    </div>
  )
}
