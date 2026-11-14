import { useState, useEffect, useMemo } from 'react'
import { categoryColors, categoryNumbers } from '../styles/theme'
import NumBadge from '../components/NumBadge'

const ACCENT = '#12a4ff'
const CLI_COLOR = categoryColors.cli
const CLI_NUM = categoryNumbers.cli
const GOLD = '#444'

type CliTool = {
  id: string
  name: string
  path: string
  hasPackageJson: boolean
  hasIndex: boolean
  commands: string[]
  number?: number
}

type ScheduledCmd = {
  name: string
  handler: string
  description: string
  enabled: boolean
  schedule?: { type: string; at?: string; from?: number; to?: number }
}

export default function Cli() {
  const [tools, setTools] = useState<CliTool[]>([])
  const [scheduled, setScheduled] = useState<ScheduledCmd[]>([])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tools' | 'scheduled'>('tools')

  useEffect(() =>
  {
    loadData()
    const id = setInterval(loadData, 10000)
    return () => clearInterval(id)
  }, [])

  const loadData = async () =>
  {
    try
    {
      const res = await fetch('http://localhost:3001/api/cli')
      const data = await res.json()
      setTools(data.tools || [])
      setScheduled(data.scheduled || [])
      if (!selected && data.tools?.length) setSelected(data.tools[0].id)
    }
    catch {}
    finally { setLoading(false) }
  }

  const active = useMemo(() => tools.find(c => c.id === selected), [selected, tools])

  const filtered = useMemo(() => tools.filter(c =>
  {
    if (search && !`${c.name} ${c.path}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [search, tools])

  const goBuilder = (id?: string) => {
    window.dispatchEvent(new CustomEvent('loyo:navigate', { detail: { page: 'Builder', type: 'cli', id } }))
    alert(`→ Builder CLI ${id || 'nový'} - v App.tsx napoj event loyo:navigate`)
  }

  if (loading) return <div className="p-10 font-mono text-sm opacity-50">Načítám CLI tools...</div>

  return (
    <div className="p-8 bg-[#353535]">
      {/* HEADER */}
      <div className="bg-[#3a3a3a] border border-[#444] p-6 flex justify-between items-center mb-6">
        <div>
          <div className="text-[10px] tracking-[0.4em] text-[#9a9a9a]">CLI // {tools.length} TOOLS • {scheduled.length} SCHEDULED • {tools.reduce((a, b) => a + b.commands.length, 0)} COMMANDS</div>
          <h2 className="text-3xl font-black mt-1 tracking-tighter">{tools.length} CLI TOOLS • AGENTI JE VOLAJÍ JAKO PŘÍKAZY</h2>
          <div className="mt-2 flex gap-2 text-[10px]">
            <span className="px-2 py-1 bg-[#444] text-[#f0f0f0]">BIN: tools/cli/*</span>
            <span className="px-2 py-1 border border-[#444]">LIVE z filesystem</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => goBuilder()} className="px-6 py-3 bg-[#444] text-[#f0f0f0] font-black text-xs tracking-widest border border-[#444] hover:bg-[#12a4ff] hover:text-[#f0f0f0]">+ NOVÝ CLI → BUILDER</button>
          <div className="w-3 h-3 animate-pulse" style={{ background: GOLD }}></div>
        </div>
      </div>

      {/* TABS + SEARCH */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="HLEDAT..." className="px-3 py-2 text-xs bg-[#444] text-[#f0f0f0] border border-[#444] outline-none placeholder:text-[#9a9a9a] w-[200px]" />
        <button onClick={() => setTab('tools')} className="px-3 py-1.5 text-[10px] font-black tracking-widest border border-[#444]" style={{ background: tab === 'tools' ? GOLD : '#3a3a3a' }}>CLI TOOLS ({tools.length})</button>
        <button onClick={() => setTab('scheduled')} className="px-3 py-1.5 text-[10px] font-black tracking-widest border border-[#444]" style={{ background: tab === 'scheduled' ? '#f0f0f0' : '#3a3a3a', color: tab === 'scheduled' ? '#f0f0f0' : '#f0f0f0' }}>⏰ SCHEDULED ({scheduled.length})</button>
      </div>

      {tab === 'tools' && (
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT — CLI LIST */}
          <div className="col-span-5 bg-[#3a3a3a] border border-[#444] h-[calc(100vh-280px)] flex flex-col">
            <div className="p-4 text-[10px] tracking-[0.4em] text-[#9a9a9a] border-b border-[#444]">CLI LIST // {filtered.length} • NALEZENO V tools/cli/</div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm opacity-40">Žádné CLI tools v tools/cli/</div>
              )}
                            {filtered.map((cli, idx) =>
              {
                const isActive = selected === cli.id
                return (
                  <div key={cli.id} onClick={() => setSelected(cli.id)} className="p-5 cursor-pointer border-b border-[#444] flex justify-between border-l" style={{ background: isActive? GOLD : '#3a3a3a', borderLeftColor: CLI_COLOR }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 items-center">
                        <NumBadge type={CLI_NUM} n={cli.number} idx={idx} />
                        <span className="font-black text-sm">$ {cli.name}</span>
                        <span className="w-2 h-2 rounded-full" style={{ background: CLI_COLOR }} />
                        {cli.hasIndex && <span className="text- px-2 py-0.5 bg-[#444] text-[#f0f0f0]">READY</span>}
                        {cli.hasPackageJson && <span className="text- px-1.5 py-0.5 border border-[#444]">pkg</span>}
                      </div>
                      <div className="text- opacity-60 mt-1">{cli.path}</div>
                      <div className="mt-2 text- opacity-50 flex gap-2"><span>{cli.commands.length} commands parsováno z index.ts</span><span className="opacity-30">{cli.id}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT — DETAIL */}
          <div className="col-span-7 bg-[#3a3a3a] border border-[#444] p-8 h-[calc(100vh-280px)] overflow-y-auto">
            {!active ? (
              <div className="flex items-center justify-center h-full text-sm opacity-40">Vyber CLI tool vlevo</div>
            ) : (
              <>
                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-[#444] text-[#f0f0f0] flex items-center justify-center font-black text-xl">$</div>
                  <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      {active.hasIndex && <span className="text-[10px] px-2 py-1 bg-[#444] text-[#f0f0f0]">READY</span>}
                      {active.hasPackageJson && <span className="text-[10px] px-2 py-1 border border-[#444]">package.json ✓</span>}
                    </div>
                    <div className="text-2xl font-black mt-2">$ {active.name}</div>
                    <div className="text-[11px] mt-1 opacity-50">Path: {active.path}</div>
                  </div>
                </div>

                {active.commands.length > 0 && (() =>
                {
                  const subcommands = active.commands.filter(c => !c.startsWith('-'))
                  const flags = active.commands.filter(c => c.startsWith('-'))
                  return (
                    <>
                      {subcommands.length > 0 && (
                        <div className="mt-8 border border-[#444]">
                          <div className="p-3 bg-[#444] text-[#f0f0f0] text-[10px] tracking-widest">SUBCOMMANDS // {subcommands.length}</div>
                          <div>
                            {subcommands.map(cmd => (
                              <div key={cmd} className="p-4 border-b border-[#444] hover:bg-[#444] hover:text-[#f0f0f0] group cursor-pointer">
                                <div className="font-black text-xs">pnpm cli:{active.name} {cmd}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {flags.length > 0 && (
                        <div className="mt-4 border border-[#444]">
                          <div className="p-3 bg-black/80 text-[#f0f0f0] text-[10px] tracking-widest">FLAGS // {flags.length} • DOSTUPNÉ PARAMETRY</div>
                          <div className="flex flex-wrap gap-2 p-4">
                            {flags.map(flag => (
                              <span key={flag} className="px-3 py-1.5 bg-white/5 border border-[#444] text-xs font-mono">{flag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {active.commands.length === 0 && (
                  <div className="mt-8 p-6 border border-dashed border-[#444] text-center text-sm opacity-40">
                    Žádné příkazy nalezeny v index.ts
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button onClick={() => goBuilder(active.id)} className="flex-1 py-3 bg-[#444] text-[#f0f0f0] font-black text-xs tracking-widest border border-[#444] hover:bg-[#12a4ff] hover:text-[#f0f0f0]">EDITOVAT V BUILDERU →</button>
                </div>

                <div className="mt-4 text-[10px] opacity-60 leading-relaxed"><b className="text-[#f0f0f0]">CLI = příkaz co vykoná agent.</b> Agent zavolá <b>pnpm cli:{active.name} search ...</b>. CLI se spustí, udělá práci a skončí. Na rozdíl od MCP (server co běží stále).</div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="bg-[#3a3a3a] border border-[#444]">
          <div className="p-4 bg-[#444] text-[#f0f0f0] text-[10px] tracking-widest flex justify-between">
            <span>SCHEDULED COMMANDS // {scheduled.length} • Z commands.json</span>
            <span className="opacity-60">handler • schedule • enabled</span>
          </div>
          {scheduled.length === 0 && (
            <div className="p-8 text-center text-sm opacity-40">Žádné scheduled příkazy. Přidej schedule do commands.json.</div>
          )}
          {scheduled.map(cmd =>
          {
            const s = cmd.schedule
            let scheduleLabel = ''
            if (s?.type === 'hourly') scheduleLabel = `každou hodinu ${s.from || 0}:00–${s.to || 23}:00`
            else if (s?.type === 'daily') scheduleLabel = `denně v ${s.at || '07:00'}`

            return (
              <div key={cmd.name} className="p-5 border-b border-[#444] flex justify-between items-center hover:bg-[#353535]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⏰</span>
                    <span className="font-black text-sm">{cmd.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full text-[#f0f0f0] ${cmd.enabled ? 'bg-[#444]' : 'bg-black/30'}`}>{cmd.enabled ? 'ACTIVE' : 'PAUSED'}</span>
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">{cmd.description}</div>
                  <div className="mt-1 text-[10px] opacity-40">{cmd.handler} • {scheduleLabel}</div>
                </div>
                <div className="text-[10px] opacity-40 font-mono">{cmd.handler}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
