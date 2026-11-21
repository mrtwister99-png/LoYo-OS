// lib/agentHub.ts — sdílená data pro orchestrátor (dashboard L) a nové zobrazení agentů:
// agenti z /api/agents, týmy z /api/teams (+ `team` z agents/index.json), aktivita, oznámení.
import { useCallback, useEffect, useState } from 'react'

// Na dev serveru (vite, port 3000) jdeme přes proxy /api → funguje i z jiného zařízení (tunel, Tailscale).
// Jinde (Tauri build, jiný port) přímo na API.
export const API_URL =
  import.meta.env.DEV && typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol) && window.location.port !== '3001'
    ? ''
    : 'http://localhost:3001'

export type HubAction = { label: string; command: string; ask?: string }
export type HubAgent = {
  id: string
  name: string
  role: string
  status: string
  team: string
  skills: string[]
  tools: string[]
  dependencies: string[]
  actions: HubAction[]
  number?: number
  command?: string
}
export type HubTeam = { id: string; name: string; color: string; agents: string[]; desc?: string }
export type HubEvent = { id: string; ts: string; agent: string; type: string; action: string }
export type HubNotification = { id: string; ts: string; command: string; message: string; read: boolean; type: string }

// barvy oddílů kruhové lišty
export const RING_COLORS = { skills: '#12a4ff', cli: '#c9a646', mcp: '#3ddc97' } as const
export const NO_TEAM = 'Bez týmu'

const getJson = async (path: string) => {
  const r = await fetch(`${API_URL}${path}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function firstName(full: string) {
  return (full || '').split(/[\s—–-]+/)[0] || full
}

// „Julia_Nehledalova“ / „Mary Jane“ / „julia-nehledalova“ → „julia nehledalova“
export const normName = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-]+/g, ' ').trim()

export function eventMatchesAgent(ev: HubEvent, a: HubAgent) {
  const e = normName(ev.agent)
  if (!e) return false
  return e === normName(a.id) || e === normName(a.name) || e === normName(firstName(a.name)) || e.startsWith(normName(firstName(a.name)) + ' ')
}

// cli:firmy → CLI, ostatní tools jsou interní nástroje (fs_read…), dependencies = MCP
export function ringParts(a: HubAgent) {
  return {
    skills: a.skills,
    cli: a.tools.filter(t => t.startsWith('cli:')).map(t => t.slice(4)),
    mcp: a.dependencies.map(d => d.split(':')[0]),
  }
}

// Seskupení do „baráků“: členství v data/capabilities/teams má přednost, pak `team` z indexu
export function groupByTeam(agents: HubAgent[], teams: HubTeam[]) {
  const houses = new Map<string, { key: string; name: string; color: string; agents: HubAgent[]; real: boolean }>()
  const memberOf = new Map<string, HubTeam>()
  for (const t of teams) for (const id of t.agents) memberOf.set(id, t)
  for (const a of agents) {
    const t = memberOf.get(a.id)
    const key = t ? t.id : a.team || NO_TEAM
    if (!houses.has(key)) houses.set(key, { key, name: t ? t.name : a.team || NO_TEAM, color: t?.color || (a.team ? '#12a4ff' : '#666'), agents: [], real: !!t || !!a.team })
    houses.get(key)!.agents.push(a)
  }
  // velké týmy první, „Bez týmu“ na konec
  return [...houses.values()].sort((x, y) => (x.key === NO_TEAM ? 1 : 0) - (y.key === NO_TEAM ? 1 : 0) || y.agents.length - x.agents.length)
}

export function useAgentHub(pollMs = 15000) {
  const [agents, setAgents] = useState<HubAgent[]>([])
  const [teams, setTeams] = useState<HubTeam[]>([])
  const [events, setEvents] = useState<HubEvent[]>([])
  const [notifications, setNotifications] = useState<HubNotification[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [a, t, e, n] = await Promise.all([
          getJson('/api/agents'),
          getJson('/api/teams').catch(() => ({ teams: [] })),
          getJson('/api/activity?limit=500').catch(() => ({ events: [] })),
          getJson('/api/notifications').catch(() => ({ notifications: [] })),
        ])
        if (!alive) return
        setAgents((a.agents || []).map((x: any): HubAgent => ({
          id: x.id,
          name: x.displayName || x.name || x.id,
          role: x.role || x.description || '',
          status: x.status || 'active',
          team: x.team || '',
          skills: x.skills || [],
          tools: x.tools || [],
          dependencies: x.dependencies || [],
          actions: Array.isArray(x.actions) ? x.actions : [],
          number: x.number,
          command: x.command,
        })).sort((p: HubAgent, q: HubAgent) => (p.number ?? 999) - (q.number ?? 999)))
        setTeams((t.teams || []).map((x: any) => ({ id: x.id, name: x.name, color: x.color || '#ff6f00', agents: x.agents || [], desc: x.desc })))
        setEvents(e.events || [])
        setNotifications(n.notifications || [])
        setError('')
      } catch (err: any) {
        if (alive) setError(err?.message === 'Failed to fetch' ? 'API neběží (localhost:3001)' : String(err?.message || err))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, pollMs)
    return () => { alive = false; clearInterval(id) }
  }, [pollMs, tick])

  return { agents, teams, events, notifications, error, loading, reload }
}

// označí oznámení jako přečtená (ids prázdné = všechna)
export async function markNotificationsRead(ids?: string[]) {
  if (!ids) { await fetch(`${API_URL}/api/notifications/read-all`, { method: 'POST' }); return }
  await Promise.all(ids.map(id => fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'POST' })))
}

export function timeAgo(iso?: string) {
  if (!iso) return '—'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'teď'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return `${Math.floor(s / 86400)} d`
}
