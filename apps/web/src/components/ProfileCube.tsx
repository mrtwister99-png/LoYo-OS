// src/components/ProfileCube.tsx
// LOYO 3D Cube v2 – kaskáda doprava šikmo dolů + nasátí – čitelná
import { useState, useRef, useEffect, useCallback } from 'react'

export const PROFILES = [
  { letter: 'L', color: '#040b8d', label: 'Osobní', sub: 'L • Dashboard' },
  { letter: 'O', color: '#CDA24D', label: 'Programování', sub: 'O • Dev' },
  { letter: 'Y', color: '#ac0001', label: 'JOB', sub: 'Y • Job tools' },
  { letter: 'O', color: '#6300c7', label: '3D Design', sub: 'O • Grafik' },
] as const

type Props = {
  activeProfile: number
  setActiveProfile: (n: number) => void
  setPage: (p: any) => void
  focused?: boolean
  profileSubFocus?: number | null
  biosMode?: boolean
  setBiosMode?: (v: boolean) => void
}

export default function ProfileCube({ activeProfile, setActiveProfile, setPage, focused, profileSubFocus, biosMode, setBiosMode }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [selectingIdx, setSelectingIdx] = useState<number | null>(null)
  const holdTimer = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pressStart = useRef<number>(0)

  const current = PROFILES[activeProfile]

  const handleSelect = useCallback((idx: number) => {
    if (selectingIdx!== null) return
    setSelectingIdx(idx)
    try { navigator.vibrate?.(15) } catch {}
    setTimeout(() => {
      const i = Math.max(0, Math.min(3, idx))
      setActiveProfile(i)
      setPage('dashboard')
      setShowMenu(false)
      setSelectingIdx(null)
    }, 380)
  }, [setActiveProfile, setPage, selectingIdx])

  const startHold = useCallback(() => {
    setIsPressing(true)
    pressStart.current = Date.now()
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => {
      setShowMenu(true)
      try { navigator.vibrate?.(20) } catch {}
    }, 450) as unknown as number
  }, [])

  const cancelHold = useCallback(() => {
    setIsPressing(false)
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const endPress = useCallback((e?: any) => {
    const duration = Date.now() - pressStart.current
    cancelHold()
    if (showMenu || selectingIdx!== null) return
    if (duration < 450) {
      e?.preventDefault?.()
      const next = (activeProfile + 1) % 4
      handleSelect(next)
    }
  }, [activeProfile, showMenu, cancelHold, handleSelect, selectingIdx])

  useEffect(() => {
    if (!showMenu) return
    const onDown = (ev: MouseEvent) => {
      if (selectingIdx!== null) return
      if (containerRef.current &&!containerRef.current.contains(ev.target as Node)) {
        setShowMenu(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [showMenu, selectingIdx])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { setShowMenu(false); setSelectingIdx(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rotation = -activeProfile * 90

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
      <div
        onPointerDown={startHold}
        onPointerUp={endPress}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(ev) => { ev.preventDefault(); setBiosMode && setBiosMode(!biosMode) }}
        title={`Profil: ${current.label} – klik = další | drž = kaskáda 4x | pravý = BIOS`}
        style={{
          width: 38,
          height: 38,
          perspective: 600,
          cursor: 'pointer',
          userSelect: 'none',
          filter: focused? `drop-shadow(0 0 0 3px ${current.color}88)` : 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
          transform: isPressing? 'scale(0.92)' : 'scale(1)',
          transition: 'transform 0.15s ease',
          outline: focused && profileSubFocus!== null? `2px dashed ${current.color}` : 'none',
          outlineOffset: 2,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg)`,
            transition: selectingIdx!== null? 'transform 0.48s cubic-bezier(0.34,1.56,0.64,1)' : 'transform 0.55s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {PROFILES.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 38,
                height: 38,
                background: p.color,
                color: i === 1? '#000' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 16,
                fontFamily: 'monospace',
                border: '2px solid rgba(255,255,255,0.22)',
                backfaceVisibility: 'hidden',
                transform: `rotateY(${i * 90}deg) translateZ(19px)`,
              }}
            >
              {p.letter}
            </div>
          ))}
        </div>
      </div>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            width: 268,
            background: '#f5f5f3',
            border: '3px solid #0a0a0a',
            borderRadius: 14,
            padding: 8,
            zIndex: 100,
            boxShadow: '8px 8px 0px #0a0a0a, 0 20px 40px rgba(0,0,0,0.25)',
            animation: 'loyoPop 0.42s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 6px 8px', borderBottom: '1px solid rgba(10,10,10,0.1)' }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(10,10,10,0.5)' }}>KASKÁDA → ŠIKMO DOLŮ</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', background: '#0a0a0a', color: '#fff', padding: '2px 6px', borderRadius: 999, fontWeight: 900 }}>{activeProfile + 1}/4</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {PROFILES.map((p, idx) => {
              const active = idx === activeProfile
              const isSelecting = selectingIdx === idx
              const isUnselectedSucking = selectingIdx!== null && selectingIdx!== idx
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={selectingIdx!== null}
                  style={{
                    marginLeft: idx * 24,
                    width: 164,
                    height: 56,
                    background: p.color,
                    color: idx === 1? '#000' : '#fff',
                    border: active? '3px solid #0a0a0a' : '3px solid #0a0a0a',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px',
                    fontWeight: 900,
                    cursor: selectingIdx!== null? 'default' : 'pointer',
                    boxShadow: active? `0 0 0 2px ${p.color}, 5px 5px 0px #0a0a0a` : '4px 4px 0px #0a0a0a',
                    animation: isUnselectedSucking
                    ? `loyoSuckBack 0.32s cubic-bezier(0.6,0,0.8,1) forwards`
                      : isSelecting
                    ? `loyoStay 0.38s cubic-bezier(0.16,1,0.3,1) forwards`
                      : `loyoCascade 0.52s cubic-bezier(0.34,1.56,0.64,1) ${idx * 70}ms both`,
                    zIndex: isSelecting? 20 : 4,
                  } as any}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 32, height: 32, background: '#0a0a0a', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.letter}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                      <span style={{ fontSize: 12 }}>{p.label.toUpperCase()}</span>
                      <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 700 }}>{p.sub}</span>
                    </span>
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{idx + 1}/4</span>
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(10,10,10,0.4)', fontFamily: 'monospace', textAlign: 'center' }}>
            V2 • 3 KOSTKY SE NASAJÍ ZPĚT • VYBRANÁ ZŮSTANE
          </div>
        </div>
      )}

      <style>{`
        @keyframes loyoPop {
          from { opacity: 0; transform: translateY(-12px) scale(0.92) rotateX(10deg); }
          to { opacity: 1; transform: translateY(0) scale(1) rotateX(0); }
        }
        @keyframes loyoCascade {
          from { opacity: 0; transform: translate(-24px, -16px) scale(0.4) rotate(-12deg); }
          to { opacity: 1; transform: translate(0,0) scale(1) rotate(0); }
        }
        @keyframes loyoSuckBack {
          to { transform: translate(-60px, -20px) scale(0); opacity: 0; }
        }
        @keyframes loyoStay {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}
