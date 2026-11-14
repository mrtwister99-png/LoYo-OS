import { useState, useEffect } from 'react'

type MacroTrigger = 'manual' | 'hotkey' | 'agent' | 'schedule'
type Macro = {
  id: number
  name: string
  description: string
  steps: number
  trigger: MacroTrigger
  hotkey?: string
  assignedAgent?: string
  timesUsed: number
  lastUsed: string
  category: 'recording' | 'workflow' | 'agent'
  color: string
}

const KEY = 'loyo-macros'

export default function Macros() {
  const [macros, setMacros] = useState<Macro[]>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
    return [
      { id: 1, name: 'Build & Test', description: 'npm run build + test', steps: 5, trigger: 'hotkey', hotkey: 'Ctrl+Shift+B', assignedAgent: 'Builder', timesUsed: 42, lastUsed: new Date().toISOString(), category: 'workflow', color: '#12a4ff' },
      { id: 2, name: 'Deploy to Tauri', description: 'Sestaví a spustí Tauri app', steps: 8, trigger: 'manual', timesUsed: 12, lastUsed: new Date().toISOString(), category: 'recording', color: '#9a9a9a' },
      { id: 3, name: 'Agent Auto-Fix', description: 'Agent opraví TS chyby automaticky', steps: 3, trigger: 'agent', assignedAgent: 'Fixer', timesUsed: 128, lastUsed: new Date().toISOString(), category: 'agent', color: '#9a9a9a' },
    ]
  })
  const [isRecording, setIsRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | MacroTrigger>('all')
  const [selectedId, setSelectedId] = useState<number | null>(1)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(macros)) } catch {} }, [macros])
  useEffect(() => {
    if (!isRecording) return
    const t = setInterval(() => setRecSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [isRecording])

  const filtered = macros.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' ? true : m.trigger === filter
    return matchSearch && matchFilter
  })

  const selected = macros.find(m => m.id === selectedId)

  const addMacro = () => {
    const m: Macro = {
      id: Date.now(),
      name: `New Macro ${macros.length + 1}`,
      description: 'Zaznamenané kroky...',
      steps: Math.floor(Math.random()*10)+1,
      trigger: 'manual',
      timesUsed: 0,
      lastUsed: new Date().toISOString(),
      category: 'recording',
      color: '#12a4ff'
    }
    setMacros(p => [m, ...p])
    setSelectedId(m.id)
  }

  const deleteMacro = (id: number) => setMacros(p => p.filter(x => x.id !== id))
  const duplicate = (id: number) => {
    const m = macros.find(x => x.id === id)
    if (!m) return
    setMacros(p => [{ ...m, id: Date.now(), name: m.name + ' copy' }, ...p])
  }

  return (
    <div className="min-h-full bg-[#2b2b2b] p-4 md:p-6" style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#3a3a3a] border border-[#444] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-[16px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono font-black px-2 py-1 rounded-full bg-[#444] text-[#f0f0f0] border border-[#444]">MACRO</span>
              <div className="h-[2px] w-12 bg-[#444]"></div>
              <span className="text-[10px] tracking-[0.3em] font-black opacity-40">AUTOMATION</span>
            </div>
            <h1 className="font-black text-xl tracking-tight">MACRO MENU • {macros.length}</h1>
            <p className="text-xs opacity-60 mt-1">Nahrávej, přehrávej, přiřazuj agentům • {macros.reduce((s,m)=>s+m.timesUsed,0)} spuštění</p>
          </div>

          <div className="bg-[#444] border border-[#444] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-[16px] space-y-3">
            <button
              onClick={() => { if (isRecording) { setIsRecording(false); setRecSeconds(0); addMacro() } else { setIsRecording(true) } }}
              className={`w-full py-4 font-black border border-[#444] rounded-[12px] flex items-center justify-center gap-3 text-sm tracking-widest shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all ${isRecording ? 'bg-[#444] text-[#f0f0f0] animate-pulse' : 'bg-[#444] text-[#f0f0f0] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
            >
              <span className={`w-3 h-3 rounded-full bg-[#444] border border-[#444] ${isRecording ? 'animate-ping' : ''}`} />
              {isRecording ? `● RECORDING ${recSeconds}s • STOP` : '● RECORD NEW MACRO'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={addMacro} className="bg-[#3a3a3a] text-[#f0f0f0] py-2 border border-[#444] rounded-[10px] text-[10px] font-black">+ NEW</button>
              <button className="bg-[#3a3a3a] text-[#f0f0f0] py-2 border border-[#444] rounded-[10px] text-[10px] font-black">IMPORT</button>
              <button className="bg-[#3a3a3a] text-[#f0f0f0] py-2 border border-[#444] rounded-[10px] text-[10px] font-black">EXPORT ALL</button>
            </div>
          </div>

          <div className="bg-[#3a3a3a] border border-[#444] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-[12px] space-y-3">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hledat macro..." className="w-full bg-[#2b2b2b] border border-[#444] px-3 py-2.5 text-xs rounded-[10px] font-bold outline-none" />
            <div className="flex gap-2">
              {(['all','manual','hotkey','agent','schedule'] as const).map(t => (
                <button key={t} onClick={()=>setFilter(t as any)} className={`text-[9px] px-2.5 py-1 border border-[#444] font-black rounded-full ${filter===t? 'bg-[#12a4ff] text-white':'bg-[#3a3a3a]'}`}>{t.toUpperCase()}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
            {filtered.map(m => (
              <div key={m.id} onClick={()=>setSelectedId(m.id)} className={`border border-[#444] p-3 rounded-[12px] cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all ${selectedId===m.id? 'bg-[#12a4ff] text-white translate-x-[-1px] translate-y-[-1px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]':'bg-[#3a3a3a] hover:translate-x-[-1px] hover:translate-y-[-1px]'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full border border-[#444]" style={{ background: m.color }} />
                      <span className="font-black text-xs truncate">{m.name}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full border border-[#444] font-black ${m.category==='agent'?'bg-[#444] text-[#f0f0f0]':m.category==='workflow'?'bg-[#12a4ff] text-[#f0f0f0]':'bg-[#3a3a3a] text-[#f0f0f0]'}`}>{m.steps} steps</span>
                    </div>
                    <div className="text-[10px] opacity-60 mt-1 truncate">{m.description}</div>
                    <div className="flex gap-2 mt-2 items-center">
                      <span className="text-[8px] font-mono bg-[#2b2b2b] text-[#f0f0f0] border border-[#444] px-1.5 py-0.5 rounded-full">{m.trigger.toUpperCase()} {m.hotkey?`• ${m.hotkey}`:''}</span>
                      {m.assignedAgent && <span className="text-[8px] opacity-60">→ {m.assignedAgent}</span>}
                      <span className="text-[8px] opacity-40 ml-auto">{m.timesUsed}x • {new Date(m.lastUsed).toLocaleDateString('cs-CZ')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={(e)=>{ e.stopPropagation(); duplicate(m.id) }} className="w-6 h-6 bg-[#3a3a3a] text-[#f0f0f0] border border-[#444] rounded-full font-black text-[10px]">⎘</button>
                    <button onClick={(e)=>{ e.stopPropagation(); deleteMacro(m.id) }} className="w-6 h-6 bg-[#444] text-[#f0f0f0] border border-[#444] rounded-full font-black text-[10px]">X</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT - DETAIL */}
        <div className="lg:col-span-7">
          <div className="bg-[#3a3a3a] border border-[#444] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-[16px] min-h-[700px]">
            {selected ? (
              <div className="space-y-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-[#444]" style={{ background: selected.color }} />
                      <span className={`text-[10px] px-2 py-1 rounded-full border border-[#444] font-black ${selected.category==='agent'?'bg-[#444] text-[#f0f0f0]':'bg-[#444] text-[#f0f0f0]'}`}>{selected.category.toUpperCase()}</span>
                      <span className="text-[10px] font-mono opacity-60">{selected.trigger.toUpperCase()} {selected.hotkey?`• ${selected.hotkey}`:''}</span>
                    </div>
                    <h2 className="font-black text-2xl mt-3 tracking-tight">{selected.name}</h2>
                    <p className="text-xs opacity-60 mt-1">{selected.description} • {selected.steps} kroků • použito {selected.timesUsed}x</p>
                  </div>
                  <button className="bg-[#12a4ff] text-[#f0f0f0] px-5 py-2.5 border border-[#444] rounded-[12px] text-xs font-black shadow-[0_8px_24px_rgba(0,0,0,0.35)]">▶ PLAY</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#2b2b2b] border border-[#444] p-3 rounded-[12px]">
                    <div className="text-[10px] font-black opacity-60 mb-2">TRIGGER</div>
                    <select className="w-full bg-[#3a3a3a] border border-[#444] p-2 text-xs rounded-[8px] font-black">
                      <option>Manual</option>
                      <option>Hotkey</option>
                      <option>Agent</option>
                      <option>Schedule</option>
                    </select>
                    <input placeholder="Ctrl+Shift+M" className="mt-2 w-full bg-[#3a3a3a] border border-[#444] p-2 text-xs rounded-[8px]" defaultValue={selected.hotkey||''} />
                  </div>
                  <div className="bg-[#2b2b2b] border border-[#444] p-3 rounded-[12px]">
                    <div className="text-[10px] font-black opacity-60 mb-2">AGENT</div>
                    <select className="w-full bg-[#3a3a3a] border border-[#444] p-2 text-xs rounded-[8px] font-black">
                      <option>Žádný • ruční</option>
                      <option>Builder • může spouštět makra</option>
                      <option>Fixer • auto-fix</option>
                      <option>Tester • spouští testy</option>
                    </select>
                    <div className="text-[9px] opacity-50 mt-2">Agent může vyvolat macro jako skill: <code className="bg-[#444] text-[#f0f0f0] px-1 rounded">useMacro('Build & Test')</code></div>
                  </div>
                </div>

                <div className="bg-[#444] text-[#f0f0f0] border border-[#444] p-4 rounded-[12px]">
                  <div className="text-[10px] font-black tracking-[0.2em] opacity-60 mb-3">STEPS • {selected.steps}</div>
                  <div className="space-y-2 font-mono text-xs">
                    {Array.from({ length: selected.steps }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/10 border border-white/20 p-2 rounded-[8px]">
                        <span className="w-6 h-6 bg-[#3a3a3a] text-[#f0f0f0] rounded-full flex items-center justify-center font-black text-[10px]">{i+1}</span>
                        <span className="opacity-80">{['click .btn-primary', 'type "npm run build"', 'wait 500ms', 'invoke agent Builder', 'save file'][i%5]}</span>
                        <span className="ml-auto opacity-40 text-[10px]">{[120, 45, 500, 200, 30][i%5]}ms</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 bg-[#444] text-[#f0f0f0] py-3 border border-[#444] rounded-[12px] text-xs font-black shadow-[0_8px_24px_rgba(0,0,0,0.35)]">💾 SAVE</button>
                  <button className="flex-1 bg-[#3a3a3a] text-[#f0f0f0] py-3 border border-[#444] rounded-[12px] text-xs font-black">EDIT STEPS</button>
                  <button onClick={()=>deleteMacro(selected.id)} className="royal-danger bg-[#444] px-4 py-3 border border-[#ff1e00]/40 rounded-[12px] text-xs font-black">DELETE</button>
                </div>

                <div className="bg-[#444] border border-[#444] p-3 rounded-[12px]">
                  <div className="text-[10px] font-black">💡 AGENTI + MACRA</div>
                  <div className="text-[11px] mt-1 leading-snug">Ano, agenti můžou makra používat jako skills. V <code className="bg-[#444] text-[#f0f0f0] px-1 rounded">skills/</code> stačí přidat <code className="bg-[#444] text-[#f0f0f0] px-1 rounded">macro:Build & Test</code> a agent ho zavolá když potřebuje. Makro se zaznamená jako akce v Activity logu.</div>
                </div>
              </div>
            ) : (
              <div className="h-[600px] flex flex-col items-center justify-center opacity-30">
                <div className="text-6xl mb-4">🎬</div>
                <div className="font-black text-sm">Vyber macro vlevo</div>
                <div className="text-xs mt-2">nebo nahraj nové přes RECORD</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
