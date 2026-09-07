
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import AgentBuilder from '../components/builder/AgentBuilder'

const ACCENT = '#FF3B30'

type Skill = { id: string; name: string }
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
}

const ALL_SKILLS: Skill[] = [
  { id: 'closer', name: 'Closer' },
  { id: 'copy', name: 'Copywriter' },
  { id: 'research', name: 'Researcher' },
  { id: 'builder', name: 'Builder' },
  { id: 'enricher', name: 'Enricher' },
  { id: 'finder', name: 'Finder' },
]

const ALL_TOOLS: Tool[] = [
  { id: 'rag', name: 'RAG', icon: '◧' },
  { id: 'web_search', name: 'web_search', icon: '🌐' },
  { id: 'fs_read', name: 'fs_read', icon: '📁' },
  { id: 'fs_write', name: 'fs_write', icon: '✎' },
  { id: 'sms', name: 'sms_send', icon: '' },
  { id: 'cli_firmy', name: 'cli:firmy', icon: '⚙' },
]

const CATS = [
  { id: 'all', name: 'VŠE', count: 0 },
  { id: 'marketing', name: 'MARKETING', count: 0 },
  { id: 'dev', name: 'DEV', count: 0 },
  { id: 'research', name: 'RESEARCH', count: 0 },
  { id: 'sales', name: 'SALES', count: 0 },
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
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    loadAgentsFromFS(false)
    const id = setInterval(() => loadAgentsFromFS(true), 5000)
    return () => clearInterval(id)
  }, [])

  const loadAgentsFromFS = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    setSyncStatus('syncing')
    try {
      const data = await invoke<any>('sync_agents_from_fs')
      const rawAgents = Array.isArray(data) ? data : data.agents || []
      const normalized: Agent[] = rawAgents.map((a: any) => ({
        ...a,
        prompt: a.prompt || a.prompt_file || '',
        docs: a.docs || [],
        folder: a.folder || a.id,
        tasksToday: a.tasksToday ?? 0,
        status: a.status || 'online',
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

  const toggleSkill = (skillId: string) => {
    if (!selectedAgent) return
    const cur = selectedAgent.skills
    const updated = { ...selectedAgent, skills: cur.includes(skillId) ? cur.filter(s => s !== skillId) : [...cur, skillId] }
    setSelectedAgent(updated)
    setAgents(agents.map(a => a.id === updated.id ? updated : a))
  }

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const saveAgent = async () => {
    if (!selectedAgent) return
    setSaveStatus('saving')
    try {
      await invoke('save_agent_to_fs', { agent: selectedAgent })
      await loadAgentsFromFS(true)
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
    <div className="min-h-full bg-[#fbfaf8] text-black selection:bg-[#ff4400] selection:text-white">
      {/* HEADER */}
      <div className="px-6 md:px-10 pt-8 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[56px] leading-[0.85] font-black tracking-tighter">AGENTI</h1>
              <span className="text-[20px] font-mono text-black/20">/ {String(filtered.length).padStart(2,'0')}</span>
            </div>
            <div className="mt-3 text-[11px] font-mono tracking-wide text-black/40 max-w-[560px]">
              Ukládá se do <span className="font-bold text-black">D:\dev\loyo-os\data\agents</span> • každý agent má skills, tools, team a workflow. Klikni pro detail a editaci všeho.
              <span className="ml-3 inline-flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${syncStatus==='synced'?'bg-green-500':syncStatus==='syncing'?'bg-yellow-500 animate-pulse':'bg-red-500'}`} />
                <span className="text-[10px] uppercase tracking-widest">{syncStatus}</span>
              </span>
            </div>
          </div>
          <button onClick={()=>setShowNew(true)} className="shrink-0 px-5 py-3 bg-black text-white text-[11px] font-black tracking-[0.2em] rounded-full hover:bg-[#ae1710] transition">+ NOVÝ AGENT</button>
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
                  className={`px-4 py-2 rounded-full text-[11px] font-black tracking-widest border transition ${active?'bg-black text-white border-black':'bg-white text-black/40 border-black/10 hover:border-black/30'}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${active?'bg-[#FF3B30]':'bg-black/20'}`} />
                  {cat.name}
                </button>
              )
            })}
          </div>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="HLEDAT AGENTA..."
            className="ml-auto w-[240px] px-4 py-2 rounded-full bg-white border border-black/10 text-[11px] font-mono tracking-wide outline-none focus:border-black/30"
          />
        </div>
      </div>

      {/* ČTVERCE - POUZE KŘESTNÍ JMÉNO */}
      <div className="px-6 md:px-10 pb-20">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="aspect-square bg-black/5 animate-pulse rounded-[12px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(agent=>{
              const fn = firstName(agent.name)
              const isOnline = agent.status==='online'
              const isBusy = agent.status==='busy'
              return (
                <button
                  key={agent.id}
                  onClick={()=>setSelectedAgent(agent)}
                  className="group relative aspect-square bg-black text-white rounded-[12px] border border-black/10 overflow-hidden flex flex-col items-center justify-center p-4 hover:bg-[#1000a1] hover:border-white/20 transition-all duration-200 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:-translate-y-[2px]"
                >
                  {/* status tečka */}
                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${isOnline?'bg-[#FF3B30]':isBusy?'bg-yellow-400':'bg-white/20'} shadow-[0_0_8px_rgba(0,0,0,0.4)]`} />

                  {/* iniciála velká na pozadí */}
                  <span className="absolute inset-0 flex items-center justify-center text-[72px] font-black leading-none opacity-[0.04] group-hover:opacity-[0.08] transition select-none">
                    {fn[0]?.toUpperCase()}
                  </span>

                  {/* křestní jméno */}
                  <span className="relative z-10 text-[22px] md:text-[24px] font-black tracking-[-0.02em] leading-[0.9] text-center uppercase">
                    {fn}
                  </span>

                  {/* hover hint */}
                  <span className="relative z-10 mt-3 text-[9px] tracking-[0.3em] font-bold opacity-0 group-hover:opacity-60 transition">
                    DETAIL →
                  </span>

                  {/* spodní linka */}
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FF3B30] opacity-0 group-hover:opacity-100 transition" />
                </button>
              )
            })}

            {/* přidat */}
            <button
              onClick={()=>setShowNew(true)}
              className="aspect-square rounded-[12px] border border-dashed border-black/20 bg-white hover:bg-black hover:text-white hover:border-black flex flex-col items-center justify-center gap-2 transition"
            >
              <span className="text-[32px] leading-none">+</span>
              <span className="text-[10px] font-black tracking-[0.2em]">NOVÝ</span>
            </button>
          </div>
        )}

        {filtered.length===0 && !loading && (
          <div className="mt-20 text-center">
            <div className="text-[14px] font-mono text-black/30">Žádní agenti pro tento filtr</div>
          </div>
        )}
      </div>

      {/* DETAIL - vyjede veškeré podrobnosti */}
      {selectedAgent && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="flex-1 bg-black/60 backdrop-blur-[2px]" onClick={()=>setSelectedAgent(null)} />
          <div className="w-[520px] max-w-[92vw] bg-[#fbfaf8] h-full overflow-y-auto shadow-[-12px_0_48px_rgba(0,0,0,0.3)] border-l border-black/10 flex flex-col animate-[slideIn_0.35s_cubic-bezier(0.25,0.1,0.25,1)]">
            {/* hlavička detailu */}
            <div className="sticky top-0 z-10 bg-[#fbfaf8]/90 backdrop-blur border-b border-black/10">
              <div className="p-7 flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-[20px] font-black">
                    {firstName(selectedAgent.name)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[22px] font-black leading-[0.9] tracking-tight">{selectedAgent.name}</div>
                    <div className="mt-1 text-[11px] font-mono text-black/40">{selectedAgent.role}</div>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] px-2.5 py-1 rounded-full text-white font-bold tracking-widest" style={{ background: ACCENT }}>{selectedAgent.status.toUpperCase()}</span>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-black/5 font-mono">{selectedAgent.team}</span>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setSelectedAgent(null)} className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center hover:bg-black hover:text-white transition">✕</button>
              </div>
            </div>

            <div className="p-7 space-y-8">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-black/5">
                  <div className="text-[10px] font-mono tracking-widest text-black/30">KATEGORIE</div>
                  <select value={selectedAgent.category} onChange={e=>{const upd={...selectedAgent, category:e.target.value}; setSelectedAgent(upd);}} className="mt-2 w-full bg-transparent font-bold text-[13px] outline-none">
                    {CATS.filter(c=>c.id!=='all').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-black/5">
                  <div className="text-[10px] font-mono tracking-widest text-black/30">TÝM</div>
                  <select value={selectedAgent.team} onChange={e=>{const upd={...selectedAgent, team:e.target.value}; setSelectedAgent(upd);}} className="mt-2 w-full bg-transparent font-bold text-[13px] outline-none">
                    {TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold tracking-[0.2em]">DOKUMENTY • {selectedAgent.folder}</div>
                  <div className="text-[10px] font-mono text-black/30">{selectedAgent.docs.length} souborů</div>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedAgent.docs.map((doc, idx)=>(
                    <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-black/5">
                      <span className="text-[14px]">📄</span>
                      <span className="text-[12px] font-mono font-bold">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold tracking-[0.2em]">SKILLS</div>
                  <div className="text-[10px] font-mono text-black/30">{selectedAgent.skills.length} aktivních</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_SKILLS.map(s=>{
                    const active = selectedAgent.skills.includes(s.id)
                    return (
                      <button key={s.id} onClick={()=>toggleSkill(s.id)} className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-widest border transition ${active?'bg-black text-white border-black':'bg-white border-black/10 text-black/40 hover:border-black/30'}`}>
                        {s.name.toUpperCase()} {active?'✓':'+'}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold tracking-[0.2em]">TOOLS</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_TOOLS.map(t=>{
                    const active = selectedAgent.tools.includes(t.id)
                    return (
                      <button key={t.id} onClick={()=>toggleTool(t.id)} className={`px-3.5 py-2 rounded-full text-[11px] font-mono border flex items-center gap-1.5 transition ${active?'bg-black text-white border-black':'bg-white border-black/10 text-black/40'}`}>
                        <span>{t.icon}</span>{t.id} {active?'•':''}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold tracking-[0.2em]">WORKFLOW & PROMPT</div>
                <div className="mt-3 space-y-3">
                  <input value={selectedAgent.workflow} onChange={e=>{const upd={...selectedAgent, workflow:e.target.value}; setSelectedAgent(upd);}} className="w-full px-4 py-3 rounded-xl border border-black/10 text-[12px] font-mono" placeholder="workflow id" />
                  <textarea value={selectedAgent.prompt} onChange={e=>{const upd={...selectedAgent, prompt:e.target.value}; setSelectedAgent(upd);}} rows={6} className="w-full px-4 py-3 rounded-xl border border-black/10 text-[12px] font-mono" placeholder="System prompt..." />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveAgent}
                  disabled={saveStatus === 'saving'}
                  className="flex-1 py-3.5 rounded-full bg-black text-white text-[11px] font-black tracking-widest hover:bg-black/80 transition disabled:opacity-50"
                >
                  {saveStatus === 'saving' && 'UKLÁDÁM...'}
                  {saveStatus === 'saved'  && '✓ ULOŽENO'}
                  {saveStatus === 'error'  && '✕ CHYBA'}
                  {saveStatus === 'idle'   && 'ULOŽIT ZMĚNY → data/agents/'}
                </button>
                <button onClick={()=>deleteAgent(selectedAgent.id)} className="px-6 py-3.5 rounded-full border border-black/10 text-[11px] font-bold tracking-widest text-black/40 hover:text-[#ff4400] hover:border-[#ff4400]/30 transition">
                  SMAZAT
                </button>
              </div>
              <div className="h-[3px] w-full rounded-full" style={{ background: ACCENT }} />
            </div>
          </div>
        </div>
      )}


      {/* NOVÝ AGENT — AgentBuilder overlay */}
      {showNew && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
            <button
              onClick={() => setShowNew(false)}
              className="absolute top-4 right-4 text-xl leading-none transition-opacity opacity-30 hover:opacity-80 text-white"
            >
              ✕
            </button>
            <div className="text-[10px] tracking-[0.4em] font-bold mb-6 text-white/30">
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
