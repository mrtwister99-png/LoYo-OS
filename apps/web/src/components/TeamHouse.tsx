// components/TeamHouse.tsx — „barák“: agenti jednoho týmu pod jednou střechou.
import type { ReactNode } from 'react'

export default function TeamHouse({ name, color, count, children, compact = false }: {
  name: string; color: string; count: number; children: ReactNode; compact?: boolean
}) {
  const roofH = compact ? 34 : 54
  return (
    <div className="relative min-w-0">
      {/* střecha */}
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="block w-full" style={{ height: roofH }}>
        <polygon points="2,20 50,1 98,20" fill="#3a3a3a" stroke={color} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        {/* komín */}
        <rect x="76" y="4" width="5" height="9" fill="#3a3a3a" stroke={color} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: roofH * 0.42 }}>
        <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 truncate max-w-[70%]" style={{ color }}>
          {name} <span className="opacity-60">• {count}</span>
        </span>
      </div>
      {/* zdi */}
      <div className="border-x border-b rounded-b-[10px] bg-[#2f2f2f] mx-[2%]" style={{ borderColor: color + '88' }}>
        <div className={compact ? 'p-2' : 'p-4'}>{children}</div>
        {/* práh */}
        <div className="h-[3px] rounded-b-[10px]" style={{ background: color }} />
      </div>
    </div>
  )
}
