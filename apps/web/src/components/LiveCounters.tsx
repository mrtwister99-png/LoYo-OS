// apps/web/src/components/LiveCounters.tsx — živá počítadla v dolní liště (zleva doprava)
// Zdroj: /api/capabilities (podle typu) + /api/napady + /api/commands; obnova každých 15 s, změna = bliknutí.
import { useEffect, useRef, useState } from 'react'

const API_URL = 'http://localhost:3001'
const ORDER: { key: string; label: string }[] = [
  { key: 'agent', label: 'Agenti' },
  { key: 'team', label: 'Týmy' },
  { key: 'skill', label: 'Skilly' },
  { key: 'mcp', label: 'MCP' },
  { key: 'cli', label: 'CLI' },
  { key: 'workflow', label: 'Workflows' },
  { key: 'loop', label: 'Loopy' },
  { key: 'napady', label: 'Nápady' },
  { key: 'commands', label: 'Příkazy' },
]

export default function LiveCounters() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [flash, setFlash] = useState<Record<string, number>>({})
  const prev = useRef<Record<string, number>>({})

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [caps, napady, cmds] = await Promise.all([
          fetch(`${API_URL}/api/capabilities`).then((r) => r.json()),
          fetch(`${API_URL}/api/napady`).then((r) => r.json()).catch(() => ({ napady: [] })),
          fetch(`${API_URL}/api/commands`).then((r) => r.json()).catch(() => ({ count: 0 })),
        ])
        const next: Record<string, number> = {}
        for (const c of caps.capabilities ?? []) next[c.type] = (next[c.type] ?? 0) + 1
        next.napady = (napady.napady ?? []).filter((n: any) => !n.done).length
        next.commands = cmds.count ?? 0
        if (!alive) return
        const changed: Record<string, number> = {}
        for (const k of Object.keys(next)) if (prev.current[k] !== undefined && prev.current[k] !== next[k]) changed[k] = Date.now()
        prev.current = next
        setCounts(next)
        if (Object.keys(changed).length) setFlash((f) => ({ ...f, ...changed }))
      } catch {
        if (alive) setCounts(null)
      }
    }
    load()
    const t = setInterval(load, 15_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!counts) return <span className="opacity-40">API neběží — počítadla čekají…</span>

  return (
    <>
      <style>{`@keyframes counterFlash { 0% { color: #facc15; text-shadow: 0 0 8px #facc15; } 100% { color: inherit; text-shadow: none; } }`}</style>
      {ORDER.map((o, i) => (
        <span key={o.key} className="flex items-center gap-1 whitespace-nowrap">
          {i > 0 && <span className="opacity-20 mr-2">|</span>}
          <span className="opacity-60">{o.label}</span>
          <span
            key={flash[o.key] ?? 0}
            className="font-black"
            style={{ color: '#7cc8ff', animation: flash[o.key] ? 'counterFlash 1.6s ease-out' : undefined }}
          >{counts[o.key] ?? 0}</span>
        </span>
      ))}
    </>
  )
}
