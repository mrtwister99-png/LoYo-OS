// components/NumBadge.tsx — štítek "typ-číslo" (např. 4-01) pro seznamy capabilities
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

type Props = {
  type: number              // číslo typu (categoryNumbers.*)
  n?: number                // uložené pořadové číslo položky
  idx: number               // záložní pořadí v seznamu (když n chybí)
  label?: string            // volitelný text za číslem (např. id)
  tone?: 'dark' | 'light'   // dark = černý štítek, light = bílý
  pill?: boolean            // zaoblený štítek
  className?: string
  style?: CSSProperties
}

export default function NumBadge({ type, n, idx, label, tone = 'dark', pill = false, className = '', style }: Props) {
  const num = String(n ?? idx + 1).padStart(2, '0')
  return (
    <span
      className={`font-mono ${className}`}
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1.3,
        padding: pill ? '2px 8px' : '2px 6px',
        borderRadius: pill ? 999 : 4,
        letterSpacing: pill ? '0.1em' : undefined,
        background: tone === 'dark' ? '#444' : '#3a3a3a', border: '1px solid #4a4a4a',
        color: tone === 'dark' ? '#f0f0f0' : '#9a9a9a',
        ...style,
      }}
    >
      {type}-{num}{label ? ` ${label}` : ''}
    </span>
  )
}

// id → pořadové číslo podle typu (z /api/capabilities), např. nums.agent['lubor-nehleda'] = 2
export type CapNumbers = Record<string, Record<string, number>>

export function useCapNumbers(): CapNumbers {
  const [nums, setNums] = useState<CapNumbers>({})
  useEffect(() => {
    let alive = true
    fetch('http://localhost:3001/api/capabilities')
      .then(r => (r.ok? r.json() : null))
      .then(d => {
        if (!alive || !d) return
        const out: CapNumbers = {}
        for (const c of d.capabilities || []) {
          if (typeof c.number !== 'number') continue
          ;(out[c.type] = out[c.type] || {})[c.id] = c.number
        }
        setNums(out)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return nums
}