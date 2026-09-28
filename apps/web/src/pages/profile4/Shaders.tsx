
import { useState, useEffect } from 'react'
type Shader = { id: number; name: string; code: string; createdAt: string }
const KEY = 'loyo-shaders'
export default function Shaders() {
  const [items, setItems] = useState<Shader[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [] })
  const [name, setName] = useState(''); const [code, setCode] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
  const add = () => { const n = name.trim(); if (!n) return; setItems(p=>[{ id: Date.now(), name: n, code, createdAt: new Date().toISOString() }, ...p]); setName(''); setCode('') }
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="bg-[#00f2ff] border-[3px] border-black p-5"><h1 className="font-black text-xl">SHADERS • {items.length}</h1></div>
        <div className="bg-white border-[3px] border-black p-4 space-y-2"><div className="flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Název shaderu..." className="flex-1 border-2 border-black px-3 py-2 text-sm bg-[#ededed]" /><button onClick={add} className="bg-black text-white px-6 font-black border-2 border-black">+ PŘIDAT</button></div><textarea value={code} onChange={e=>setCode(e.target.value)} placeholder="GLSL kód..." className="w-full border-2 border-black p-2 text-xs font-mono min-h-[80px] bg-[#ededed]" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{items.map(s => (<div key={s.id} className="bg-black text-white border-[3px] border-black p-4"><div className="font-black text-sm">{s.name}</div><pre className="text-[10px] mt-2 opacity-70 whitespace-pre-wrap max-h-[120px] overflow-auto">{s.code.slice(0,300)}</pre><button onClick={()=>setItems(p=>p.filter(x=>x.id!==s.id))} className="mt-2 text-[10px] bg-[#ac0001] px-2 py-1 border-2 border-white">SMAZAT</button></div>))}</div>
      </div>
    </div>
  )
}
