import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

const ACCENT = '#FF3B30'

type Loop = {
  id: string
  name: string
  desc: string
  status: string
  schedule: string
  agent: string
  enabled: boolean
}

export default function Loops() {
  const [loops, setLoops] = useState<Loop[]>([])
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', desc: '', schedule: '' })

  useEffect(() => {
    loadLoops()
    const id = setInterval(() => loadLoops(), 5000)
    return () => clearInterval(id)
  }, [])

  const loadLoops = async () => {
    setSyncStatus('syncing')
    try {
      // zkusíme Tauri
      const data = await invoke<any>('sync_loops_from_fs')
      const tauriLoops = Array.isArray(data) ? data : data.loops || []

      // doplníme scheduled loops z API
      let apiLoops: Loop[] = []
      try
      {
        const res = await fetch('http://localhost:3001/api/loops')
        const json = await res.json()
        apiLoops = (json.loops || []).filter((l: any) => l.source === 'commands.json')
      }
      catch {}

      // merge: API scheduled + Tauri manuální (deduplikace podle id)
      const ids = new Set(tauriLoops.map((l: any) => l.id))
      const merged = [...tauriLoops, ...apiLoops.filter((l: any) => !ids.has(l.id))]
      setLoops(merged)
      setSyncStatus('synced')
    } catch (e) {
      // Tauri nedostupné — fallback čistě na API
      try
      {
        const res = await fetch('http://localhost:3001/api/loops')
        const json = await res.json()
        setLoops(json.loops || [])
        setSyncStatus('synced')
      }
      catch
      {
        console.error(e)
        setSyncStatus('error')
      }
    }
  }

  const createLoop = async () => {
    if (!form.name) return
    const newLoop = {
      id: form.name.toLowerCase().replace(/\s+/g, '_'),
      name: form.name,
      desc: form.desc || '',
      status: 'ACTIVE',
      schedule: form.schedule || '0 8 * * *',
      agent: 'SYSTEM',
      enabled: true,
      category: 'SYSTEM',
    }
    try {
      await invoke('save_loop_to_fs', { loop: newLoop })
      await loadLoops()
      setShowNew(false)
      setForm({ name: '', desc: '', schedule: '' })
    } catch (e) { console.error(e) }
  }

  return (
    <div className="min-h-full bg-[#fbfaf8] text-black">
      <div className="px-10 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text- tracking-[0.35em] font-mono text-black/30">
              <span>LOYO OS</span><span className="w-1 h-1 rounded-full bg-black/20" /><span>LOOPS</span>
              <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-black text-white text- tracking-widest">
                <span className={`w-1.5 h-1.5 rounded-full ${syncStatus==='synced'?'animate-pulse':''}`} style={{ background: syncStatus==='synced'?ACCENT:syncStatus==='syncing'?'#FFC107':'#F44336' }} />
                {syncStatus==='synced'?'LIVE':syncStatus==='syncing'?'SYNCING...':'ERROR'}
              </span>
            </div>
            <h1 className="mt-4 text- leading-[0.85] tracking-[-0.06em] font-black uppercase">LOOPS <span className="font-mono font-light text- tracking-[0.1em] text-black/20">/ {String(loops.length).padStart(2,'0')}</span></h1>
            <p className="mt-3 text- leading-[1.6] text-black/40 max-w- font-mono">Ukládá se do <span className="text-black font-bold">D:\dev\loyo-os\data\loops</span> • cron + webhook + event</p>
          </div>
          <button onClick={()=>setShowNew(true)} className="px-7 py-3 rounded-full text- font-black tracking-[0.15em] text-white" style={{ background: ACCENT }}>+ NOVÝ LOOP</button>
        </div>
      </div>
      <div className="px-10 pb-20">
        {loops.length===0?(
          <div className="mt-12 border border-dashed border-black/10 rounded- p-20 text-center bg-white">
            <div className="w-20 h-20 mx-auto rounded-full bg-black text-white flex items-center justify-center text- font-black">∅</div>
            <div className="mt-8 text- tracking-[0.3em] font-mono text-black/30">ŽÁDNÉ LOOPS</div>
            <h3 className="mt-3 text- font-black tracking-tight leading-[0.9]">Čistý stůl.<br />Začni prvním loopem.</h3>
            <p className="mt-4 text- text-black/40 max-w- mx-auto">Složka <b>D:\dev\loyo-os\data\loops</b> je prázdná. Builder pak vygeneruje cron / webhook.</p>
            <button onClick={()=>setShowNew(true)} className="mt-8 px-8 py-3 rounded-full text-white text- font-black tracking-widest" style={{ background: ACCENT }}>+ VYTVOŘIT PRVNÍ LOOP</button>
          </div>
        ):(
          <div className="mt-2 grid grid-cols-12 gap-5">
            {loops.map(l=>{
              const isScheduled = (l as any).source === 'commands.json'
              return (
                <div key={l.id} className={`col-span-12 md:col-span-6 xl:col-span-4 rounded- border p-7 ${isScheduled ? 'bg-[#FFF8F0] border-[#FF9500]/20' : 'bg-white border-black/5'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {isScheduled && <span className="text-sm">⏰</span>}
                      <div className="text- font-black">{l.name}</div>
                    </div>
                    <div className="flex gap-1.5">
                      {isScheduled && <span className="text- px-2 py-1 rounded-full bg-[#FF9500] text-white font-bold">SCHEDULED</span>}
                      <span className={`text- px-2 py-1 rounded-full text-white font-bold ${l.status === 'ACTIVE' ? 'bg-black' : 'bg-black/40'}`}>{l.status}</span>
                    </div>
                  </div>
                  <div className="mt-1 text- font-mono text-black/40">{l.desc||'Bez popisu'}</div>
                  <div className="mt-4 text- font-mono text-black/30">{l.schedule} • {l.agent} • {l.enabled?'ENABLED':'PAUSED'}</div>
                  {isScheduled && <div className="mt-2 text- font-mono text-black/20">zdroj: commands.json</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {showNew&&(
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={()=>setShowNew(false)} />
          <div className="w- bg-white border-l border-black/10 h-full overflow-auto p-8">
            <div className="flex justify-between items-start">
              <div><div className="text- tracking-[0.3em] font-mono text-black/30">NOVÝ LOOP</div><h2 className="mt-2 text- font-black tracking-tight">Vytvořit loop</h2></div>
              <button onClick={()=>setShowNew(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">✕</button>
            </div>
            <div className="mt-8 space-y-5">
              <div><label className="text- font-mono tracking-widest text-black/40">NÁZEV</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="daily-brief" className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 outline-none text- font-bold" /></div>
              <div><label className="text- font-mono tracking-widest text-black/40">POPIS</label><textarea value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} rows={3} className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 outline-none text-" /></div>
              <div><label className="text- font-mono tracking-widest text-black/40">CRON</label><input value={form.schedule} onChange={e=>setForm({...form,schedule:e.target.value})} placeholder="0 8 * * *" className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 outline-none text- font-mono" /></div>
              <button onClick={createLoop} className="w-full py-4 rounded-full text-white text- font-black tracking-[0.2em]" style={{ background: ACCENT }}>VYTVOŘIT LOOP → data/loops/</button>
            </div>
          </div>
        </div>
      )}
      <div className="h- w-full" style={{ background: ACCENT }} />
    </div>
  )
}