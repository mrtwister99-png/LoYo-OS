import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'

const ACCENT = '#FF3B30'
const GOLD = '#EEEAE1'

type StepType = 'loop' | 'agent' | 'skill' | 'action' | 'condition'

type WorkflowStep = {
  type: StepType
  id: string
  name: string
}

type Workflow = {
  id: string
  name: string
  desc: string
  status: 'live' | 'draft' | 'error'
  steps: WorkflowStep[]
  lastRun: string
  createdAt: string
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [allLoops, setAllLoops] = useState<any[]>([])
  const [allAgents, setAllAgents] = useState<any[]>([])
  const [allSkills, setAllSkills] = useState<any[]>([])
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const [selectedId, setSelectedId] = useState<string>('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', desc: '' })
  const [newStepType, setNewStepType] = useState<StepType>('loop')
  const [newStepId, setNewStepId] = useState('')

  useEffect(() => {
    loadAll()
    const id = setInterval(() => loadAll(), 5000)
    return () => clearInterval(id)
  }, [])

  const loadAll = async () => {
    await Promise.all([loadWorkflows(), loadLoops(), loadAgents(), loadSkills()])
  }

  const loadWorkflows = async () => {
    setSyncStatus('syncing')
    try {
      const data = await invoke<any>('sync_workflows_from_fs')
      const raw = Array.isArray(data)? data : data.workflows || []
      setWorkflows(raw)
      if (raw.length > 0 &&!selectedId) setSelectedId(raw[0].id)
      setSyncStatus('synced')
    } catch (e) { console.error(e); setSyncStatus('error') }
  }

  const loadLoops = async () => {
    try { const d = await invoke<any>('sync_loops_from_fs'); setAllLoops(Array.isArray(d)? d : d.loops || []) } catch {}
  }
  const loadAgents = async () => {
    try { const d = await invoke<any>('sync_agents_from_fs'); setAllAgents(Array.isArray(d)? d : d.agents || []) } catch {}
  }
  const loadSkills = async () => {
    try { const d = await invoke<any>('sync_skills_from_fs'); setAllSkills(Array.isArray(d)? d : d.skills || []) } catch {}
  }

  const selected = useMemo(() => workflows.find(w => w.id === selectedId) || workflows[0], [workflows, selectedId])

  const createWorkflow = async () => {
    if (!form.name.trim()) return
    const wf: Workflow = {
      id: form.name.toLowerCase().replace(/\s+/g, '-'),
      name: form.name,
      desc: form.desc || 'Nový workflow - poskládej kroky: akce, agent, loop...',
      status: 'draft',
      steps: [],
      lastRun: 'nikdy',
      createdAt: new Date().toISOString().slice(0,10)
    }
    await invoke('save_workflow_to_fs', { workflow: wf })
    await loadWorkflows()
    setSelectedId(wf.id)
    setShowNew(false)
    setForm({ name: '', desc: '' })
  }

  const addStep = async () => {
    if (!selected ||!newStepId.trim()) return
    const nameMap: any = {
      loop: allLoops.find(l => l.id === newStepId)?.name || newStepId,
      agent: allAgents.find(a => a.id === newStepId)?.name || newStepId,
      skill: allSkills.find(s => s.id === newStepId)?.name || newStepId,
      action: newStepId,
      condition: newStepId
    }
    const step: WorkflowStep = { type: newStepType, id: newStepId, name: nameMap[newStepType] }
    const updated = {...selected, steps: [...selected.steps, step] }
    await invoke('save_workflow_to_fs', { workflow: updated })
    await loadWorkflows()
    setNewStepId('')
  }

  const removeStep = async (idx: number) => {
    if (!selected) return
    const updated = {...selected, steps: selected.steps.filter((_, i) => i!== idx) }
    await invoke('save_workflow_to_fs', { workflow: updated })
    await loadWorkflows()
  }

  const toggleStatus = async () => {
    if (!selected) return
    const newStatus = selected.status === 'live'? 'draft' : 'live'
    const updated = {...selected, status: newStatus }
    await invoke('save_workflow_to_fs', { workflow: updated })
    await loadWorkflows()
  }

  const deleteWf = async (id: string) => {
    if (!confirm('Smazat workflow?')) return
    await invoke('delete_workflow_from_fs', { workflowId: id })
    await loadWorkflows()
  }

  if (workflows.length === 0) {
    return (
      <div className="min-h-full bg-[#fbfaf8] text-black p-10">
        <div className="flex items-center gap-2 text- tracking-[0.35em] font-mono text-black/30">
          <span>LOYO OS</span><span className="w-1 h-1 rounded-full bg-black/20" /><span>WORKFLOWS</span>
          <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-black text-white text- tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} /> LIVE / 0
          </span>
        </div>
        <div className="mt-12 border border-dashed border-black/10 rounded- p-20 text-center bg-white">
          <div className="w-20 h-20 mx-auto rounded-full bg-black text-white flex items-center justify-center text- font-black">∅</div>
          <div className="mt-8 text- tracking-[0.3em] font-mono text-black/30">ŽÁDNÉ WORKFLOWS</div>
          <h3 className="mt-3 text- font-black tracking-tight leading-[0.9]">První workflow.<br />akce → agent → loop → akce → loop</h3>
          <p className="mt-4 text- text-black/40 max-w- mx-auto">Ukládá se do <b>D:\dev\loyo-os\data\workflows</b>. Každý krok je tvůj loop, agent, skill nebo akce.</p>
          <button onClick={() => setShowNew(true)} className="mt-8 px-8 py-3 rounded-full text-white text- font-black tracking-widest" style={{ background: ACCENT }}>+ VYTVOŘIT PRVNÍ WORKFLOW</button>
        </div>
        {showNew && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setShowNew(false)} />
            <div className="w- bg-white border-l border-black/10 h-full p-8">
              <h2 className="text- font-black">Nový workflow</h2>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Lead → SMS → CRM" className="mt-6 w-full px-4 py-3 rounded-xl border border-black/10 text- font-bold outline-none" />
              <textarea value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Co dělá..." rows={3} className="mt-3 w-full px-4 py-3 rounded-xl border border-black/10 text- outline-none" />
              <button onClick={createWorkflow} className="mt-4 w-full py-4 rounded-full text-white text- font-black tracking-[0.2em]" style={{ background: ACCENT }}>VYTVOŘIT WORKFLOW → data/workflows/</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#F8F6F1] text-black">
      <div className="px-10 pt-8 pb-6">
        <div className="bg-white border-2 border-black p-6 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text- tracking-[0.4em] text-black/40">
              <span>WORKFLOWS // {workflows.length} FLOW • {workflows.reduce((a,b)=>a+b.steps.length,0)} STEPS CELKEM</span>
              <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-black text-white text- tracking-widest">
                <span className={`w-1.5 h-1.5 rounded-full ${syncStatus==='synced'?'animate-pulse':''}`} style={{ background: syncStatus==='synced'?ACCENT:syncStatus==='syncing'?'#FFC107':'#F44336' }} />
                {syncStatus==='synced'?'LIVE':syncStatus==='syncing'?'SYNCING...':'ERROR'}
              </span>
            </div>
            <h1 className="text-3xl font-black mt-1 tracking-tighter">WORKFLOWS • {workflows.filter(w=>w.status==='live').length} LIVE • SPOJUJE LOOPS + AGENTS + SKILLS</h1>
            <div className="mt-2 text- opacity-50">Ukládá se do D:/dev/loyo-os/data/workflows • každý krok může být loop, agent, skill, akce, podmínka</div>
          </div>
          <button onClick={() => setShowNew(true)} className="px-6 py-3 bg-black text-white font-black text-xs tracking-[0.2em] border-2 border-black hover:bg-white hover:text-black">+ NEW WORKFLOW</button>
        </div>
      </div>

      <div className="px-10 pb-20 grid grid-cols-12 gap-6">
        <div className="col-span-4 bg-white border-2 border-black h-[calc(100vh-240px)] flex flex-col">
          <div className="p-4 text- tracking-[0.4em] text-black/40 border-b-2 border-black">WORKFLOWS LIST // {workflows.length}</div>
          <div className="flex-1 overflow-y-auto">
            {workflows.map(w => {
              const active = w.id === selectedId
              return (
                <div key={w.id} onClick={() => setSelectedId(w.id)} className="p-5 cursor-pointer border-b-2 border-black flex justify-between" style={{ background: active? '#000' : 'white', color: active? 'white' : 'black' }}>
                  <div>
                    <div className="flex items-center gap-2"><span className="font-black text-sm">{w.name}</span><span className={`w-2 h-2 rounded-full ${w.status==='live'?'bg-emerald-500': w.status==='draft'?'bg-yellow-400':'bg-red-500'}`} /></div>
                    <div className="text- opacity-60 mt-1">{w.steps.length} steps • {w.lastRun}</div>
                  </div>
                  <div className="text- px-2 py-1 bg-white text-black border self-center">{w.status.toUpperCase()}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="col-span-8 bg-white border-2 border-black p-8 h-[calc(100vh-240px)] overflow-y-auto">
          {!selected? <div>Vyber workflow</div> : (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2">
                    <span className="text- px-2 py-1 bg-black text-white">{selected.id}</span>
                    <span className="text- px-2 py-1 border-2 border-black font-black" style={{ background: selected.status==='live'? '#22c55e' : GOLD }}>{selected.status.toUpperCase()}</span>
                    <span className="text- px-2 py-1 border">{selected.steps.length} STEPS</span>
                  </div>
                  <h2 className="text-3xl font-black mt-3 uppercase">{selected.name}</h2>
                  <div className="text-xs text-black/60 mt-2 max-w-">{selected.desc}</div>
                  <div className="text- mt-2 opacity-50">Last run: {selected.lastRun} • Vytvořeno: {selected.createdAt}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={toggleStatus} className="text- px-3 py-1 border-2 border-black font-black">{selected.status==='live'?'→ DRAFT':'→ LIVE'}</button>
                  <button onClick={() => deleteWf(selected.id)} className="text- px-3 py-1 border border-red-500 text-red-500">SMAZAT</button>
                </div>
              </div>

              <div className="mt-8 border-2 border-black">
                <div className="p-3 bg-black text-white text- tracking-[0.3em] flex justify-between">
                  <span>STEPS // {selected.steps.length} KROKŮ • AKCE, AGENT, LOOP, PODMÍNKA - LIBOVOLNĚ</span>
                  <span className="opacity-60">DRAG & DROP V BUILDERU</span>
                </div>
                <div className="p-6 bg-[#fafafa]">
                  {selected.steps.length === 0? (
                    <div className="text-center py-10 text-xs opacity-30">Žádné kroky • přidej níže - např. akce → agent → loop → akce → loop přesně jak chceš</div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {selected.steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="border-2 border-black bg-white px-4 py-3 min-w- relative group">
                            <div className="text- tracking-widest opacity-40">{step.type.toUpperCase()} • {idx+1}</div>
                            <div className="font-black text-xs mt-1">{step.name}</div>
                            <div className="text- mt-1 opacity-50">{step.id}</div>
                            <button onClick={() => removeStep(idx)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text- hidden group-hover:flex items-center justify-center">✕</button>
                          </div>
                          {idx < selected.steps.length -1 && <div className="text-xl font-black">→</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 border-2 border-black p-4 bg-white">
                <div className="text- tracking-[0.3em] opacity-40">PŘIDAT KROK // LOOP / AGENT / SKILL / AKCE / PODMÍNKA</div>
                <div className="mt-4 flex gap-2">
                  <select value={newStepType} onChange={e => setNewStepType(e.target.value as any)} className="px-3 py-2 border-2 border-black text- font-black">
                    <option value="loop">LOOP</option>
                    <option value="agent">AGENT</option>
                    <option value="skill">SKILL</option>
                    <option value="action">ACTION</option>
                    <option value="condition">CONDITION / IF</option>
                  </select>
                  {newStepType === 'loop' && (
                    <select value={newStepId} onChange={e => setNewStepId(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black text-">
                      <option value="">-- vyber loop --</option>
                      {allLoops.map((l:any) => <option key={l.id} value={l.id}>{l.name} ({l.schedule})</option>)}
                    </select>
                  )}
                  {newStepType === 'agent' && (
                    <select value={newStepId} onChange={e => setNewStepId(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black text-">
                      <option value="">-- vyber agenta --</option>
                      {allAgents.map((a:any) => <option key={a.id} value={a.id}>{a.name} - {a.role}</option>)}
                    </select>
                  )}
                  {newStepType === 'skill' && (
                    <select value={newStepId} onChange={e => setNewStepId(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black text-">
                      <option value="">-- vyber skill --</option>
                      {allSkills.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  {(newStepType === 'action' || newStepType === 'condition') && (
                    <input value={newStepId} onChange={e => setNewStepId(e.target.value)} placeholder={newStepType==='action'?'např. save-to-supabase':'např. score>80?'} className="flex-1 px-3 py-2 border-2 border-black text- outline-none" />
                  )}
                  <button onClick={addStep} className="px-6 py-2 bg-black text-white text- font-black">+ PŘIDAT KROK</button>
                </div>
                <div className="mt-3 text- opacity-40">Příklad workflow: <b>Najdi firmy (skill) → pro každou spusť finder-loop (loop) → pokud nemá web (condition) → přidej do lead-loop (loop) → napiš e-mail (agent)</b> - přesně jak říkáš, libovolně za sebou.</div>
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-1 py-3 bg-black text-white font-black text-xs tracking-widest border-2 border-black hover:bg-[#59CBFF] hover:text-black">RUN WORKFLOW NOW</button>
                <button className="px-6 py-3 border-2 border-black text-xs font-bold">DUPLIKOVAT</button>
              </div>

              <div className="mt-6 p-4 bg-[#EEEAE1] border border-black/5">
                <div className="mono text- tracking-[0.3em] opacity-30 mb-2">TIP - WORKFLOW VS LOOP</div>
                <div className="text- leading-5 opacity-70">Loop = časovač (cron) co se opakuje. Workflow = graf kroků kde mícháš <b>loopy, agenty, skills, akce, podmínky</b> - workflow pak může spouštět loopy a loopy mohou spouštět workflow. Proto potřebuješ obojí.</div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="w- bg-white border-l border-black/10 h-full p-8">
            <h2 className="text- font-black">Nový workflow</h2>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Lead → SMS → CRM" className="mt-6 w-full px-4 py-3 rounded-xl border border-black/10 text- font-bold outline-none" />
            <textarea value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Co dělá workflow..." rows={3} className="mt-3 w-full px-4 py-3 rounded-xl border border-black/10 text- outline-none" />
            <button onClick={createWorkflow} className="mt-4 w-full py-4 rounded-full text-white text- font-black tracking-[0.2em]" style={{ background: ACCENT }}>VYTVOŘIT WORKFLOW → data/workflows/</button>
          </div>
        </div>
      )}
      <div className="h- w-full" style={{ background: ACCENT }} />
    </div>
  )
}