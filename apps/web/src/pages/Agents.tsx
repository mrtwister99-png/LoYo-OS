
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import AgentBuilder from '../components/builder/AgentBuilder'
import { categoryColors, categoryNumbers } from '../styles/theme'
import NumBadge, { useCapNumbers } from '../components/NumBadge'
import TridilPanel from '../components/TridilPanel'
import LootCheckerPanel from '../components/LootCheckerPanel'
import LopatinkaPanel from '../components/LopatinkaPanel'
import MaryTelegramPanel from '../components/MaryTelegramPanel'
import StepanPanel from '../components/StepanPanel'
import LuuuPanel from '../components/LuuuPanel'
import AgentActions, { ActionsEditor, type AgentAction } from '../components/AgentActions'

const ACCENT = '#12a4ff'
const AGENT_COLOR = categoryColors.agents
const AGENT_NUM = categoryNumbers.agents

// kategorie pro pronajimatelne agenty (zluty obrys)
const RENTAL_CAT = 'rental'
const RENTAL_COLOR = '#facc15'

type Tool = { id: string; name: string; icon: string }
type Agent = {
  id: string
  name: string
  role: string
  category: string
  team: string
  status: 'online' | 'offline' | 'busy'
  skills: string[]
  tools: string[]
  workflow: string
  prompt: string
  tasksToday: number
  docs: string[]
  folder: string
  number?: number
  dependencies?: string[]
  loops?: string[]
  endpoints?: Record<string, string>
  actions?: AgentAction[]
  hasScript?: boolean
}

const ALL_TOOLS: Tool[] = [
  { id: 'rag', name: 'RAG', icon: '◧' },
  { id: 'web_search', name: 'web_search', icon: '🌐' },
  { id: 'fs_read', name: 'fs_read', icon: '📁' },
  { id: 'fs_write', name: 'fs_write', icon: '✎' },
  { id: 'cli_firmy', name: 'cli:firmy', icon: '⚙' },
]

const CATS = [
  { id: 'all', name: 'VŠE', count: 0 },
  { id: 'marketing', name: 'MARKETING', count: 0 },
  { id: 'dev', name: 'DEV', count: 0 },
  { id: 'research', name: 'RESEARCH', count: 0 },
  { id: 'sales', name: 'SALES', count: 0 },
  { id: 'rental', name: 'PRONAJÍMATELNÍ', count: 0 },
]

const TEAMS = ['Nezařazen', 'Obchod', 'Hračky', 'LOYO OS v2']

function firstName(full: string) {
  if (!full) return '?'
  // vezmi první slovo před závorkou / čárkou
  const clean = full.split('(')[0].split(',')[0].trim()
  return clean.split(/\s+/)[0] || clean
}

export default function AgentsPro() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const [selectedCat, setSelectedCat] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const capNums = useCapNumbers()
  // ⚙ vpravo nahoře: úpravy (skilly, MCP, CLI, akce, prompt…); normálně jen akce a přehled
  const [editMode, setEditMode] = useState(false)
  useEffect(() => { setEditMode(false) }, [selectedAgent?.id])
  const patchAgent = (upd: Partial<Agent>) => {
    if (!selectedAgent) return
    const next = { ...selectedAgent, ...upd }
    setSelectedAgent(next)
    setAgents(prev => prev.map(a => (a.id === next.id ? next : a)))
  }
  const toggleDep = (mcpId: string) => {
    if (!selectedAgent) return
    const deps = selectedAgent.dependencies ?? []
    const has = deps.some(d => d.split(':')[0] === mcpId)
    const num = capNums.mcp?.[mcpId]
    patchAgent({ dependencies: has ? deps.filter(d => d.split(':')[0] !== mcpId) : [...deps, num != null ? `${mcpId}:${num}` : mcpId] })
  }
  const [showNew, setShowNew] = useState(false)
  const [demoState, setDemoState] = useState<Record<string, 'starting' | 'error' | undefined>>({})

  const openExternal = async (url: string) => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(url)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const runDemo = async (agent: Agent) => {
    const url = agent.endpoints?.demo
    if (!url) return
    setDemoState(s => ({ ...s, [agent.id]: 'starting' }))
    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}/demo`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data?.error || 'spuštění selhalo')
      await openExternal(data.url || url)
      setDemoState(s => ({ ...s, [agent.id]: undefined }))
    } catch (err) {
      console.error('Demo start failed:', err)
      setDemoState(s => ({ ...s, [agent.id]: 'error' }))
    }
  }

  useEffect(() => {
    loadAgentsFromFS(false)
    const id = setInterval(() => loadAgentsFromFS(true), 5000)
    return () => clearInterval(id)
  }, [])

   const API_URL = 'http://localhost:3001'

  const loadAgentsFromFS = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    setSyncStatus('syncing')
    try {
      let rawAgents: any[] = []
      try {
        const url = search
         ? `${API_URL}/api/agents?search=${encodeURIComponent(search)}`
          : `${API_URL}/api/agents`
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          rawAgents = Array.isArray(json)? json : json.agents || json.data || []
        } else throw new Error('API fail')
      } catch {
        const data = await invoke<any>('sync_agents_from_fs')
        rawAgents = Array.isArray(data)? data : data.agents || []
      }
      const normalized: Agent[] = rawAgents.map((a: any) => ({
        id: a.id,
        folder: a.folder || a.id,
        name: a.displayName || a.name || a.id,
        role: a.role || a.description || '',
        category: a.category || a.type || 'all',
        team: a.team || 'LOYO OS v3',
        status: a.status || 'online',
        skills: a.skills || [],
        tools: a.tools || [],
        workflow: a.workflow || a.runtime || '',
        prompt: a.prompt || a.prompt_file || '',
        docs: a.docs || [],
        tasksToday: a.tasksToday?? 0,
        number: a.number?? a.manifest?.number,
        dependencies: a.dependencies || a.manifest?.dependencies || [],
        loops: a.loops || a.manifest?.loops || [],
        endpoints: a.endpoints || a.manifest?.endpoints || {},
        actions: Array.isArray(a.actions) ? a.actions : [],
        hasScript: !!(a.script || a.shell),
      }))
      setAgents(normalized)
      setSelectedAgent(prev => {
        if (!prev) return prev
        return normalized.find(n => n.id === prev.id) || prev
      })
      setSyncStatus('synced')
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncStatus('error')
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  const filtered = agents.filter(a => {
    const catMatch = selectedCat === 'all' || a.category === selectedCat
    const searchMatch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  })

  // createAgent odstraněn — nahrazeno AgentBuilder

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Opravdu smazat agenta? Složka bude trvale odstraněna.')) return
    try {
      const target = agents.find(a => a.id === agentId)
      await invoke('delete_agent_from_fs', { agentId, folder: target?.folder || '' })
      await loadAgentsFromFS()
      setSelectedAgent(null)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')


  const saveAgent = async () => {
    if (!selectedAgent) return
    setSaveStatus('saving')
    try {
      // kategorie / tým / prompt přes Tauri (jen v aplikaci); akce, MCP, skilly a nástroje vždy do manifestu přes API
      if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) {
        await invoke('save_agent_to_fs', { agent: selectedAgent }).catch((e) => console.warn('Tauri save:', e))
      }
      const res = await fetch(`${API_URL}/api/agents/${selectedAgent.id}/manifest`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: selectedAgent.actions ?? [],
          dependencies: selectedAgent.dependencies ?? [],
          skills: selectedAgent.skills,
          tools: selectedAgent.tools,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      await loadAgentsFromFS(true)
      setEditMode(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const toggleTool = (toolId: string) => {
    if (!selectedAgent) return
    const cur = selectedAgent.tools
    const updated = { ...selectedAgent, tools: cur.includes(toolId) ? cur.filter(t => t !== toolId) : [...cur, toolId] }
    setSelectedAgent(updated)
    setAgents(agents.map(a => a.id === updated.id ? updated : a))
  }

  return (
    <div className="min-h-full bg-[#353535] text-[#f0f0f0] selection:bg-[#444] selection:text-[#f0f0f0]">
      {/* HEADER */}
      <div className="px-6 md:px-10 pt-8 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[56px] leading-[0.85] font-black tracking-tighter">AGENTI</h1>
              <span className="text-[20px] font-mono text-[#9a9a9a]/70">/ {String(filtered.length).padStart(2,'0')}</span>
            </div>  
              <div className="mt-3 text- font-mono tracking-wide text-[#9a9a9a] max-w-">
              Index <span className="font-bold text-[#f0f0f0]">data/index.db ({agents.length} z DB)</span> • zdroj: <span className="font-mono">data/capabilities/agents/*/manifest.json</span> • FTS5 search <span className="font-mono">&lt;5ms</span>
              <span className="ml-3 inline-flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${syncStatus==='synced'?'bg-[#444]':syncStatus==='syncing'?'bg-[#444] animate-pulse':'bg-[#444]'}`} />
                <span className="text-[10px] uppercase tracking-widest">{syncStatus}</span>
              </span>
            </div>
          </div>
          <button onClick={()=>setShowNew(true)} className="shrink-0 px-5 py-3 bg-[#444] text-[#f0f0f0] text-[11px] font-black tracking-[0.2em] rounded-full hover:bg-[#444] transition">+ NOVÝ AGENT</button>
        </div>

        {/* FILTRY */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {CATS.map(cat=>{
              const active = selectedCat===cat.id
              return (
                <button
                  key={cat.id}
                  onClick={()=>setSelectedCat(cat.id)}
                  className={`px-4 py-2 rounded-full text-[11px] font-black tracking-widest border transition ${active? 'bg-[#12a4ff] text-white border-[#12a4ff]':'bg-[#3a3a3a] text-[#9a9a9a] border-[#444] hover:border-[#444]'}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${active?'bg-[#444]':'bg-black/20'}`} />
                  {cat.name}
                </button>
              )
            })}
          </div>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="HLEDAT AGENTA..."
            className="ml-auto w-[240px] px-4 py-2 rounded-full bg-[#3a3a3a] border border-[#444] text-[11px] font-mono tracking-wide outline-none focus:border-[#444]"
          />
        </div>
      </div>

      {/* ČTVERCE - POUZE KŘESTNÍ JMÉNO */}
      <div className="px-6 md:px-10 pb-20">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="aspect-square bg-white/5 animate-pulse rounded-[12px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filtered.map((agent, idx)=>{
              const fn = firstName(agent.name)
              const isOnline = agent.status==='online'
              const isBusy = agent.status==='busy'
              const isRental = agent.category === RENTAL_CAT
              const demoUrl = agent.endpoints?.demo
              const demoPhase = demoState[agent.id]
              return (
                <div
                  key={agent.id}
                  role="button"
                  tabIndex={0}
                  onClick={()=>setSelectedAgent(agent)}
                  onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setSelectedAgent(agent) } }}
                  className="group relative aspect-square bg-[#444] text-[#f0f0f0] rounded- border border-[#444] overflow-hidden flex flex-col items-center justify-center p-4 hover:bg-[#12a4ff] hover:border-white/20 transition-all duration-200 hover:-translate-y- border-l cursor-pointer"
                  style={{
                    borderLeftColor: isRental ? RENTAL_COLOR : AGENT_COLOR,
                    boxShadow: isRental ? `0 0 0 2px ${RENTAL_COLOR}` : '0 0 0 1px rgba(0,0,0,0.05)',
                  }}
                >
                  <NumBadge type={AGENT_NUM} n={agent.number} idx={idx} label={agent.id} tone="light" className="absolute top-2 left-2" />
                  {/* status tečka */}
                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${isOnline?'bg-[#444]':isBusy?'bg-[#444]':'bg-white/10'} shadow-[0_0_8px_rgba(0,0,0,0.4)]`} />

                  {/* iniciála velká na pozadí */}
                  <span className="absolute inset-0 flex items-center justify-center text-[72px] font-black leading-none opacity-[0.04] group-hover:opacity-[0.08] transition select-none">
                    {fn[0]?.toUpperCase()}
                  </span>

                  {/* křestní jméno */}
                  <span className="relative z-10 text-[22px] md:text-[24px] font-black tracking-[-0.02em] leading-[0.9] text-center uppercase">
                    {fn}
                  </span>

                  {/* hover hint */}
                  {!demoUrl && (
                    <span className="relative z-10 mt-3 text-[9px] tracking-[0.3em] font-bold opacity-0 group-hover:opacity-60 transition">
                      DETAIL →
                    </span>
                  )}

                  {/* co má agent připnuto (MCP, skilly, CLI) — vidět rovnou na kartě */}
                  {(() => {
                    const pinned = [
                      ...(agent.dependencies || []).map(d => ({ k: 'm' + d, t: categoryNumbers.mcp, n: capNums.mcp?.[d.split(':')[0]], l: d.split(':')[0] })),
                      ...agent.skills.filter(s => capNums.skill?.[s] != null).map(s => ({ k: 's' + s, t: categoryNumbers.skill, n: capNums.skill?.[s], l: s })),
                      ...agent.tools.filter(t => t.startsWith('cli:')).map(t => ({ k: 'c' + t, t: categoryNumbers.cli, n: capNums.cli?.[t.slice(4)], l: t.slice(4) })),
                    ]
                    if (!pinned.length) return null
                    return (
                      <div className={`absolute z-10 left-2 right-2 flex flex-wrap justify-center gap-1 ${demoUrl ? 'bottom-11' : 'bottom-2'}`} title={pinned.map(p => p.l).join(', ')}>
                        {pinned.slice(0, 4).map((p, i) => <NumBadge key={p.k} type={p.t} n={p.n} idx={i} label={p.l} />)}
                        {pinned.length > 4 && <span className="text-[10px] font-mono opacity-70">+{pinned.length - 4}</span>}
                      </div>
                    )
                  })()}

                  {/* spodní linka */}
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#444] opacity-0 group-hover:opacity-100 transition" />

                  {demoUrl && (
                    <button
                      onClick={(e)=>{ e.stopPropagation(); runDemo(agent) }}
                      disabled={demoPhase === 'starting'}
                      title={demoPhase === 'error' ? 'Ukázku se nepodařilo spustit, zkuste to znovu' : 'Spustí ukázku agenta'}
                      className="absolute z-20 bottom-2 left-2 right-2 py-2 rounded-full bg-[#facc15] text-[#12151b] text-[9px] font-black tracking-[0.14em] hover:brightness-110 disabled:opacity-60 transition"
                    >
                      {demoPhase === 'starting' ? 'SPOUŠTÍM…' : demoPhase === 'error' ? 'ZKUSIT ZNOVU' : '▶ SPUSTIT UKÁZKU'}
                    </button>
                  )}
                </div>
              )
            })}

            {/* přidat */}
            <button
              onClick={()=>setShowNew(true)}
              className="aspect-square rounded-[12px] border border-dashed border-[#444] bg-[#3a3a3a] hover:bg-[#444] hover:text-[#f0f0f0] hover:border-[#444] flex flex-col items-center justify-center gap-2 transition"
            >
              <span className="text-[32px] leading-none">+</span>
              <span className="text-[10px] font-black tracking-[0.2em]">NOVÝ</span>
            </button>
          </div>
        )}

        {filtered.length===0 && !loading && (
          <div className="mt-20 text-center">
            <div className="text-[14px] font-mono text-[#9a9a9a]/70">Žádní agenti pro tento filtr</div>
          </div>
        )}
      </div>

      {/* DETAIL - vyjede veškeré podrobnosti */}
      {selectedAgent && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="flex-1 bg-black/60 backdrop-blur-[2px]" onClick={()=>setSelectedAgent(null)} />
          <div className="w-[520px] max-w-[92vw] bg-[#353535] h-full overflow-y-auto shadow-[-12px_0_48px_rgba(0,0,0,0.3)] border-l border-[#444] flex flex-col animate-[slideIn_0.35s_cubic-bezier(0.25,0.1,0.25,1)]">
            {/* hlavička detailu */}
            <div className="sticky top-0 z-10 bg-[#353535]/90 backdrop-blur border-b border-[#444]">
              <div className="p-7 flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#444] text-[#f0f0f0] flex items-center justify-center text-[20px] font-black">
                    {firstName(selectedAgent.name)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[22px] font-black leading-[0.9] tracking-tight">{selectedAgent.name}</div>
                    <div className="mt-1 text-[11px] font-mono text-[#9a9a9a]">{selectedAgent.role}</div>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] px-2.5 py-1 rounded-full text-[#f0f0f0] font-bold tracking-widest" style={{ background: ACCENT }}>{selectedAgent.status.toUpperCase()}</span>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 font-mono">{selectedAgent.team}</span>
                    </div>
                    {selectedAgent.endpoints?.demo && (
                      <button
                        onClick={()=>runDemo(selectedAgent)}
                        className="mt-3 px-4 py-2 rounded-full bg-[#facc15] text-[#12151b] text-[10px] font-black tracking-[0.18em] hover:brightness-110 transition"
                      >
                        ▶ SPUSTIT UKÁZKU
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={()=>setEditMode(v=>!v)}
                    title={editMode ? 'Zpět na akce' : 'Upravit agenta (skilly, MCP, CLI, akce, prompt)'}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition text-[16px] ${editMode ? 'text-white' : 'bg-white/5 hover:bg-[#444]'}`}
                    style={editMode ? { background: ACCENT } : undefined}
                  >⚙</button>
                  <button onClick={()=>setSelectedAgent(null)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#444] hover:text-[#f0f0f0] transition">✕</button>
                </div>
              </div>
            </div>

            <div className="p-7 space-y-8">
              {!editMode && (
                <>
                  {/* ⚡ AKCE — tlačítka z manifestu; agent se skriptem má navíc „Spustit“ */}
                  <AgentActions
                    actions={[
                      ...(selectedAgent.actions ?? []),
                      ...(selectedAgent.hasScript && !(selectedAgent.actions ?? []).some(a => a.command.startsWith('/spust')) ? [{ label: '▶ Spustit', command: `/spust ${selectedAgent.id}` }] : []),
                    ]}
                  />

                  {selectedAgent.id === 'mary-jane' && <MaryTelegramPanel />}
                  {selectedAgent.id === 'tridil' && <TridilPanel />}
                  {selectedAgent.id === 'loot-checker' && <LootCheckerPanel />}
                  {selectedAgent.id === 'lopatinka' && <LopatinkaPanel />}
                  {selectedAgent.id === 'stepan' && <StepanPanel />}
                  {selectedAgent.id === 'luuu' && <LuuuPanel />}

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold tracking-[0.2em]">PŘIŘAZENO • typ-číslo</div>
                      <div className="text-[10px] font-mono text-[#9a9a9a]/70">změny přes ⚙</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAgent.skills.filter(s => capNums.skill?.[s] != null).map((s, i) => (
                        <NumBadge key={'s' + s} type={categoryNumbers.skill} n={capNums.skill?.[s]} idx={i} label={s} />
                      ))}
                      {selectedAgent.tools.filter(t => t.startsWith('cli:')).map((t, i) => (
                        <NumBadge key={'c' + t} type={categoryNumbers.cli} n={capNums.cli?.[t.slice(4)]} idx={i} label={t.slice(4)} />
                      ))}
                      {(selectedAgent.dependencies || []).map((d, i) => {
                        const mcpId = d.split(':')[0]
                        return <NumBadge key={'m' + d} type={categoryNumbers.mcp} n={capNums.mcp?.[mcpId]} idx={i} label={mcpId} />
                      })}
                      {(selectedAgent.loops || []).map((l, i) => (
                        <NumBadge key={'l' + l} type={categoryNumbers.loop} n={capNums.loop?.[l]} idx={i} label={l} />
                      ))}
                      {!(selectedAgent.dependencies?.length) && !selectedAgent.skills.some(s => capNums.skill?.[s] != null) && !selectedAgent.tools.some(t => t.startsWith('cli:')) && (
                        <span className="text-[10px] font-mono text-[#9a9a9a]/60">nic — připneš přes ⚙</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold tracking-[0.2em]">DOKUMENTY • {selectedAgent.folder}</div>
                      <div className="text-[10px] font-mono text-[#9a9a9a]/70">{selectedAgent.docs.length} souborů</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedAgent.docs.map((doc, idx)=>(
                        <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#3a3a3a] border border-[#444]">
                          <span className="text-[14px]">📄</span>
                          <span className="text-[12px] font-mono font-bold">{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {editMode && (
                <>
                  <div className="text-[10px] font-mono tracking-widest" style={{ color: ACCENT }}>⚙ ÚPRAVY — změny se uloží tlačítkem dole</div>

                  <ActionsEditor actions={selectedAgent.actions ?? []} onChange={(actions) => patchAgent({ actions })} />

                  {/* skutečné capability ze systému — klik = připnout / odepnout */}
                  {([
                    { title: 'SKILLS', type: categoryNumbers.skill, ids: Object.keys(capNums.skill ?? {}), active: (id: string) => selectedAgent.skills.includes(id),
                      toggle: (id: string) => patchAgent({ skills: selectedAgent.skills.includes(id) ? selectedAgent.skills.filter(s => s !== id) : [...selectedAgent.skills, id] }), num: (id: string) => capNums.skill?.[id] },
                    { title: 'MCP', type: categoryNumbers.mcp, ids: Object.keys(capNums.mcp ?? {}), active: (id: string) => (selectedAgent.dependencies ?? []).some(d => d.split(':')[0] === id),
                      toggle: (id: string) => toggleDep(id), num: (id: string) => capNums.mcp?.[id] },
                    { title: 'CLI', type: categoryNumbers.cli, ids: Object.keys(capNums.cli ?? {}), active: (id: string) => selectedAgent.tools.includes(`cli:${id}`),
                      toggle: (id: string) => patchAgent({ tools: selectedAgent.tools.includes(`cli:${id}`) ? selectedAgent.tools.filter(t => t !== `cli:${id}`) : [...selectedAgent.tools, `cli:${id}`] }), num: (id: string) => capNums.cli?.[id] },
                  ]).map(sec => (
                    <div key={sec.title}>
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold tracking-[0.2em]">{sec.title}</div>
                        <div className="text-[10px] font-mono text-[#9a9a9a]/70">{sec.ids.filter(sec.active).length} připnuto</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sec.ids.map(id => {
                          const on = sec.active(id)
                          return (
                            <button key={id} onClick={() => sec.toggle(id)} className={`px-3.5 py-2 rounded-full text-[11px] font-mono border transition ${on ? 'bg-[#12a4ff] text-white border-[#12a4ff]' : 'bg-[#3a3a3a] border-[#444] text-[#9a9a9a] hover:text-[#f0f0f0]'}`}>
                              {sec.type}-{String(sec.num(id) ?? '?').padStart(2, '0')} {id} {on ? '✓' : '+'}
                            </button>
                          )
                        })}
                        {!sec.ids.length && <span className="text-[10px] font-mono text-[#9a9a9a]/60">v systému zatím nic</span>}
                      </div>
                    </div>
                  ))}

                  <div>
                    <div className="text-[11px] font-bold tracking-[0.2em]">TOOLS</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ALL_TOOLS.filter(t => !t.id.startsWith('cli_')).map(t=>{
                        const active = selectedAgent.tools.includes(t.id)
                        return (
                          <button key={t.id} onClick={()=>toggleTool(t.id)} className={`px-3.5 py-2 rounded-full text-[11px] font-mono border flex items-center gap-1.5 transition ${active? 'bg-[#12a4ff] text-white border-[#12a4ff]':'bg-[#3a3a3a] border-[#444] text-[#9a9a9a]'}`}>
                            <span>{t.icon}</span>{t.id} {active?'•':''}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
                      <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">KATEGORIE</div>
                      <select value={selectedAgent.category} onChange={e=>patchAgent({ category: e.target.value })} className="mt-2 w-full bg-transparent font-bold text-[13px] outline-none">
                        <option value="all">BEZ KATEGORIE</option>
                        {CATS.filter(c=>c.id!=='all').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#3a3a3a] border border-[#444]">
                      <div className="text-[10px] font-mono tracking-widest text-[#9a9a9a]/70">TÝM</div>
                      <select value={selectedAgent.team} onChange={e=>patchAgent({ team: e.target.value })} className="mt-2 w-full bg-transparent font-bold text-[13px] outline-none">
                        {TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold tracking-[0.2em]">WORKFLOW & PROMPT</div>
                    <div className="mt-3 space-y-3">
                      <input value={selectedAgent.workflow} onChange={e=>patchAgent({ workflow: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[#444] text-[12px] font-mono" placeholder="workflow id" />
                      <textarea value={selectedAgent.prompt} onChange={e=>patchAgent({ prompt: e.target.value })} rows={6} className="w-full px-4 py-3 rounded-xl border border-[#444] text-[12px] font-mono" placeholder="System prompt..." />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={saveAgent}
                      disabled={saveStatus === 'saving'}
                      className="flex-1 py-3.5 rounded-full text-white text-[11px] font-black tracking-widest hover:brightness-110 transition disabled:opacity-50"
                      style={{ background: ACCENT }}
                    >
                      {saveStatus === 'saving' && 'UKLÁDÁM...'}
                      {saveStatus === 'saved'  && '✓ ULOŽENO'}
                      {saveStatus === 'error'  && '✕ CHYBA'}
                      {saveStatus === 'idle'   && 'ULOŽIT ZMĚNY'}
                    </button>
                    <button onClick={()=>{ setEditMode(false); loadAgentsFromFS(true) }} className="px-5 py-3.5 rounded-full border border-[#444] text-[11px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0] transition">
                      ZRUŠIT
                    </button>
                    <button onClick={()=>deleteAgent(selectedAgent.id)} className="px-5 py-3.5 rounded-full border border-[#444] text-[11px] font-bold tracking-widest text-[#9a9a9a] hover:text-[#ff6b6b] hover:border-[#ff6b6b]/40 transition">
                      SMAZAT
                    </button>
                  </div>
                </>
              )}
              <div className="h-[3px] w-full rounded-full" style={{ background: ACCENT }} />
            </div>
          </div>
        </div>
      )}


      {/* NOVÝ AGENT — AgentBuilder overlay */}
      {showNew && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl bg-[#444] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
            <button
              onClick={() => setShowNew(false)}
              className="absolute top-4 right-4 text-xl leading-none transition-opacity opacity-30 hover:opacity-80 text-[#f0f0f0]"
            >
              ✕
            </button>
            <div className="text-[10px] tracking-[0.4em] font-bold mb-6 text-[#9a9a9a]/70">
              AGENT BUILDER
            </div>
            <AgentBuilder
              onComplete={async (manifest) => {
                try {
                  // manifest z builderu → převést na AgentRecord pro Tauri
                  const m = manifest as any
                  const newAgent: Agent = {
                    id: m.id,
                    folder: m.id,
                    name: m.displayName,
                    role: m.specialization?.join(', ') || 'Bez role',
                    category: 'general',
                    team: 'LOYO OS v2',
                    status: 'online',
                    skills: [],
                    tools: [],
                    workflow: m.runtime || 'prompt',
                    prompt: m.entrypoint || '01_CORE_IDENTITY.md',
                    docs: ['01_CORE_IDENTITY.md', '02_WORKFLOW.md', '03_GUARDRAILS.md'],
                    tasksToday: 0,
                  }
                  await invoke('save_agent_to_fs', { agent: newAgent })
                  await loadAgentsFromFS()
                  setShowNew(false)
                } catch (err) {
                  console.error('AgentBuilder save failed:', err)
                }
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div className="h-[4px] w-full" style={{ background: ACCENT }} />
    </div>
  )
}
