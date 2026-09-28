
import { useState, useEffect } from 'react'
type Zapisek = { id: number; title: string; content: string; tag: 'job'|'idea'|'meeting'; createdAt: string }
const KEY = 'loyo-zapisky'
export default function Zapisky() {
  const [items, setItems] = useState<Zapisek[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [{ id: 1, title: 'Schůzka s klientem', content: 'Probrat budget a timeline', tag: 'meeting', createdAt: new Date().toISOString() }] })
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [tag, setTag] = useState<Zapisek['tag']>('job'); const [selectedId, setSelectedId] = useState<number|null>(null)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => { const t = title.trim(); if (!t) return; const it: Zapisek = { id: Date.now(), title: t, content, tag, createdAt: new Date().toISOString() }; setItems(p=>[it, ...p]); setTitle(''); setContent('') }
  const selected = items.find(i=>i.id===selectedId)
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 bg-white border-[3px] border-black p-4 space-y-3">
          <div className="flex justify-between items-center"><h2 className="font-black text-xs tracking-[0.2em]">ZÁPISKY • {items.length}</h2><span className="text-[10px] opacity-50">JINÝ NEŽ NOTES</span></div>
          <div className="flex gap-2"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Název..." className="flex-1 bg-[#ededed] border-2 border-black px-2 py-2 text-xs" /><select value={tag} onChange={e=>setTag(e.target.value as any)} className="border-2 border-black px-2 text-xs bg-white"><option value="job">JOB</option><option value="meeting">MEETING</option><option value="idea">IDEA</option></select></div>
          <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Obsah..." className="w-full bg-[#ededed] border-2 border-black p-2 text-xs min-h-[60px]" />
          <button onClick={add} className="w-full bg-black text-white py-2 font-black border-2 border-black">+ PŘIDAT ZÁPISEK</button>
          <div className="max-h-[500px] overflow-auto divide-y divide-black/10 border border-black/10">{items.map(it => (<div key={it.id} onClick={()=>setSelectedId(it.id)} className={`p-3 cursor-pointer border-l-4 ${selectedId===it.id?'bg-black text-white':'bg-white hover:bg-[#ededed]'}`} style={{borderLeftColor: it.tag==='job'?'#ff6f00':it.tag==='meeting'?'#040b8d':'#CDA24D'}}><div className="font-bold text-xs truncate">{it.title}</div><div className="text-[10px] opacity-60 truncate">{it.content.slice(0,50)} • {it.tag.toUpperCase()}</div></div>))}</div>
        </div>
        <div className="lg:col-span-8 bg-[#fdfdfc] border-[3px] border-black p-6">{selected ? (<div className="space-y-4"><h1 className="font-black text-xl">{selected.title}</h1><div className="text-[10px] font-black tracking-widest bg-[#ff6f00] border-2 border-black inline-block px-2 py-1">{selected.tag.toUpperCase()} • {new Date(selected.createdAt).toLocaleString('cs-CZ')}</div><div className="bg-white border-2 border-black p-4 min-h-[200px] whitespace-pre-wrap text-sm">{selected.content || 'bez obsahu'}</div><button onClick={()=>setItems(p=>p.filter(x=>x.id!==selected.id))} className="bg-[#ac0001] text-white px-4 py-2 border-2 border-black text-xs font-black">SMAZAT</button></div>) : <div className="h-[400px] flex items-center justify-center opacity-30 text-sm">Vyber zápisek vlevo</div>}</div>
      </div>
    </div>
  )
}
