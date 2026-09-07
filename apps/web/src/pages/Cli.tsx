import { useState, useEffect, useMemo } from 'react'

const GOLD = '#EEEAE1'

type CliTool = {
  id: string
  name: string
  path: string
  hasPackageJson: boolean
  hasIndex: boolean
  commands: string[]
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
    <div className="p-8 bg-[#F8F6F1] font-mono">
      {/* HEADER */}
      <div className="bg-white border-2 border-black p-6 flex justify-between items-center mb-6">
        <div>
          <div className="text-[10px] tracking-[0.4em] text-black/40">CLI // {tools.length} TOOLS • {scheduled.length} SCHEDULED • {tools.reduce((a, b) => a + b.commands.length, 0)} COMMANDS</div>
          <h2 className="text-3xl font-black mt-1 tracking-tighter">{tools.length} CLI TOOLS • AGENTI JE VOLAJÍ JAKO PŘÍKAZY</h2>
          <div className="mt-2 flex gap-2 text-[10px]">
            <span className="px-2 py-1 bg-black text-white">BIN: tools/cli/*</span>
            <span className="px-2 py-1 border-2 border-black">LIVE z filesystem</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => goBuilder()} className="px-6 py-3 bg-black text-white font-black text-xs tracking-widest border-2 border-black hover:bg-[#59CBFF] hover:text-black">+ NOVÝ CLI → BUILDER</button>
          <div className="w-3 h-3 animate-pulse" style={{ background: GOLD }}></div>
        </div>
      </div>

      {/* TABS + SEARCH */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="HLEDAT..." className="px-3 py-2 text-xs bg-black text-white border-2 border-black outline-none placeholder:text-white/40 w-[200px]" />
        <button onClick={() => setTab('tools')} className="px-3 py-1.5 text-[10px] font-black tracking-widest border-2 border-black" style={{ background: tab === 'tools' ? GOLD : 'white' }}>CLI TOOLS ({tools.length})</button>
        <button onClick={() => setTab('scheduled')} className="px-3 py-1.5 text-[10px] font-black tracking-widest border-2 border-black" style={{ background: tab === 'scheduled' ? '#FF9500' : 'white', color: tab === 'scheduled' ? 'white' : 'black' }}>⏰ SCHEDULED ({scheduled.length})</button>
      </div>

      {tab === 'tools' && (
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT — CLI LIST */}
          <div className="col-span-5 bg-white border-2 border-black h-[calc(100vh-280px)] flex flex-col">
            <div className="p-4 text-[10px] tracking-[0.4em] text-black/40 border-b-2 border-black">CLI LIST // {filtered.length} • NALEZENO V tools/cli/</div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm opacity-40">Žádné CLI tools v tools/cli/</div>
              )}
              {filtered.map(cli =>
              {
                const isActive = selected === cli.id
                return (
                  <div key={cli.id} onClick={() => setSelected(cli.id)} className="p-5 cursor-pointer border-b-2 border-black flex justify-between" style={{ background: isActive ? GOLD : 'white' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 items-center">
                        <span className="font-black text-sm">$ {cli.name}</span>
                        {cli.hasIndex && <span className="text-[9px] px-2 py-0.5 bg-black text-white">READY</span>}
                        {cli.hasPackageJson && <span className="text-[9px] px-1.5 py-0.5 border border-black/20">pkg</span>}
                      </div>
                      <div className="text-[11px] opacity-60 mt-1">{cli.path}</div>
                      <div className="mt-2 text-[10px] opacity-50">{cli.commands.length} commands parsováno z index.ts</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT — DETAIL */}
          <div className="col-span-7 bg-white border-2 border-black p-8 h-[calc(100vh-280px)] overflow-y-auto">
            {!active ? (
              <div className="flex items-center justify-center h-full text-sm opacity-40">Vyber CLI tool vlevo</div>
            ) : (
              <>
                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-black text-xl">$</div>
                  <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      {active.hasIndex && <span className="text-[10px] px-2 py-1 bg-black text-white">READY</span>}
                      {active.hasPackageJson && <span className="text-[10px] px-2 py-1 border-2 border-black">package.json ✓</span>}
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
                        <div className="mt-8 border-2 border-black">
                          <div className="p-3 bg-black text-white text-[10px] tracking-widest">SUBCOMMANDS // {subcommands.length}</div>
                          <div>
                            {subcommands.map(cmd => (
                              <div key={cmd} className="p-4 border-b border-black/10 hover:bg-black hover:text-white group cursor-pointer">
                                <div className="font-black text-xs">pnpm cli:{active.name} {cmd}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {flags.length > 0 && (
                        <div className="mt-4 border-2 border-black/30">
                          <div className="p-3 bg-black/80 text-white text-[10px] tracking-widest">FLAGS // {flags.length} • DOSTUPNÉ PARAMETRY</div>
                          <div className="flex flex-wrap gap-2 p-4">
                            {flags.map(flag => (
                              <span key={flag} className="px-3 py-1.5 bg-black/5 border border-black/10 text-xs font-mono">{flag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {active.commands.length === 0 && (
                  <div className="mt-8 p-6 border-2 border-dashed border-black/20 text-center text-sm opacity-40">
                    Žádné příkazy nalezeny v index.ts
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button onClick={() => goBuilder(active.id)} className="flex-1 py-3 bg-black text-white font-black text-xs tracking-widest border-2 border-black hover:bg-[#59CBFF] hover:text-black">EDITOVAT V BUILDERU →</button>
                </div>

                <div className="mt-4 text-[10px] opacity-60 leading-relaxed"><b className="text-black">CLI = příkaz co vykoná agent.</b> Agent zavolá <b>pnpm cli:{active.name} search ...</b>. CLI se spustí, udělá práci a skončí. Na rozdíl od MCP (server co běží stále).</div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="bg-white border-2 border-black">
          <div className="p-4 bg-black text-white text-[10px] tracking-widest flex justify-between">
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
              <div key={cmd.name} className="p-5 border-b border-black/10 flex justify-between items-center hover:bg-[#FFF8F0]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⏰</span>
                    <span className="font-black text-sm">{cmd.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full text-white ${cmd.enabled ? 'bg-black' : 'bg-black/30'}`}>{cmd.enabled ? 'ACTIVE' : 'PAUSED'}</span>
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
