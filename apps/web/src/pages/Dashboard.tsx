// D:\dev\loyo-os\apps\web\src\pages\Dashboard.tsx
// LOYO OS // Dashboard — živý přehled napojený na apps/api (localhost:3001)
import { useEffect, useState } from 'react'

const API = 'http://localhost:3001/api'

interface AgentRecord {
  id: string
  name?: string
  status?: string
  tasksToday?: number
  lastRun?: string
}

interface TeamRecord {
  id: string
  name: string
  agents?: string[]
}

interface WorkflowRecord {
  id: string
  name: string
  status?: string
}

interface LoopRecord {
  id: string
  name: string
  active?: boolean
}

interface McpRecord {
  id: string
  name: string
  status?: string
  tools?: string[]
}

interface ActivityEvent {
  id: string
  ts: string
  agent: string
  type: string
  action: string
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'právě teď'
  if (mins < 60) return `před ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `před ${hrs} hod`
  return `před ${Math.floor(hrs / 24)} dny`
}

function initials(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase()
}

function avatarColor(name: string): string {
  const palette = ['#0057F7', '#BD0000', '#7A7A7A']
  const idx = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length
  return palette[idx]
}

export default function Dashboard() {
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loops, setLoops] = useState<LoopRecord[]>([])
  const [mcp, setMcp] = useState<McpRecord[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [apiDown, setApiDown] = useState(false)

  async function loadAll() {
    try {
      const [a, t, w, l, m, act] = await Promise.all([
        fetch(`${API}/agents`).then(r => r.json()),
        fetch(`${API}/teams`).then(r => r.json()),
        fetch(`${API}/workflows`).then(r => r.json()),
        fetch(`${API}/loops`).then(r => r.json()),
        fetch(`${API}/mcp`).then(r => r.json()),
        fetch(`${API}/activity?limit=8`).then(r => r.json()),
      ])
      setAgents(a.agents || [])
      setTeams(t.teams || [])
      setWorkflows(w.workflows || [])
      setLoops(l.loops || [])
      setMcp(m.servers || [])
      setActivity(act.events || [])
      setApiDown(false)
    } catch {
      setApiDown(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 10000) // refresh každých 10s = "LIVE"
    return () => clearInterval(interval)
  }, [])

  const onlineAgents = agents.filter(a => a.status === 'online' || a.status === 'active').length
  const totalTeamMembers = teams.reduce((sum, t) => sum + (t.agents?.length || 0), 0)
  const runningWorkflows = workflows.filter(w => w.status === 'running').length
  const activeLoops = loops.filter(l => l.active !== false).length
  const activeTools = mcp.filter(m => m.status === 'running' || m.status === 'active').length
  const totalTools = mcp.reduce((sum, m) => sum + (m.tools?.length || 0), 0)

  const typeLabel: Record<string, string> = {
    routing: 'SMS',
    research: 'SKILL',
    cli: 'CLI',
    save: 'NOTE',
    error: 'ERROR',
    system: 'SYSTEM',
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-500 font-mono text-sm">
        Načítám dashboard...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {apiDown && (
        <div
          className="rounded-lg p-4 text-white font-bold flex items-center gap-3"
          style={{ backgroundColor: '#BD0000' }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          API neběží (localhost:3001) — zobrazují se poslední známá data, ne aktuální stav.
        </div>
      )}

      {/* RYCHLÝ PŘEHLED - GRID */}
      <div className="grid grid-cols-4 gap-4">
        {/* AGENTI */}
        <div className="bg-white rounded-lg p-6 border border-black/10">
          <div className="text-sm font-mono text-gray-500 mb-2">AGENTI</div>
          <div className="text-4xl font-black mb-2">{agents.length}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0057F7' }}></span>
            <span>{onlineAgents} online</span>
          </div>
        </div>

        {/* TEAMY */}
        <div className="bg-white rounded-lg p-6 border border-black/10">
          <div className="text-sm font-mono text-gray-500 mb-2">TEAMY</div>
          <div className="text-4xl font-black mb-2">{teams.length}</div>
          <div className="text-sm text-gray-600">{totalTeamMembers} členů</div>
        </div>

        {/* WORKFLOWS */}
        <div className="bg-black text-white rounded-lg p-6">
          <div className="text-sm font-mono text-gray-400 mb-2">WORKFLOWS</div>
          <div className="text-4xl font-black mb-2">{workflows.length}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0057F7' }}></span>
            <span>{runningWorkflows} běží</span>
          </div>
        </div>

        {/* LOOPS */}
        <div className="bg-white rounded-lg p-6 border border-black/10">
          <div className="text-sm font-mono text-gray-500 mb-2">LOOPS</div>
          <div className="text-4xl font-black mb-2">{loops.length}</div>
          <div className="text-sm text-gray-600">{activeLoops} aktivních automatizací</div>
        </div>

        {/* CLI */}
        <div className="bg-white rounded-lg p-6 border border-black/10 col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-mono text-gray-500 mb-1">CLI TOOLS</div>
              <div className="text-2xl font-black">Agent → CLI → Výsledek</div>
            </div>
            <div className="flex items-center gap-3 text-sm font-mono">
              <span className="px-3 py-1 bg-black text-white rounded">{mcp.length + 5} tools</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0057F7' }}></span>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVITY FEED + MCP STATUS */}
      <div className="grid grid-cols-3 gap-6">

        {/* ACTIVITY FEED */}
        <div className="col-span-2 bg-white rounded-lg border border-black/10">
          <div className="p-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="font-black text-lg">ACTIVITY FEED</div>
              <div className="text-sm font-mono text-gray-500">SMS • Notes • Akce agentů</div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0057F7' }}></span>
              LIVE
            </div>
          </div>
          <div className="p-4 space-y-3">
            {activity.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-6">Zatím žádná aktivita</div>
            )}
            {activity.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <div
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0"
                  style={{ backgroundColor: avatarColor(ev.agent) }}
                >
                  {initials(ev.agent)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{ev.action}</div>
                  <div className="text-xs text-gray-600">{ev.agent} • {timeAgo(ev.ts)}</div>
                </div>
                <div className="text-xs font-mono bg-black text-white px-2 py-1 rounded shrink-0">
                  {typeLabel[ev.type] || ev.type.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MCP STATUS */}
        <div className="bg-black text-white rounded-lg">
          <div className="p-4 border-b border-white/20">
            <div className="font-black text-lg">MCP STATUS</div>
            <div className="text-sm font-mono text-gray-400">Model Context Protocol</div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Servery</span>
              <span className="font-bold">{mcp.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Aktivní</span>
              <span className="font-bold">{activeTools}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Nástroje celkem</span>
              <span className="font-bold">{totalTools}</span>
            </div>
            <div className="pt-3 mt-3 border-t border-white/20">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeTools > 0 ? '#0057F7' : '#7A7A7A' }}
                ></span>
                {activeTools > 0 ? 'RUNNING' : 'IDLE'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RYCHLÉ AKCE */}
      <div className="grid grid-cols-4 gap-4">
        <button
          className="text-white py-4 rounded-lg font-black hover:brightness-110 transition"
          style={{ backgroundColor: '#0057F7' }}
        >
          + NOVÝ PROJEKT
        </button>
        <button
          className="text-white py-4 rounded-lg font-black hover:brightness-110 transition"
          style={{ backgroundColor: '#BD0000' }}
        >
          + NOVÝ AGENT
        </button>
        <button
          className="text-white py-4 rounded-lg font-black hover:brightness-110 transition"
          style={{ backgroundColor: '#7A7A7A' }}
        >
          + ODESLAT SMS
        </button>
        <button
          className="text-black py-4 rounded-lg font-black border-2 border-black hover:bg-black hover:text-white transition"
        >
          + NOVÝ NOTE
        </button>
      </div>
    </div>
  )
}
