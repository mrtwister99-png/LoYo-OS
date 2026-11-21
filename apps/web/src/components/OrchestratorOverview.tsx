// components/OrchestratorOverview.tsx — hlavní přehled profilu L: agentský orchestrátor.
// Agenti + stav + poslední běh (z activity feedu), týmy jako „baráky“, živý feed, oznámení,
// rychlé spuštění akcí z manifestů (`actions` → /api/run přes Mary) a TODO profilu JOB.
import { useMemo, useState } from 'react'
import AgentActions from './AgentActions'
import AgentRing from './AgentRing'
import TeamHouse from './TeamHouse'
import JobTodoPanel from './JobTodoPanel'
import { useAgentHub, groupByTeam, eventMatchesAgent, firstName, ringParts, timeAgo, markNotificationsRead, RING_COLORS, type HubAgent } from '../lib/agentHub'

const TYPE_COLOR: Record<string, string> = { error: '#ff1e00', report: '#3ddc97', search: '#12a4ff', chat: '#c9a646', system: '#777' }
const nav = (detail: any) => window.dispatchEvent(new CustomEvent('loyo:navigate', { detail }))

function Kpi({ label, value, sub, color = '#f0f0f0' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#3a3a3a] border border-[#444] px-4 py-3 min-w-0">
      <div className="text-[9px] font-black tracking-[0.25em] opacity-60">{label}</div>
      <div className="text-2xl font-black mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] font-mono opacity-50 truncate">{sub}</div>}
    </div>
  )
}

export default function OrchestratorOverview() {
  const { agents, teams, events, notifications, error, loading, reload } = useAgentHub()
  const [launchId, setLaunchId] = useState<string>('mary-jane')

  const lastRun = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of agents) { const ev = events.find(e => eventMatchesAgent(e, a)); if (ev) m.set(a.id, ev.ts) }
    return m
  }, [agents, events])

  const houses = useMemo(() => groupByTeam(agents, teams), [agents, teams])
  const launchable = agents.filter(a => a.actions.length)
  const launchAgent = agents.find(a => a.id === launchId) || launchable[0]
  const unread = notifications.filter(n => !n.read)
  // oznámení seskupená podle příkazu (ať /voda nezaplaví celý panel)
  const notifGroups = useMemo(() => {
    const g = new Map<string, { command: string; message: string; ts: string; type: string; count: number; ids: string[] }>()
    for (const n of unread) {
      const k = n.command + n.message
      const cur = g.get(k)
      if (cur) { cur.count++; cur.ids.push(n.id) }
      else g.set(k, { command: n.command, message: n.message, ts: n.ts, type: n.type, count: 1, ids: [n.id] })
    }
    return [...g.values()]
  }, [unread])
  const today = new Date().toDateString()
  const eventsToday = events.filter(e => new Date(e.ts).toDateString() === today)
  const errorsToday = eventsToday.filter(e => e.type === 'error').length
  const active = agents.filter(a => a.status === 'active' || a.status === 'online').length

  if (error && !agents.length) return <div className="bg-[#3a3a3a] border border-[#ff1e00] p-6 text-sm">⚠ {error}</div>

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="AGENTI" value={loading ? '…' : `${active}/${agents.length}`} sub="aktivní / celkem" color="#3ddc97" />
        <Kpi label="TÝMY" value={houses.filter(h => h.real).length} sub={houses.filter(h => h.real).map(h => h.name.split(' ')[0]).join(' · ')} />
        <Kpi label="BĚHY DNES" value={eventsToday.length} sub={`poslední ${timeAgo(events[0]?.ts)}`} color="#12a4ff" />
        <Kpi label="CHYBY DNES" value={errorsToday} color={errorsToday ? '#ff1e00' : '#f0f0f0'} />
        <Kpi label="OZNÁMENÍ" value={unread.length} sub={`${notifGroups.length} druhů`} color="#c9a646" />
        <Kpi label="S AKCEMI" value={launchable.length} sub="rychlé spuštění" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* AGENTI podle týmů */}
        <div className="xl:col-span-8 bg-[#2b2b2b] border border-[#444] p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-black text-xs tracking-[0.2em]">🤖 AGENTI • STAV • POSLEDNÍ BĚH</h2>
            <div className="flex gap-3 text-[10px] font-mono opacity-70">
              {(['skills', 'cli', 'mcp'] as const).map(k => <span key={k} style={{ color: RING_COLORS[k] }}>● {k.toUpperCase()}</span>)}
              <button onClick={() => nav({ page: 'agenti' })} className="ml-2 underline">všichni agenti →</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            {houses.map(h => (
              <div key={h.key} style={{ flex: `${Math.min(h.agents.length, 6)} 1 ${Math.min(h.agents.length, 6) * 92}px`, maxWidth: '100%' }}>
                <TeamHouse compact name={h.name} color={h.color} count={h.agents.length}>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {h.agents.map(a => <AgentChip key={a.id} a={a} last={lastRun.get(a.id)} selected={launchAgent?.id === a.id} onPick={() => a.actions.length && setLaunchId(a.id)} onOpen={() => { sessionStorage.setItem('loyo-open-agent', a.id); nav({ page: 'agenti' }) }} />)}
                  </div>
                </TeamHouse>
              </div>
            ))}
          </div>
        </div>

        {/* RYCHLÉ SPUŠTĚNÍ */}
        <div className="xl:col-span-4 bg-[#353535] border border-[#444] border-l-2 border-l-[#12a4ff] p-4 flex flex-col gap-3">
          <h2 className="font-black text-xs tracking-[0.2em]">⚡ RYCHLÉ SPUŠTĚNÍ</h2>
          <div className="flex flex-wrap gap-1.5">
            {launchable.map(a => (
              <button key={a.id} onClick={() => setLaunchId(a.id)}
                className={`px-2.5 py-1 text-[10px] font-black border ${launchAgent?.id === a.id ? 'bg-[#12a4ff] border-[#12a4ff] text-white' : 'bg-[#2b2b2b] border-[#444]'}`}>
                {firstName(a.name).toUpperCase()} <span className="opacity-60">{a.actions.length}</span>
              </button>
            ))}
          </div>
          {launchAgent && (
            <div className="flex gap-3 items-center bg-[#2b2b2b] border border-[#444] p-3">
              <AgentRing key={launchAgent.id} size={92} parts={ringParts(launchAgent)} status={launchAgent.status} initial={firstName(launchAgent.name)[0]?.toUpperCase() || '?'} />
              <div className="min-w-0">
                <div className="font-black text-sm">{launchAgent.name}</div>
                <div className="text-[10px] font-mono opacity-60 line-clamp-3">{launchAgent.role}</div>
                <div className="text-[10px] font-mono mt-1 text-[#12a4ff]">{launchAgent.command || ''} • poslední běh {timeAgo(lastRun.get(launchAgent.id))}</div>
              </div>
            </div>
          )}
          {launchAgent && <AgentActions key={launchAgent.id} actions={launchAgent.actions} />}
        </div>

        {/* AKTIVITA */}
        <div className="xl:col-span-5 bg-[#2b2b2b] border border-[#444] p-4 max-h-[420px] flex flex-col">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-xs tracking-[0.2em]">📡 POSLEDNÍ BĚHY / AKTIVITA</h2>
            <button onClick={() => nav({ page: 'activity' })} className="text-[10px] font-mono underline opacity-70">activity →</button>
          </div>
          <div className="mt-3 space-y-1 overflow-auto pr-1">
            {events.slice(0, 25).map(e => (
              <div key={e.id} className="flex gap-2 items-start text-[11px] py-1 border-b border-[#3a3a3a]">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: TYPE_COLOR[e.type] || '#777' }} />
                <span className="font-mono opacity-50 w-[44px] shrink-0">{timeAgo(e.ts)}</span>
                <span className="font-black shrink-0 max-w-[120px] truncate">{e.agent.replace(/_/g, ' ')}</span>
                <span className="opacity-80 truncate" title={e.action}>{e.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OZNÁMENÍ */}
        <div className="xl:col-span-3 bg-[#2b2b2b] border border-[#444] p-4 max-h-[420px] flex flex-col">
          <div className="flex justify-between items-center gap-2">
            <h2 className="font-black text-xs tracking-[0.2em]">🔔 OZNÁMENÍ • {unread.length}</h2>
            {unread.length > 0 && <button onClick={async () => { await markNotificationsRead().catch(() => {}); reload() }} className="text-[10px] font-mono underline opacity-70">vše přečteno ✓</button>}
          </div>
          <div className="mt-3 space-y-1.5 overflow-auto pr-1">
            {notifGroups.length === 0 && <div className="text-[11px] opacity-50 py-4 text-center">Nic nového.</div>}
            {notifGroups.map(n => (
              <div key={n.command + n.message} className="bg-[#3a3a3a] border-l-2 px-3 py-2" style={{ borderLeftColor: n.type === 'urgent' ? '#ff1e00' : n.type === 'approval' ? '#c9a646' : '#12a4ff' }}>
                <div className="flex justify-between text-[10px] font-mono opacity-60 gap-2"><span>{n.command}</span><span className="ml-auto">{n.count > 1 ? `×${n.count} • ` : ''}{timeAgo(n.ts)}</span>
                  <button title="Označit jako přečtené" onClick={async () => { await markNotificationsRead(n.ids).catch(() => {}); reload() }} className="hover:text-[#3ddc97]">✓</button></div>
                <div className="text-[11px] font-bold mt-0.5 line-clamp-2">{n.message}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TODO PROFILU 3 */}
        <div className="xl:col-span-4 max-h-[420px]">
          <JobTodoPanel onOpenProfile={() => nav({ profile: 2, page: 'projekty' })} />
        </div>
      </div>
    </div>
  )
}

function AgentChip({ a, last, selected, onPick, onOpen }: { a: HubAgent; last?: string; selected: boolean; onPick: () => void; onOpen: () => void }) {
  const p = ringParts(a)
  const online = a.status === 'active' || a.status === 'online'
  const fresh = last && Date.now() - new Date(last).getTime() < 3600_000
  return (
    <button onClick={onPick} onDoubleClick={onOpen} title={`${a.name}\n${a.role}\nskills ${p.skills.length} • cli ${p.cli.length} • mcp ${p.mcp.length}${a.actions.length ? `\n⚡ ${a.actions.length} akcí (klik = rychlé spuštění)` : ''}\ndvojklik = detail agenta`}
      className={`relative w-[84px] bg-[#3a3a3a] border px-1.5 pt-2 pb-1.5 text-center hover:bg-[#444] transition ${selected ? 'border-[#12a4ff]' : 'border-[#444]'}`}>
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: !online ? '#777' : fresh ? '#3ddc97' : '#2a7a58', boxShadow: fresh ? '0 0 6px #3ddc97' : undefined }} />
      {a.actions.length > 0 && <span className="absolute top-0.5 left-1 text-[9px] text-[#12a4ff]">⚡</span>}
      <div className="text-[11px] font-black uppercase truncate">{firstName(a.name)}</div>
      {/* mini lišta skills/cli/mcp */}
      <div className="flex h-1 mt-1 gap-px">
        {(['skills', 'cli', 'mcp'] as const).map(k => <span key={k} style={{ flex: Math.max(p[k].length, 0.3), background: RING_COLORS[k], opacity: p[k].length ? 0.9 : 0.15 }} />)}
      </div>
      <div className="text-[9px] font-mono opacity-50 mt-1">{last ? timeAgo(last) : '—'}</div>
    </button>
  )
}
