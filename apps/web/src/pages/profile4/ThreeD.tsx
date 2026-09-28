
import { useState, useEffect } from 'react'
type Model = { id: number; name: string; poly: string; createdAt: string }
const KEY = 'loyo-threed'
export default function ThreeD() {
  const [models, setModels] = useState<Model[]>(() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {} return [] })
  const [name, setName] = useState(''); const [poly, setPoly] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(models)) } catch {} }, [models])
  const add = () => { const n = name.trim(); if (!n) return; setModels(p=>[{ id: Date.now(), name: n, poly: poly.trim()||'0', createdAt: new Date().toISOString() }, ...p]); setName(''); setPoly('') }
  return (
    <div className="min-h-full bg-[#ededed] p-4 md:p-6">
      <div className="max-w-[1000px] mx-auto space-y-4">
        <div className="bg-[#ac0001] text-white border-[3px] border-black p-5"><h1 className="font-black text-xl">3D • {models.length}</h1><p className="text-xs opacity-70 mt-1">Modely, scény, assety</p></div>
        <div className="bg-white border-[3px] border-black p-4 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Název modelu..." className="flex-1 border-2 border-black px-3 py-2 text-sm bg-[#ededed]" /><input value={poly} onChange={e=>setPoly(e.target.value)} placeholder="Poly..." className="w-[120px] border-2 border-black px-3 py-2 text-sm bg-[#ededed]" /><button onClick={add} className="bg-black text-white px-6 font-black border-2 border-black">+ PŘIDAT</button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{models.map(m => (<div key={m.id} className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_#000] flex justify-between"><div><div className="font-black text-sm">{m.name}</div><div className="text-[10px] opacity-60">{m.poly} polys • {new Date(m.createdAt).toLocaleDateString('cs-CZ')}</div></div><button onClick={()=>setModels(p=>p.filter(x=>x.id!==m.id))} className="w-8 h-8 bg-[#ac0001] text-white border-2 border-black font-black">X</button></div>))}</div>
      </div>
    </div>
  )
}
