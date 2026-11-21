// components/AgentRing.tsx — čtvereček (avatar) agenta uprostřed, kolem něj kruhová lišta
// rozdělená na oddíly SKILLS / CLI / MCP; každý oddíl je dál rozsekaný po jednotlivých položkách.
// Velikost oddílu = počet položek (prázdný oddíl dostane tenkou „rezervu“, ať je vidět, že tam nic není).
import { useState } from 'react'
import { RING_COLORS } from '../lib/agentHub'

type Parts = { skills: string[]; cli: string[]; mcp: string[] }
const LABELS: Record<keyof Parts, string> = { skills: 'SKILLS', cli: 'CLI', mcp: 'MCP' }

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

export default function AgentRing({ parts, initial, size = 180, status, animate = true }: {
  parts: Parts; initial: string; size?: number; status?: string; animate?: boolean
}) {
  const [hover, setHover] = useState<{ sec: keyof Parts; item?: string } | null>(null)
  const c = size / 2
  const stroke = size * 0.085
  const r = c - stroke / 2 - 4
  const keys = Object.keys(LABELS) as (keyof Parts)[]
  const total = keys.reduce((s, k) => s + Math.max(parts[k].length, 0.35), 0)
  const GAP = 6 // mezera mezi oddíly (°)
  const usable = 360 - GAP * keys.length

  let cursor = GAP / 2
  const segs = keys.map(k => {
    const span = (Math.max(parts[k].length, 0.35) / total) * usable
    const s = { k, a0: cursor, a1: cursor + span }
    cursor += span + GAP
    return s
  })
  const sq = size * 0.4
  const online = status === 'active' || status === 'online'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size, marginBottom: size >= 120 ? 18 : 0 }}>
      <svg width={size} height={size} className={animate ? 'animate-[ringIn_0.6s_ease-out]' : ''}>
        <style>{`@keyframes ringIn { from { transform: rotate(-90deg) scale(0.6); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#2b2b2b" strokeWidth={stroke} />
        {segs.map(({ k, a0, a1 }) => {
          const items = parts[k]
          const color = RING_COLORS[k]
          if (!items.length) {
            return <path key={k} d={arc(c, c, r, a0, a1)} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={stroke}
              strokeDasharray="2 4" onMouseEnter={() => setHover({ sec: k })} onMouseLeave={() => setHover(null)} />
          }
          const step = (a1 - a0) / items.length
          return items.map((it, i) => {
            const on = hover?.sec === k && (!hover.item || hover.item === it)
            return (
              <path key={k + it} d={arc(c, c, r, a0 + i * step + (i ? 1 : 0), a0 + (i + 1) * step)} fill="none" stroke={color}
                strokeOpacity={hover ? (on ? 1 : 0.35) : 0.9} strokeWidth={on && hover?.item ? stroke + 4 : stroke}
                style={{ cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={() => setHover({ sec: k, item: it })} onMouseLeave={() => setHover(null)} />
            )
          })
        })}
      </svg>
      {/* čtvereček agenta */}
      <div className="absolute rounded-[10px] bg-[#444] border border-[#555] flex items-center justify-center font-black text-[#f0f0f0] shadow-[0_6px_18px_rgba(0,0,0,0.4)]"
        style={{ width: sq, height: sq, left: c - sq / 2, top: c - sq / 2, fontSize: sq * 0.48 }}>
        {initial}
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#353535]" style={{ background: online ? '#3ddc97' : '#777' }} />
      </div>
      {/* tooltip */}
      {hover && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded bg-[#222] border border-[#444] z-10"
          style={{ color: RING_COLORS[hover.sec] }}>
          {LABELS[hover.sec]}{hover.item ? ` • ${hover.item}` : ' • nic přidáno'}
        </div>
      )}
      {/* legenda oddílů pod kruhem (u malého kruhu jen tooltip) */}
      {size >= 120 && (
        <div className="absolute left-0 right-0 -bottom-5 flex justify-center gap-2 text-[9px] font-black tracking-wider whitespace-nowrap">
          {keys.map(k => <span key={k} style={{ color: RING_COLORS[k], opacity: parts[k].length ? 1 : 0.45 }}>{LABELS[k]} {parts[k].length}</span>)}
        </div>
      )}
    </div>
  )
}
