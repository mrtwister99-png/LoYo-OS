// D:\dev\loyo-os\apps\web\src\components\AgentActions.tsx
// LOYO OS // akce agenta — tlačítka z manifestu ("actions"), každé pošle příkaz Mary (/api/run).
// {text} v příkazu = zeptá se na text (např. /julia {text}). Výsledek je i v chatu (a Telegramu).
import { useState } from 'react'

export type AgentAction = { label: string; command: string; ask?: string }

import { API_URL } from '../lib/agentHub'
const ACCENT = '#12a4ff'

export default function AgentActions({ actions, emptyHint }: { actions: AgentAction[]; emptyHint?: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const run = async (a: AgentAction) => {
    let command = a.command
    if (command.includes('{text}')) {
      const text = window.prompt(a.ask || `${a.label} — zadej text:`)
      if (!text?.trim()) return
      command = command.replace('{text}', text.trim())
    }
    setBusy(a.label); setError(''); setOutput('')
    try {
      const res = await fetch(`${API_URL}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command, source: 'ui' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setOutput(String(json.reply ?? '').replace(/^(OPEN_BUILDER|PICKER):[^\n]*\n?/gm, '').trim() || 'Hotovo.')
    } catch (e: any) {
      setError(e?.message === 'Failed to fetch' ? 'API neběží (localhost:3001)' : e?.message ?? String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold tracking-[0.2em]">⚡ AKCE</div>
        <div className="text-[10px] font-mono text-[#9a9a9a]/70">výsledek jde i do chatu</div>
      </div>
      {actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <button
              key={`${a.label}-${i}`}
              onClick={() => run(a)}
              disabled={!!busy}
              title={a.command}
              className="px-4 py-2 rounded-full text-[11px] font-bold tracking-wide border transition disabled:opacity-40 hover:brightness-110"
              style={i === 0 ? { background: ACCENT, borderColor: ACCENT, color: '#fff' } : { background: '#3a3a3a', borderColor: '#444', color: '#f0f0f0' }}
            >
              {busy === a.label ? '…' : a.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[10px] font-mono text-[#9a9a9a]/60">{emptyHint ?? 'Zatím žádné akce — přidáš je přes ⚙ vpravo nahoře.'}</div>
      )}
      {error && <div className="mt-2 text-[11px] font-mono text-[#ff6b6b]">{error}</div>}
      {output && (
        <pre className="mt-3 p-3 rounded-xl bg-[#3a3a3a] border border-[#444] text-[11px] font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">{output}</pre>
      )}
    </div>
  )
}

/** Editor akcí pro ⚙ režim. */
export function ActionsEditor({ actions, onChange }: { actions: AgentAction[]; onChange: (a: AgentAction[]) => void }) {
  const [label, setLabel] = useState('')
  const [command, setCommand] = useState('')
  const add = () => {
    if (!label.trim() || !command.trim().startsWith('/')) { alert('Název + příkaz začínající „/“ (např. /luuu 3, /julia {text})'); return }
    onChange([...actions, { label: label.trim(), command: command.trim() }])
    setLabel(''); setCommand('')
  }
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.2em]">⚡ AKCE • úpravy</div>
      <div className="mt-1 text-[10px] font-mono text-[#9a9a9a]/70">příkaz pro Mary; {'{text}'} = zeptá se na text</div>
      <div className="mt-3 space-y-2">
        {actions.map((a, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#3a3a3a] border border-[#444]">
            <span className="text-[11px] font-bold min-w-[120px]">{a.label}</span>
            <span className="flex-1 text-[11px] font-mono text-[#9a9a9a] truncate">{a.command}</span>
            <button onClick={() => i > 0 && onChange(actions.map((x, j) => (j === i - 1 ? actions[i] : j === i ? actions[i - 1] : x)))} title="Nahoru" className="text-[#9a9a9a] hover:text-[#f0f0f0] px-1">↑</button>
            <button onClick={() => onChange(actions.filter((_, j) => j !== i))} title="Odebrat" className="text-[#9a9a9a] hover:text-[#ff6b6b] px-1">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="název (🛒 Najít nabídky)" className="w-[40%] px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-mono outline-none focus:border-[#12a4ff]" />
        <input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="/příkaz {text}" className="flex-1 px-3 py-2 rounded-full bg-[#353535] border border-[#444] text-[11px] font-mono outline-none focus:border-[#12a4ff]" />
        <button onClick={add} className="px-4 py-2 rounded-full border border-[#444] text-[10px] font-black tracking-widest text-[#9a9a9a] hover:text-[#f0f0f0]">+ PŘIDAT</button>
      </div>
    </div>
  )
}
