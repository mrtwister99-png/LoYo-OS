// components/SystemPowerButtons.tsx — vpravo nahoře: R = restart celého LoYo OS, ⏻ = vypnout.
// Volá POST /api/system/power → tools/loyo-power.ps1 (zavře 4 terminály spouštěče, u R nahodí nový LoYo OS).
import { useState } from 'react'
import { API_URL } from '../lib/agentHub'

type Phase = null | 'restart' | 'off' | 'done-off' | 'error'

export default function SystemPowerButtons() {
  const [phase, setPhase] = useState<Phase>(null)
  const [msg, setMsg] = useState('')

  const run = async (mode: 'restart' | 'off') => {
    const q = mode === 'restart'
      ? 'Restartovat LoYo OS? Zavřou se 4 terminály (LOYO OS, API, MCP, WEB) a hned naběhnou nové.'
      : 'Vypnout celý LoYo OS? Zavře se spouštěč, API, MCP, WEB i Mary bot. Strážce ho znovu nenahodí.'
    if (!window.confirm(q)) return
    setPhase(mode); setMsg(mode === 'restart' ? 'Restartuju LoYo OS…' : 'Vypínám LoYo OS…')
    try {
      const r = await fetch(`${API_URL}/api/system/power`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } catch (e: any) {
      setPhase('error'); setMsg(e?.message === 'Failed to fetch' ? 'API neběží — restart/vypnutí přes něj nejde. Použij zástupce LoYo OS na ploše.' : `Chyba: ${e?.message ?? e}`)
      return
    }
    if (mode === 'off') { setTimeout(() => { setPhase('done-off'); setMsg('LoYo OS je vypnutý. Zapneš ho zástupcem „LoYo OS“ na ploše.') }, 4000); return }
    // restart: počkat, až staré API zmizí a nové naběhne, pak obnovit stránku
    const t0 = Date.now()
    let wentDown = false
    const tick = async () => {
      let up = false
      try { up = (await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(2000) })).ok } catch {}
      if (!up) wentDown = true
      const s = Math.round((Date.now() - t0) / 1000)
      if (wentDown && up) { setMsg('Naběhlo, obnovuju…'); setTimeout(() => window.location.reload(), 2500); return }
      if (s > 180) { setPhase('error'); setMsg('Za 3 min nenaběhlo — mrkni na okno „LOYO OS“ na liště.'); return }
      setMsg(wentDown ? `Startuju nový LoYo OS… ${s} s` : `Zavírám terminály… ${s} s`)
      setTimeout(tick, 2000)
    }
    setTimeout(tick, 1500)
  }

  const btn = (label: string, title: string, color: string, onClick: () => void) => (
    <button onClick={onClick} disabled={!!phase && phase !== 'error'} title={title}
      style={{ width: 26, height: 19, borderRadius: 5, border: `1px solid ${color}66`, background: '#2b2b2b', color, fontWeight: 900, fontSize: 11, lineHeight: 1, padding: 0, cursor: 'pointer' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#2b2b2b'; e.currentTarget.style.color = color }}>
      {label}
    </button>
  )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
        {btn('R', 'Restart LoYo OS (zavře 4 terminály a nahodí nové)', '#12a4ff', () => run('restart'))}
        {btn('⏻', 'Vypnout celý LoYo OS', '#ff1e00', () => run('off'))}
      </div>
      {phase && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#353535', border: `1px solid ${phase === 'error' ? '#ff1e00' : '#444'}`, borderRadius: 14, padding: '28px 36px', minWidth: 360, textAlign: 'center', color: '#f0f0f0' }}>
            <div style={{ fontSize: 34 }}>{phase === 'off' || phase === 'done-off' ? '⏻' : phase === 'error' ? '⚠' : '↻'}</div>
            <div style={{ marginTop: 10, fontWeight: 800, fontSize: 14 }}>{msg}</div>
            {(phase === 'error' || phase === 'done-off') && (
              <button onClick={() => setPhase(null)} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 999, border: '1px solid #444', background: '#2b2b2b', color: '#f0f0f0', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>ZAVŘÍT</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
