import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import sipkkkkaaImg from '../images/sipkkkkaa.png'
import type { Page } from '../hooks/useAppState'
import { categoryColors } from '../styles/theme'
import { MENU_STRUCTURE_P2, MENU_META_P2 } from '../pages/profile2/MenuP2'
import { MENU_STRUCTURE_P3, MENU_META_P3 } from '../pages/profile3/MenuP3'
import { MENU_STRUCTURE_P4, MENU_META_P4 } from '../pages/profile4/MenuP4'

const MENU_META: Record<string, { color: string; num: string }> = {
  dashboard: { color: categoryColors.dashboard, num: '0_01' },
  kalendar: { color: categoryColors.calendar, num: '0_02' },
  activity: { color: categoryColors.activity, num: '0_03' },
  notes: { color: categoryColors.notes, num: '0_04' },
  tasks: { color: categoryColors.tasks, num: '0_05' },
  tym: { color: categoryColors.teams, num: '7_01' },
  agenti: { color: categoryColors.agents, num: '1_01' },
  skills: { color: categoryColors.skills, num: '3_01' },
  mcp: { color: categoryColors.mcp, num: '2_01' },
  loops: { color: categoryColors.loops, num: '6_01' },
  workflows: { color: categoryColors.workflows, num: '8_01' },
  api: { color: categoryColors.api, num: '4_02' },
  cli: { color: categoryColors.cli, num: '4_03' },
}

type Props = {
  page: Page
  setPage: (id: Page) => void
  activeProfile: number
  forcedOpen?: boolean
  forcedIdx?: number
  onForcedIdxChange?: (n: number) => void
  onClose?: () => void
  onOpen?: () => void
  onTabToHeader?: () => void
}

type MenuNode =
  | { type: 'item'; id: string; label: string }
  | { type: 'group'; id: string; label: string; children: { id: string; label: string }[] }

const MENU_STRUCTURE: MenuNode[] = [
  { type: 'item', id: 'dashboard', label: 'DASHBOARD' },
  { type: 'item', id: 'kalendar', label: 'KALENDÁŘ' },
  { type: 'item', id: 'activity', label: 'AKTIVITY' },
  { type: 'item', id: 'notes', label: 'POZNÁMKY' },
  { type: 'item', id: 'tasks', label: 'ÚKOLY' },
  {
    type: 'group',
    id: 'firma',
    label: 'FIRMA',
    children: [
      { id: 'tym', label: 'TEAMS' },
      { id: 'agenti', label: 'AGENTS' },
    ],
  },
  {
    type: 'group',
    id: 'config',
    label: 'CONFIGURATION',
    children: [
      { id: 'skills', label: 'SKILLS' },
      { id: 'mcp', label: 'MCP' },
      { id: 'loops', label: 'LOOPS' },
      { id: 'workflows', label: 'WORKFLOWS' },
      { id: 'api', label: 'API' },
      { id: 'cli', label: 'CLI' },
    ],
  },
]

const getMenuConfig = (activeProfile: number) => {
  if (activeProfile === 1) return { structure: MENU_STRUCTURE_P2 as any, meta: MENU_META_P2, accent: '#CDA24D' }
  if (activeProfile === 2) return { structure: MENU_STRUCTURE_P3 as any, meta: MENU_META_P3, accent: '#ac0001' }
  if (activeProfile === 3) return { structure: MENU_STRUCTURE_P4 as any, meta: MENU_META_P4, accent: '#6300c7' }
  return { structure: MENU_STRUCTURE, meta: MENU_META, accent: '#040b8d' }
}

function darken(hex: string, amount = 0.28) {
  try {
    const c = hex.replace('#','')
    const r = parseInt(c.substring(0,2),16)
    const g = parseInt(c.substring(2,4),16)
    const b = parseInt(c.substring(4,6),16)
    const dr = Math.max(0, Math.floor(r * (1-amount)))
    const dg = Math.max(0, Math.floor(g * (1-amount)))
    const db = Math.max(0, Math.floor(b * (1-amount)))
    return `rgb(${dr},${dg},${db})`
  } catch { return '#1A1A1A' }
}

function MenuComponent({ page, setPage, activeProfile, forcedOpen, forcedIdx, onForcedIdxChange, onClose, onOpen, onTabToHeader }: Props) {
  const [open, setOpen] = useState({ firma: true, config: true, jobtools: true } as any)
  const [isHovered, setIsHovered] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalIdx, setInternalIdx] = useState(0)
  const [pressedId, setPressedId] = useState<string | null>(null)

  const isControlled = forcedOpen!== undefined
  const keyboardOpen = isControlled? forcedOpen! : internalOpen
  const selectedIdx = isControlled? (forcedIdx?? 0) : internalIdx

  const menuConfig = useMemo(() => getMenuConfig(activeProfile), [activeProfile])
  const currentStructure = menuConfig.structure
  const currentMeta = menuConfig.meta as any
  const profileAccent = menuConfig.accent

  useEffect(() => {
    setOpen({ firma: true, config: true, jobtools: true } as any)
  }, [activeProfile])

  useEffect(() => {
    if (isControlled &&!forcedOpen) {
      setIsHovered(false)
    }
  }, [forcedOpen, isControlled])

  const setSelectedIdx = useCallback((n: number) => {
    if (isControlled) {
      onForcedIdxChange?.(n)
    } else {
      setInternalIdx(n)
    }
  }, [isControlled, onForcedIdxChange])

  const isMenuVisible = isHovered || keyboardOpen

  const flatItems = useMemo(() => {
    const list: any[] = []
    for (const node of currentStructure) {
      if (node.type === 'item') {
        list.push({ type: 'item', id: node.id, label: node.label })
      } else {
        list.push({ type: 'group', id: node.id, label: node.label })
        if ((open as any)[node.id]) {
          for (const child of node.children) {
            list.push({ type: 'item', id: child.id, label: child.label })
          }
        }
      }
    }
    return list
  }, [open, currentStructure])

  const getFocused = useCallback((id: string, type: 'item' | 'group') => {
    if (selectedIdx < 0) return false
    const cur = flatItems[selectedIdx]
    return cur && cur.id === id && cur.type === type
  }, [selectedIdx, flatItems])

  const ClayItem = ({ id, label, focused }: any) => {
    const active = page === id
    const meta = (currentMeta as any)[id] || (MENU_META as any)[id] || { color: profileAccent, num: '0_00' }
    const accent = meta.color || profileAccent
    const num = meta.num || '0_00'
    const isPressed = pressedId === id
    const isYellow = ['#fff308','#ffcc00','#fff1d4','#CDA24D'].includes(accent.toLowerCase())
    const textColor = active? (isYellow? '#111' : '#fff') : '#121212'
    const triangleColor = active? (isYellow? '#111' : '#fff') : accent

    return (
      <button
        onMouseDown={() => setPressedId(id)}
        onMouseUp={() => setPressedId(null)}
        onMouseLeave={() => setPressedId(null)}
        onTouchStart={() => setPressedId(id)}
        onTouchEnd={() => setPressedId(null)}
                onMouseEnter={() => { const idx = flatItems.findIndex((f: any) => f.id === id && f.type === 'item'); if (idx!== -1) setSelectedIdx(idx) }}
        onClick={() => { console.log('[MENU] click', id); setPage(id as any); if (isControlled) { onClose?.() } else { setInternalOpen(false) } }}
        className="group relative w-full text-left outline-none select-none"
        style={{
          transform: isPressed? 'scale(0.97) translateY(2px)' : focused? 'scale(1.02) translateY(-1px)' : 'scale(1) translateY(0)',
          transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1), filter 200ms ease',
        }}
      >
        <div
          className="relative rounded-[22px] p-[5px] transition-all duration-200"
          style={{
            backgroundColor: active? accent : '#1A1A1A',
            borderRadius: 22,
            boxShadow: active
              ? `0 7px 0 ${darken(accent,0.28)}, 0 0 0 1px ${darken(accent,0.15)}, 0 18px 30px rgba(0,0,0,0.18), 0 0 24px ${accent}80`
              : '0 7px 0 #1A1A1A, 0 12px 22px rgba(0,0,0,0.18)',
            transform: active? 'translateY(-1px) scale(1.015)' : undefined,
          }}
        >
          <div
            className="relative flex items-center justify-between min-h-[58px] px-[16px] py-[13px] rounded-[16px] transition-all duration-200"
            style={{
              backgroundColor: active? accent : '#FEFEFE',
              borderRadius: 16,
              boxShadow: active
                ? 'inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -2px 6px rgba(0,0,0,0.16), inset 0 1px 1px rgba(255,255,255,0.9)'
                : 'inset 0 2px 0 rgba(255,255,255,1), inset 0 -3px 5px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center gap-[12px]">
              <div
                className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: triangleColor,
                  clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                  filter: active? 'drop-shadow(0 1px 0 rgba(0,0,0,0.15))' : `drop-shadow(0 1px 0 ${accent}66)`,
                  transform: active? 'translateX(1px)' : undefined,
                }}
              />
              <span
                className="text-[13px] font-black tracking-[0.08em] uppercase leading-none"
                style={{
                  color: textColor,
                  textShadow: active? (isYellow? '0 1px 0 rgba(255,255,255,0.6)' : '0 1px 0 rgba(0,0,0,0.18)') : '0 1px 0 rgba(255,255,255,0.9)',
                }}
              >
                {label}
              </span>
            </div>
            <div
              className="flex items-center rounded-full border px-[9px] h-[26px] shrink-0"
              style={{
                backgroundColor: active? (isYellow? '#111' : '#fff') : '#FFFFFF',
                borderColor: active? (isYellow? '#111' : '#fff') : '#111',
                borderWidth: 1.5,
                boxShadow: active? '0 1px 0 rgba(0,0,0,0.12)' : '0 1.5px 0 #111, inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
            >
              <span className="text-[11px] font-bold tracking-wide leading-none" style={{ color: active? (isYellow? '#fff' : '#111') : '#111' }}>
                <span className="opacity-40 font-medium mr-[1px]">{num.split('_')[0]}_</span>
                <span>{num.split('_')[1]}</span>
              </span>
            </div>
            {!active && (
              <div className="pointer-events-none absolute top-[3px] left-[10%] right-[10%] h-[6px] bg-white/70 blur-[2px] rounded-full opacity-60" />
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          if (!keyboardOpen) setSelectedIdx(-1)
        }}
        className="hidden md:flex w-[390px] flex-col fixed left-0 top-[56px] bottom-[42px] z-30 transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ transform: isMenuVisible? 'translateX(0)' : 'translateX(-90%)' }}
      >
        <div
          className="relative rounded-[32px] border-[5px] border-black p-[18px] pt-[20px] pb-[22px] h-full overflow-y-auto overflow-x-hidden"
          style={{
            backgroundColor: '#EFEFF2',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23A8A9AD' fill-opacity='0.22'%3E%3Crect x='0' y='0' width='2' height='2'/%3E%3C/g%3E%3C/svg%3E")`,
            boxShadow: '0 28px 60px rgba(0,0,0,0.22), 0 10px 0 #1A1A1A, inset 0 0 0 1px rgba(255,255,255,0.6)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[26px] shadow-[inset_0_2px_8px_rgba(255,255,255,0.9),inset_0_-6px_12px_rgba(0,0,0,0.06)]" />

          <div className="relative flex flex-col gap-[13px]">
            {currentStructure.map((node: any) =>
              node.type === 'item' ? (
                <ClayItem key={node.id} id={node.id} label={node.label} focused={getFocused(node.id, 'item')} />
              ) : (
                <div key={node.id} className="contents">
                  <div className="mt-[10px] mb-[-2px] px-[8px] flex items-center gap-2">
                    <div className="h-[1.5px] w-4 bg-black/20 rounded-full" />
                    <span className="text-[10.5px] font-black tracking-[0.32em] text-[#7A7B80] uppercase">{node.label}</span>
                    <div className="h-[1.5px] flex-1 bg-black/10 rounded-full" />
                  </div>
                  {(open as any)[node.id] && (
                    <div className="flex flex-col gap-[13px] mt-[6px]">
                      {node.children.map((child: any) => (
                        <ClayItem key={child.id} id={child.id} label={child.label} focused={getFocused(child.id, 'item')} />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div className="mt-[18px] flex justify-center gap-[8px] opacity-50">
            <div className="w-[28px] h-[8px] rounded-full bg-black/15 border border-black/10" />
            <div className="w-[28px] h-[8px] rounded-full bg-black/15 border border-black/10" />
            <div className="w-[28px] h-[8px] rounded-full bg-black/15 border border-black/10" />
          </div>

          <div className="mt-4 flex items-center justify-between px-2">
            <span className="text-[10px] font-bold tracking-widest text-black/40 border border-black/15 rounded-full px-2.5 py-1 bg-white/70">CLAY • PUFFY</span>
            <span className="text-[10px] font-bold tracking-widest text-black/50">PROFIL {activeProfile + 1}/4</span>
          </div>
        </div>

        {/* SEXY 10% peek – šipka pouze nahoře v kolečku, jen sipkkkkaa */}
        <button
          onClick={() => {
            setIsHovered(false)
            if (keyboardOpen) {
              if (onClose) onClose()
              else setInternalOpen(false)
            } else {
              if (isControlled) {
                onOpen?.()
              } else {
                setInternalOpen(true)
              }
            }
          }}
          style={{
            position: 'absolute',
            right: -18,
            top: 18,
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: '#ffffff',
            border: '3px solid #0a0a0a',
            boxShadow: '4px 4px 0px #0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 50,
          }}
          title={isMenuVisible? 'Zavřít menu' : 'Otevřít clay menu – 10% peek'}
        >
          <img
            src={sipkkkkaaImg}
            alt="toggle sipkkkkaa"
            style={{
              width: 22,
              height: 22,
              objectFit: 'contain',
              transform: isMenuVisible? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </button>
      </aside>

      {isMenuVisible && (
        <div
          className="hidden md:block fixed left-[390px] top-[56px] bottom-[42px] right-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={() => {
            if (onClose) onClose()
            else setInternalOpen(false)
          }}
        />
      )}
    </>
  )
}

export const Menu = memo(MenuComponent)
