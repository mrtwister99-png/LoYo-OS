import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

const ACCENT = '#FF3B30'

type Skill = {
  id: string
  name: string
  desc: string
  folder: string
  file: string
  category: string
  status: string
  version: string
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', desc: '' })

  useEffect(() => {
    loadSkillsFromFS()
    const id = setInterval(() => loadSkillsFromFS(), 5000)
    return () => clearInterval(id)
  }, [])

  const loadSkillsFromFS = async () => {
    setSyncStatus('syncing')
    try {
      const data = await invoke<any>('sync_skills_from_fs')
      const raw = Array.isArray(data)? data : data.skills || []
      setSkills(raw)
      setSyncStatus('synced')
    } catch (e) {
      console.error(e)
      setSyncStatus('error')
    }
  }

  const createSkill = async () => {
    if (!form.name) return
    const newSkill = {
      id: form.name.toLowerCase().replace(/\s+/g, '_'),
      name: form.name,
      desc: form.desc || '',
      folder: form.name,
      file: 'skill.md',
      category: '',
      status: 'ACTIVE',
      version: 'v0.1',
    }
    try {
      await invoke('save_skill_to_fs', { skill: newSkill })
      await loadSkillsFromFS()
      setShowNew(false)
      setForm({ name: '', desc: '' })
    } catch (e) { console.error(e) }
  }

  return (
    <div className="min-h-full bg-[#fbfaf8] text-black">
      <div className="px-10 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text- tracking-[0.35em] font-mono text-black/30">
              <span>LOYO OS</span><span className="w-1 h-1 rounded-full bg-black/20" /><span>SKILLS</span>
              <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-black text-white text- tracking-widest">
                <span className={`w-1.5 h-1.5 rounded-full ${syncStatus==='synced'?'animate-pulse':''}`} style={{ background: syncStatus==='synced'?ACCENT:syncStatus==='syncing'?'#FFC107':'#F44336' }} />
                {syncStatus==='synced'?'LIVE':syncStatus==='syncing'?'SYNCING...':'ERROR'}
              </span>
            </div>
            <h1 className="mt-4 text- leading-[0.85] tracking-[-0.06em] font-black uppercase">SKILLS <span className="font-mono font-light text- tracking-[0.1em] text-black/20">/ {String(skills.length).padStart(2,'0')}</span></h1>
            <p className="mt-3 text- leading-[1.6] text-black/40 max-w- font-mono">Ukládá se do <span className="text-black font-bold">D:\dev\loyo-os\data\skills</span> • prázdné bez kategorií</p>
          </div>
          <button onClick={()=>setShowNew(true)} className="px-7 py-3 rounded-full text- font-black tracking-[0.15em] text-white" style={{ background: ACCENT }}>+ NOVÝ SKILL</button>
        </div>
      </div>
      <div className="px-10 pb-20">
        {skills.length===0?(
          <div className="mt-12 border border-dashed border-black/10 rounded- p-20 text-center bg-white">
            <div className="w-20 h-20 mx-auto rounded-full bg-black text-white flex items-center justify-center text- font-black">∅</div>
            <div className="mt-8 text- tracking-[0.3em] font-mono text-black/30">ŽÁDNÉ SKILLS</div>
            <h3 className="mt-3 text- font-black tracking-tight leading-[0.9]">Čistý stůl.<br />Začni prvním skillem.</h3>
            <button onClick={()=>setShowNew(true)} className="mt-8 px-8 py-3 rounded-full text-white text- font-black tracking-widest" style={{ background: ACCENT }}>+ VYTVOŘIT PRVNÍ SKILL</button>
          </div>
        ):(
          <div className="mt-2 grid grid-cols-12 gap-5">
            {skills.map(s=>(
              <div key={s.id} className="col-span-12 md:col-span-6 xl:col-span-4 bg-white rounded- border border-black/5 p-7">
                <div className="text- font-black">{s.name}</div>
                <div className="mt-1 text- font-mono text-black/40">{s.desc||'Bez popisu'}</div>
                <div className="mt-4 text- font-mono text-black/30">{s.folder}/{s.file} • {s.version}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showNew&&(
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={()=>setShowNew(false)} />
          <div className="w- bg-white border-l border-black/10 h-full overflow-auto p-8">
            <div className="flex justify-between items-start">
              <div><div className="text- tracking-[0.3em] font-mono text-black/30">NOVÝ SKILL</div><h2 className="mt-2 text- font-black tracking-tight">Vytvořit skill</h2></div>
              <button onClick={()=>setShowNew(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">✕</button>
            </div>
            <div className="mt-8 space-y-5">
              <div><label className="text- font-mono tracking-widest text-black/40">NÁZEV</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="decision" className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 outline-none text- font-bold" /></div>
              <div><label className="text- font-mono tracking-widest text-black/40">POPIS</label><textarea value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} rows={3} className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 outline-none text-" /></div>
              <button onClick={createSkill} className="w-full py-4 rounded-full text-white text- font-black tracking-[0.2em]" style={{ background: ACCENT }}>VYTVOŘIT SKILL → data/skills/</button>
            </div>
          </div>
        </div>
      )}
      <div className="h- w-full" style={{ background: ACCENT }} />
    </div>
  )
}