import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'

const ACCENT = '#FF3B30'
const BLUE = '#000000'
const GOLD = '#EEEAE1'

type AgentLite = {
  id: string
  name: string
  folder: string
  role: string
  status: string
  fullName?: string
}

type Team = {
  id: string
  name: string
  desc: string
  color: string
  status: 'ACTIVE' | 'IDLE' | 'COLLAB'
  purpose: string
  agents: string[] // idčka agentů
  ragFiles: string[]
  canCollaborateWith: string[]
  workflows: string[]
  loops: string[]
  createdAt: string
}

export default function Team() {
  const [teams, setTeams] = useState<Team[]>([])
  const [allAgents, setAllAgents] = useState<AgentLite[]>([])
  const [allLoops, setAllLoops] = useState<any[]>([])
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const [selectedId, setSelectedId] = useState<string>('')
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState('')
  const [newLoop, setNewLoop] = useState('')

  useEffect(() => {
    loadAll()
    const id = setInterval(() => loadAll(), 5000)
    return () => clearInterval(id)
  }, [])

  const loadAll = async () => {
    await Promise.all([loadTeams(), loadAgents(), loadLoops()])
  }

  const loadTeams = async () => {
    setSyncStatus('syncing')
    try {
      const data = await invoke<any>('sync_teams_from_fs')
      const raw = Array.isArray(data)? data : data.teams || []
      setTeams(raw)
      if (raw.length > 0 &&!selectedId) setSelectedId(raw[0].id)
      setSyncStatus('synced')
    } catch (e) {
      console.error(e)
      setSyncStatus('error')
    }
  }

  const loadAgents = async () => {
    try {
      const data = await invoke<any>('sync_agents_from_fs')
      const raw = Array.isArray(data)? data : data.agents || []
      setAllAgents(raw.map((a: any) => ({ id: a.id, name: a.name, folder: a.folder, role: a.role, status: a.status, fullName: a.name })))
    } catch (e) { console.error(e) }
  }

  const loadLoops = async () => {
    try {
      const data = await invoke<any>('sync_loops_from_fs')
      const raw = Array.isArray(data)? data : data.loops || []
      setAllLoops(raw)
    } catch (e) { console.error(e) }
  }

  const selected = useMemo(() => teams.find(t => t.id === selectedId) || teams[0], [teams, selectedId])

  const availableAgents = useMemo(() => {
    if (!selected) return []
    return allAgents.filter(a =>!selected.agents.includes(a.id))
  }, [allAgents, selected])

  const saveTeam = async (team: Team) => {
    await invoke('save_team_to_fs', { team })
    await loadTeams()
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    const newTeam: Team = {
      id: newTeamName.toLowerCase().replace(/\s+/g, '-'),
      name: newTeamName.toUpperCase(),
      desc: 'Nový tým - doplň popis',
      color: BLUE,
      status: 'IDLE',
      purpose: 'Doplň účel týmu - např. Revenue, Research...',
      agents: [],
      ragFiles: [],
      canCollaborateWith: [],
      workflows: [],
      loops: [],
      createdAt: new Date().toISOString().slice(0, 10)
    }
    await invoke('save_team_to_fs', { team: newTeam })
    await loadTeams()
    setSelectedId(newTeam.id)
    setNewTeamName('')
    setShowNewTeam(false)
  }

  const handleAddAgentToTeam = async (agentId: string) => {
    if (!selected) return
    const updated = {...selected, agents: [...selected.agents, agentId] }
    await saveTeam(updated)
    setShowAddAgent(false)
  }

  const handleRemoveAgent = async (agentId: string) => {
    if (!selected) return
    const updated = {...selected, agents: selected.agents.filter(id => id!== agentId) }
    await saveTeam(updated)
  }

  const toggleCollaboration = async (otherTeamId: string) => {
    if (!selected) return
    const has = selected.canCollaborateWith.includes(otherTeamId)
    const updated = {...selected, canCollaborateWith: has? selected.canCollaborateWith.filter(id => id!== otherTeamId) : [...selected.canCollaborateWith, otherTeamId] }
    await saveTeam(updated)
  }

  const handleAddWorkflow = async () => {
    if (!newWorkflow.trim() ||!selected) return
    const updated = {...selected, workflows: [...selected.workflows, newWorkflow.trim()] }
    await saveTeam(updated)
    setNewWorkflow('')
  }

  const handleAddLoop = async () => {
    if (!newLoop.trim() ||!selected) return
    const updated = {...selected, loops: [...selected.loops, newLoop.trim()] }
    await saveTeam(updated)
    setNewLoop('')
  }

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Smazat tým?')) return
    await invoke('delete_team_from_fs', { teamId: id })
    await loadTeams()
  }

  if (!selected && teams.length === 0) {
    return (
      <div className="min-h-full bg-[#fbfaf8] text-black p-10">
        <div className="flex items-center gap-2 text- tracking-[0.35em] font-mono text-black/30">
          <span>LOYO OS</span><span className="w-1 h-1 rounded-full bg-black/20" /><span>TEAMS</span>
          <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-black text-white text- tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} /> LIVE / 0
          </span>
        </div>
        <div className="mt-12 border border-dashed border-black/10 rounded- p-20 text-center bg-white">
          <div className="w-20 h-20 mx-auto rounded-full bg-black text-white flex items-center justify-center text- font-black">∅</div>
          <div className="mt-8 text- tracking-[0.3em] font-mono text-black/30">ŽÁDNÉ TÝMY</div>
          <h3 className="mt-3 text- font-black tracking-tight leading-[0.9]">Založ první tým.<br />Přiřaď agenty + workflows + loopy.</h3>
          <p className="mt-4 text- text-black/40 max-w- mx-auto">Ukládá se do <b>D:\dev\loyo-os\data\teams</b>. Builder pak přepíše pravidla.</p>
          <button onClick={() => setShowNewTeam(true)} className="mt-8 px-8 py-3 rounded-full text-white text- font-black tracking-widest" style={{ background: ACCENT }}>+ ZALOŽIT PRVNÍ TÝM</button>
        </div>
        {showNewTeam && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setShowNewTeam(false)} />
            <div className="w- bg-white border-l border-black/10 h-full p-8">
              <h2 className="text- font-black">Nový tým</h2>
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Obchodní tým" className="mt-6 w-full px-4 py-3 rounded-xl border border-black/10 text- font-bold outline-none" />
              <button onClick={handleCreateTeam} className="mt-4 w-full py-4 rounded-full text-white text- font-black tracking-[0.2em]" style={{ background: ACCENT }}>VYTVOŘIT TÝM → data/teams/</button>
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
              <span>TÝMY // LOYO-OS • {teams.length} TÝMŮ • {allAgents.length} AGENTŮ</span>
              <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-black text-white text- tracking-widest">
                <span className={`w-1.5 h-1.5 rounded-full ${syncStatus==='synced'?'animate-pulse':''}`} style={{ background: syncStatus==='synced'?ACCENT:syncStatus==='syncing'?'#FFC107':'#F44336' }} />
                {syncStatus==='synced'?'LIVE':syncStatus==='syncing'?'SYNCING...':'ERROR'}
              </span>
            </div>
            <h1 className="text-3xl font-black mt-1 tracking-tighter">{teams.length} TÝMY • {teams.reduce((a,b)=>a+b.agents.length,0)} AGENTŮ V TÝMECH • WORKFLOW READY</h1>
            <div className="mt-3 flex gap-2">
              <span className="text- px-2 py-1 bg-black text-white">ACTIVE: {teams.filter(t=>t.status==='ACTIVE' || t.status==='COLLAB').length}</span>
              <span className="text- px-2 py-1 border-2 border-black">DATA: D:/dev/loyo-os/data/teams</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowNewTeam(true)} className="px-6 py-3 bg-black text-white font-black text-xs tracking-[0.2em] border-2 border-black hover:bg-white hover:text-black">+ NOVÝ TÝM</button>
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: ACCENT }} />
          </div>
        </div>
      </div>

      <div className="px-10 pb-20 grid grid-cols-12 gap-6">
        <div className="col-span-4 bg-white border-2 border-black h-[calc(100vh-240px)] flex flex-col">
          <div className="p-4 text- tracking-[0.4em] text-black/40 border-b-2 border-black">TEAMS LIST // {teams.length}</div>
          <div className="flex-1 overflow-y-auto">
            {teams.map(t => {
              const isActive = selectedId === t.id
              return (
                <div key={t.id} onClick={() => setSelectedId(t.id)} className="p-5 cursor-pointer border-b-2 border-black flex justify-between" style={{ background: isActive? BLUE : 'white', color: isActive? 'white' : 'black' }}>
                  <div className="flex-1">
                    <div className="flex gap-2 items-center">
                      <span className="font-black text-sm">{t.name}</span>
                      <span className="text- px-2 py-0.5 bg-white text-black border">{t.status}</span>
                    </div>
                    <div className="text- opacity-60 mt-1 line-clamp-1">{t.purpose}</div>
                    <div className="mt-2 text- opacity-50">{t.agents.length} agentů • {t.workflows.length} workflows • {t.loops.length} loops</div>
                  </div>
                  <div className="ml-3 w-2 h-2 rounded-full self-center" style={{ background: t.color === BLUE? GOLD : t.color }} />
                </div>
              )
            })}
          </div>
        </div>

        <div className="col-span-8 bg-white border-2 border-black p-8 h-[calc(100vh-240px)] overflow-y-auto">
          {!selected? <div>Vyber tým</div> : (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text- px-2 py-1 bg-black text-white tracking-widest">{selected.id.toUpperCase()}</span>
                    <span className="text- px-2 py-1 border-2 border-black font-black" style={{ background: selected.status === 'ACTIVE'? '#22c55e' : '#eee' }}>{selected.status}</span>
                    <span className="text- px-2 py-1" style={{ background: GOLD }}>{selected.agents.length} AGENTŮ</span>
                    <span className="text- px-2 py-1 border">{selected.workflows.length} WORKFLOWS</span>
                    <span className="text- px-2 py-1 border">{selected.loops.length} LOOPS</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter mt-3 uppercase">{selected.name}</h2>
                  <div className="text-xs text-black/60 mt-2 max-w- leading-relaxed">{selected.desc}</div>
                  <div className="text- mt-2 opacity-50">Účel: {selected.purpose} • Vytvořeno: {selected.createdAt}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDeleteTeam(selected.id)} className="text- px-3 py-1 border border-red-500 text-red-500">SMAZAT TÝM</button>
                  <div className="w-3 h-3" style={{ background: selected.color }} />
                </div>
              </div>

              <div className="mt-8 border-2 border-black">
                <div className="p-3 bg-black text-white text- tracking-[0.3em] flex justify-between">
                  <span>AGENTI V TÝMU // {selected.agents.length} • PŘIŘAĎ AGENTY Z D:/dev/loyo-os/data/agents</span>
                  <button onClick={() => setShowAddAgent(!showAddAgent)} className="px-3 py-1 bg-white text-black font-black text-">+ PŘIDAT AGENTA</button>
                </div>

                {showAddAgent && (
                  <div className="p-4 bg-[#fefce8] border-b-2 border-black grid grid-cols-2 gap-2">
                    {availableAgents.length === 0? <div className="text-xs opacity-40 col-span-2">Všichni agenti už jsou v týmu • agenti se načítají LIVE z data/agents</div> : availableAgents.map(a => (
                      <button key={a.id} onClick={() => handleAddAgentToTeam(a.id)} className="text-left p-3 border-2 border-black bg-white hover:bg-black hover:text-white flex justify-between items-center">
                        <div><div className="font-black text-xs">{a.name}</div><div className="text- opacity-60">{a.role} • {a.folder}</div></div>
                        <span className="text- font-black">+ ADD</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-4 grid grid-cols-2 gap-3">
                  {selected.agents.map(agentId => {
                    const agent = allAgents.find(a => a.id === agentId)
                    return (
                      <div key={agentId} className="border-2 border-black p-4 flex justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-xs">{(agent?.name || agentId)[0]}</div>
                            <div>
                              <div className="font-black text-sm">{agent?.name || agentId}</div>
                              <div className="text- opacity-60">{agent?.folder || agentId} • {agent?.role || 'Agent'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text- px-2 py-1 bg-black text-white">{agent?.status || 'ONLINE'}</div>
                          <button onClick={() => handleRemoveAgent(agentId)} className="mt-2 text- px-2 py-1 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white">ODEBRAT</button>
                        </div>
                      </div>
                    )
                  })}
                  {selected.agents.length === 0 && <div className="col-span-2 text-center py-6 text-xs opacity-30">TÝM JE PRÁZDNÝ • PŘIDEJ AGENTY TLAČÍTKEM NAHOŘE</div>}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6">
                <div className="border-2 border-black p-4">
                  <div className="text- tracking-[0.3em] opacity-40">WORKFLOWS V TÝMU // AKCE + AGENTI + LOOPY</div>
                  <div className="mt-3 space-y-2">
                    {selected.workflows.map(w => (
                      <div key={w} className="flex justify-between items-center border-2 border-black p-3 bg-white">
                        <span className="font-bold text-xs">{w}</span>
                        <span className="text- px-2 py-1 bg-black text-white">WORKFLOW</span>
                      </div>
                    ))}
                    {selected.workflows.length === 0 && <div className="text- opacity-40">Žádný workflow - přidej níže</div>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input value={newWorkflow} onChange={e => setNewWorkflow(e.target.value)} placeholder="např. novy-klient-workflow" className="flex-1 px-3 py-2 border-2 border-black text- outline-none" />
                    <button onClick={handleAddWorkflow} className="px-4 py-2 bg-black text-white text- font-black">+ PŘIDAT WORKFLOW</button>
                  </div>
                  <div className="mt-2 text- opacity-50">Workflow může obsahovat: akce, agenty, loopy, podmínky - přesně jak chceš: akce, akce, loop, akce, loop...</div>
                </div>

                <div className="border-2 border-black p-4" style={{ background: '#fbfaf8' }}>
                  <div className="text- tracking-[0.3em] opacity-40">LOOPS V TÝMU // CRON • WEBHOOK</div>
                  <div className="mt-3 space-y-2">
                    {selected.loops.map(l => (
                      <div key={l} className="flex justify-between items-center border-2 border-black p-3 bg-white">
                        <span className="font-bold text-xs">{l}</span>
                        <span className="text- px-2 py-1" style={{ background: GOLD }}>LOOP</span>
                      </div>
                    ))}
                    {selected.loops.length === 0 && <div className="text- opacity-40">Žádný loop - přidej níže</div>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <select value={newLoop} onChange={e => setNewLoop(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black text- outline-none">
                      <option value="">-- vyber z existujících loopů --</option>
                      {allLoops.map((lp: any) => <option key={lp.id} value={lp.id}>{lp.name} ({lp.schedule})</option>)}
                    </select>
                    <button onClick={handleAddLoop} className="px-4 py-2 bg-black text-white text- font-black">+ PŘIDAT LOOP</button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input value={newLoop} onChange={e => setNewLoop(e.target.value)} placeholder="nebo napiš vlastní loop id" className="flex-1 px-3 py-2 border border-black/20 text- outline-none" />
                  </div>
                </div>
              </div>

              <div className="mt-6 border-2 border-black p-4">
                <div className="text- tracking-[0.3em] opacity-40">SPOLUPRÁCE TÝMŮ // KTERÉ TÝMY MOHOU SPOLUPRACOVAT</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {teams.filter(t => t.id!== selected.id).map(other => {
                    const can = selected.canCollaborateWith.includes(other.id)
                    return (
                      <button key={other.id} onClick={() => toggleCollaboration(other.id)} className="p-3 border-2 text-left flex justify-between items-center" style={{ background: can? BLUE : 'white', color: can? 'white' : 'black', borderColor: 'black' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2" style={{ background: other.color }}></div>
                          <span className="font-black text-xs">{other.name}</span>
                        </div>
                        <span className="text- font-black px-2 py-1 bg-white text-black">{can? 'COLLAB ON' : 'OFF'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-1 py-3 bg-black text-white font-black text-xs tracking-widest border-2 border-black hover:bg-[#59CBFF] hover:text-black">EDITOVAT TÝM V BUILDERU →</button>
                <button className="px-6 py-3 border-2 border-black text-xs font-bold">DUPLIKOVAT TÝM</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewTeam && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setShowNewTeam(false)} />
          <div className="w- bg-white border-l border-black/10 h-full p-8">
            <div className="flex justify-between items-start">
              <div><div className="text- tracking-[0.3em] font-mono text-black/30">NOVÝ TÝM</div><h2 className="mt-2 text- font-black tracking-tight">Založit tým</h2></div>
              <button onClick={() => setShowNewTeam(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">✕</button>
            </div>
            <div className="mt-8 space-y-5">
              <div><label className="text- font-mono tracking-widest text-black/40">NÁZEV TÝMU</label><input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Obchodní tým" className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 outline-none text- font-bold" /></div>
              <p className="text- text-black/40 leading-relaxed">Vytvoří složku v <b>D:\dev\loyo-os\data\teams\{newTeamName.toLowerCase().replace(/\s+/g, '-')}</b> - tam pak builder zapíše agenty, workflows, loopy, RAG, pravidla.</p>
              <button onClick={handleCreateTeam} className="w-full py-4 rounded-full text-white text- font-black tracking-[0.2em]" style={{ background: ACCENT }}>ZALOŽIT TÝM → data/teams/</button>
            </div>
          </div>
        </div>
      )}
      <div className="h- w-full" style={{ background: ACCENT }} />
    </div>
  )
}