import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react'
import sipkkkkaaImg from '../images/sipkkkkaa.png'
import type { Page } from '../hooks/useAppState'
import { categoryColors, categoryNumbers, clay } from '../styles/theme'
import { MENU_STRUCTURE_P2, MENU_META_P2 } from '../pages/profile2/MenuP2'
import { MENU_STRUCTURE_P3, MENU_META_P3 } from '../pages/profile3/MenuP3'
import { MENU_STRUCTURE_P4, MENU_META_P4 } from '../pages/profile4/MenuP4'

const MENU_META: Record<string, { color: string; num: string }> = {
  dashboard: { color: categoryColors.dashboard, num: `0_${String(categoryNumbers.dashboard || 0).padStart(2,'0')}` },
  kalendar: { color: categoryColors.calendar, num: `0_02` },
  activity: { color: categoryColors.activity, num: `0_03` },
  notes: { color: categoryColors.notes, num: `0_04` },
  tasks: { color: categoryColors.tasks, num: `0_05` },
  agenti: { color: categoryColors.agents, num: `${categoryNumbers.agents}_01` },
  tym: { color: categoryColors.teams, num: `${categoryNumbers.teams}_01` },
  skills: { color: categoryColors.skills, num: `${categoryNumbers.skills}_01` },
  mcp: { color: categoryColors.mcp, num: `${categoryNumbers.mcp}_01` },
  cli: { color: categoryColors.cli, num: `${categoryNumbers.cli}_01` },
  loops: { color: categoryColors.loops, num: `${categoryNumbers.loops}_01` },
  workflows: { color: categoryColors.workflows, num: `${categoryNumbers.workflows}_01` },
  api: { color: categoryColors.api, num: `${categoryNumbers.api}_01` },
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

type ClayItemProps = {
  label: string
  active: boolean
  focused: boolean
  pressed: boolean
  accent: string
  num: string
  itemCount: number
  onPressStart: () => void
  onPressEnd: () => void
  onHover: () => void
  onActivate: () => void
}

function ClayItem({ label, active, focused, pressed, accent, num, itemCount, onPressStart, onPressEnd, onHover, onActivate }: ClayItemProps) {
  const catNum = num.split('_')[0]
  const catSuffix = num.split('_')[1] || '01'
  const isYellow = ['#fff308','#ffcc00','#fff1d4','#CDA24D'].includes(accent.toLowerCase())
  const textColor = active? (isYellow? '#111' : '#fff') : '#121212'
  const triangleColor = active? (isYellow? '#111' : '#fff') : accent

  return (
    <button
      onPointerDown={(e) => { e.preventDefault() }}
      onMouseDown={onPressStart}
      onMouseUp={onPressEnd}
      onMouseLeave={onPressEnd}
      onTouchStart={onPressStart}
      onTouchEnd={onPressEnd}
      onMouseEnter={onHover}
      onClick={onActivate}
      className="group relative w-full text-left outline-none select-none"
      style={{
        transform: pressed? 'scale(0.97) translateY(2px)' : focused? 'scale(1.02) translateY(-1px)' : 'scale(1) translateY(0)',
        transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <div
        className="relative transition-all duration-200"
        style={{
          padding: clay.outerPad,
          backgroundColor: active? accent : clay.ink,
          borderRadius: clay.radiusOuter,
          boxShadow: active
            ? `0 ${clay.depth}px 0 ${darken(accent,0.28)}, 0 0 0 1px ${darken(accent,0.15)}, 0 10px 18px rgba(0,0,0,0.18), 0 0 18px ${accent}80`
            : clay.shadowIdle,
          transform: active? 'translateY(-1px) scale(1.015)' : undefined,
        }}
      >
        <div
          className="relative flex items-center justify-between transition-all duration-200"
          style={{
            minHeight: clay.minH,
            padding: clay.innerPad,
            borderRadius: clay.radiusInner,
            backgroundColor: active? accent : clay.face,
            boxShadow: active? clay.insetActive : clay.insetIdle,
          }}
        >
          <div className="flex items-center" style={{ gap: 10 }}>
            <div
              className="shrink-0 transition-transform duration-200 group-hover:scale-110"
              style={{
                width: 10,
                height: 10,
                backgroundColor: triangleColor,
                clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                filter: active? 'drop-shadow(0 1px 0 rgba(0,0,0,0.15))' : `drop-shadow(0 1px 0 ${accent}66)`,
                transform: active? 'translateX(1px)' : undefined,
              }}
            />
            <span
              className="font-black uppercase leading-none"
              style={{
                fontSize: 12,
                letterSpacing: '0.08em',
                color: textColor,
                textShadow: active? (isYellow? '0 1px 0 rgba(255,255,255,0.6)' : '0 1px 0 rgba(0,0,0,0.18)') : '0 1px 0 rgba(255,255,255,0.9)',
              }}
            >{label}</span>
            {itemCount > 0 && (
              <span className="rounded-full font-black flex items-center justify-center" style={{ backgroundColor: '#6300c7', color: '#fff', minWidth: 16, height: 16, padding: '0 4px', fontSize: 10 }}>{itemCount}</span>
            )}
          </div>
          {itemCount === 0? (
            <div
              className="flex items-center rounded-full border shrink-0"
              style={{
                height: 22,
                padding: '0 8px',
                backgroundColor: active? (isYellow? '#111' : '#fff') : '#FFFFFF',
                borderColor: active? (isYellow? '#111' : '#fff') : '#111',
                borderWidth: 1.5,
                boxShadow: active? '0 1px 0 rgba(0,0,0,0.12)' : '0 1.5px 0 #111, inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
            >
              <span className="font-bold tracking-wide leading-none" style={{ fontSize: 11, color: active? (isYellow? '#fff' : '#111') : '#111' }}>
                <span className="font-medium opacity-40" style={{ marginRight: 1 }}>{catNum}_</span><span>{catSuffix}</span>
              </span>
            </div>
          ) : (
            <span className="font-black leading-none" style={{ fontSize: 11, color: active? (isYellow? '#111' : '#fff') : '#6300c7' }}>{catNum}</span>
          )}
          {!active && (
            <div
              className="pointer-events-none absolute opacity-60"
              style={{ top: 3, left: '10%', right: '10%', height: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.7)', filter: 'blur(2px)' }}
            />
          )}
        </div>
      </div>
    </button>
  )
}

function MenuComponent({ page, setPage, activeProfile, forcedOpen, forcedIdx, onForcedIdxChange, onClose, onOpen, onTabToHeader }: Props) {
  const [open, setOpen] = useState({ firma: true, config: true, jobtools: true } as any)
  const [isHovered, setIsHovered] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalIdx, setInternalIdx] = useState(0)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const [menuAnim, setMenuAnim] = useState<'in' | 'out' | null>(null)   // glitch při příchodu, pixelizace při odchodu
  const prevVisibleRef = useRef(false)
  const [counts, setCounts] = useState<Record<string, number>>({ notes: 8, tasks: 5, agenti: 15, tym: 1, mcp: 1, cli: 1, skills: 0, loops: 0, workflows: 0, api: 0, dashboard: 0, kalendar: 0, activity: 0 })

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

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('http://localhost:3001/api/capabilities')
        if (!r.ok) return
        const d = await r.json()
        const caps = d.capabilities || []
        const m: any = {}
        m.agenti = caps.filter((c:any) => c.type === 'agent').length
        m.tym = caps.filter((c:any) => c.type === 'team').length
        m.skills = caps.filter((c:any) => c.type === 'skill').length
        m.mcp = caps.filter((c:any) => c.type === 'mcp').length
        m.cli = caps.filter((c:any) => c.type === 'cli').length
        m.loops = caps.filter((c:any) => c.type === 'loop').length
        m.workflows = caps.filter((c:any) => c.type === 'workflow').length
        setCounts(prev => ({...prev,...m }))
      } catch {}
    }
    load()
  }, [])

  const setSelectedIdx = useCallback((n: number) => {
    if (isControlled) {
      onForcedIdxChange?.(n)
    } else {
      setInternalIdx(n)
    }
  }, [isControlled, onForcedIdxChange])

  const isMenuVisible = isHovered || keyboardOpen

  // spustí animaci při každé změně zobrazení menu
  useEffect(() => {
    if (prevVisibleRef.current === isMenuVisible) return
    prevVisibleRef.current = isMenuVisible
    setMenuAnim(isMenuVisible? 'in' : 'out')
    const t = window.setTimeout(() => setMenuAnim(null), isMenuVisible? 480 : 360)
    return () => window.clearTimeout(t)
  }, [isMenuVisible])

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

  const clayProps = (id: string, label: string) => {
    const meta = (currentMeta as any)[id] || (MENU_META as any)[id] || { color: profileAccent, num: '0_00' }
    return {
      label,
      active: page === id,
      focused: !!getFocused(id, 'item'),
      pressed: pressedId === id,
      accent: (meta.color || profileAccent) as string,
      num: (meta.num || '0_00') as string,
      itemCount: ((counts as any)[id] ?? 0) as number,
      onPressStart: () => setPressedId(id),
      onPressEnd: () => setPressedId(null),
      onHover: () => { const idx = flatItems.findIndex((f: any) => f.id === id && f.type === 'item'); if (idx!== -1) setSelectedIdx(idx) },
      onActivate: () => { setPage(id as any); setIsHovered(false); if (isControlled) { onClose?.() } else { setInternalOpen(false) } },
    }
  }

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          if (!keyboardOpen) setSelectedIdx(-1)
        }}
        className="hidden md:flex w-[300px] flex-col fixed left-0 top-[56px] bottom-[42px] z-30 transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{
          transform: isMenuVisible? 'translateX(0)' : 'translateX(-90%)',
          animation: menuAnim === 'in'? 'menuGlitchIn 460ms step-end' : menuAnim === 'out'? 'menuPixelOut 340ms step-end' : undefined,
        }}
      >
        <style>{`
          .clay-noscroll::-webkit-scrollbar { display: none; }
          /* PŘÍCHOD: glitch (RGB posun, řezy, cukání) */
          @keyframes menuGlitchIn {
            0%   { opacity: 0; clip-path: inset(0 -60px 100% -60px); translate: -18px 0; filter: none; }
            8%   { opacity: 1; clip-path: inset(8% -60px 62% -60px); translate: 12px 0; filter: drop-shadow(-5px 0 #ff0044) drop-shadow(5px 0 #00f2ff); }
            16%  { clip-path: inset(58% -60px 12% -60px); translate: -10px 0; filter: drop-shadow(6px 0 #ff0044) drop-shadow(-6px 0 #00f2ff); }
            24%  { clip-path: inset(-40px -60px -60px -60px); translate: 7px 0; filter: hue-rotate(70deg) saturate(2); }
            32%  { clip-path: inset(30% -60px 40% -60px); translate: -6px 0; filter: drop-shadow(-4px 0 #ff0044) drop-shadow(4px 0 #00f2ff); }
            40%  { clip-path: inset(-40px -60px -60px -60px); translate: 4px 0; filter: none; }
            52%  { translate: -3px 0; filter: drop-shadow(3px 0 #ff0044) drop-shadow(-3px 0 #00f2ff); }
            64%  { translate: 2px 0; filter: none; }
            76%  { translate: 0 0; filter: hue-rotate(25deg); }
            88%  { filter: none; }
            100% { opacity: 1; clip-path: inset(-40px -60px -60px -60px); translate: 0 0; filter: none; }
          }
          /* ODCHOD: pixelizace po krocích (+ posun doleva řeší transform) */
          @keyframes menuPixelOut {
            0%   { filter: none; }
            15%  { filter: url(#clayPx4); }
            32%  { filter: url(#clayPx8); }
            50%  { filter: url(#clayPx14); }
            72%  { filter: url(#clayPx22); }
            100% { filter: url(#clayPx22); }
          }
        `}</style>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <filter id="clayPx4" x="0" y="0" width="100%" height="100%"><feFlood x="1" y="1" width="2" height="2" /><feComposite width="4" height="4" /><feTile result="a" /><feComposite in="SourceGraphic" in2="a" operator="in" /><feMorphology operator="dilate" radius="2" /></filter>
          <filter id="clayPx8" x="0" y="0" width="100%" height="100%"><feFlood x="3" y="3" width="2" height="2" /><feComposite width="8" height="8" /><feTile result="a" /><feComposite in="SourceGraphic" in2="a" operator="in" /><feMorphology operator="dilate" radius="4" /></filter>
          <filter id="clayPx14" x="0" y="0" width="100%" height="100%"><feFlood x="6" y="6" width="2" height="2" /><feComposite width="14" height="14" /><feTile result="a" /><feComposite in="SourceGraphic" in2="a" operator="in" /><feMorphology operator="dilate" radius="7" /></filter>
          <filter id="clayPx22" x="0" y="0" width="100%" height="100%"><feFlood x="10" y="10" width="2" height="2" /><feComposite width="22" height="22" /><feTile result="a" /><feComposite in="SourceGraphic" in2="a" operator="in" /><feMorphology operator="dilate" radius="11" /></filter>
        </svg>
        <div
          className="relative rounded-[32px] border-[5px] border-black p-[14px] pt-[16px] pb-[18px] h-full overflow-y-auto overflow-x-hidden clay-noscroll"
          style={{
            backgroundColor: clay.panelBg,
            backgroundImage: clay.pattern,
            boxShadow: '10px 10px 0 #1A1A1A, 16px 22px 36px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.6)',   // stín doprava dolů
            scrollbarWidth: 'none',
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[26px] shadow-[inset_0_2px_8px_rgba(255,255,255,0.9),inset_0_-6px_12px_rgba(0,0,0,0.06)]" />

          <div className="relative flex flex-col gap-[8px]">
            {currentStructure.map((node: any) =>
              node.type === 'item' ? (
                <ClayItem key={node.id} {...clayProps(node.id, node.label)} />
              ) : (
                <div key={node.id} className="contents">
                  <div className="mt-[10px] mb-[-2px] px-[8px] flex items-center gap-2">
                    <div className="h-[1.5px] w-4 bg-black/20 rounded-full" />
                    <span className="text-[10.5px] font-black tracking-[0.32em] text-[#7A7B80] uppercase">{node.label}</span>
                    <div className="h-[1.5px] flex-1 bg-black/10 rounded-full" />
                  </div>
                  {(open as any)[node.id] && (
                    <div className="flex flex-col gap-[8px] mt-[4px]">
                      {node.children.map((child: any) => (
                        <ClayItem key={child.id} {...clayProps(child.id, child.label)} />
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
          className="hidden md:block fixed left-[300px] top-[56px] bottom-[42px] right-0 z-20 bg-transparent"
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
