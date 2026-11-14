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
  if (activeProfile === 1) return { structure: MENU_STRUCTURE_P2 as any, meta: MENU_META_P2, accent: '#12a4ff' }
  if (activeProfile === 2) return { structure: MENU_STRUCTURE_P3 as any, meta: MENU_META_P3, accent: '#12a4ff' }
  if (activeProfile === 3) return { structure: MENU_STRUCTURE_P4 as any, meta: MENU_META_P4, accent: '#12a4ff' }
  return { structure: MENU_STRUCTURE, meta: MENU_META, accent: '#12a4ff' }
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
  idx: number
  onPressStart: () => void
  onPressEnd: () => void
  onHover: () => void
  onActivate: () => void
}

function ClayItem({ label, active, focused, pressed, accent, num, itemCount, idx, onPressStart, onPressEnd, onHover, onActivate }: ClayItemProps) {
  const catNum = num.split('_')[0]
  const catSuffix = num.split('_')[1] || '01'
  const isYellow = false // Royal Dark: akcent je vždy modrý #12a4ff
  const textColor = active? '#ffffff' : '#f0f0f0'
  const triangleColor = active? '#ffffff' : '#9a9a9a'

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
      className="menu-stagger group relative w-full text-left outline-none select-none"
      style={{
        ['--i' as any]: idx,   // pořadí položky pro kaskádu animace
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
            ? `0 ${clay.depth}px 0 ${darken(accent,0.35)}, 0 8px 18px rgba(0,0,0,0.35), 0 0 16px ${accent}40`
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
                filter: 'none',
                transform: active? 'translateX(1px)' : undefined,
              }}
            />
            <span
              className="font-black uppercase leading-none"
              style={{
                fontSize: 12,
                letterSpacing: '0.08em',
                color: textColor,
                textShadow: 'none',
              }}
            >{label}</span>
            {itemCount > 0 && (
              <span className="rounded-full font-black flex items-center justify-center" style={{ backgroundColor: '#444', color: '#f0f0f0', minWidth: 16, height: 16, padding: '0 4px', fontSize: 10 }}>{itemCount}</span>
            )}
          </div>
          {itemCount === 0? (
            <div
              className="flex items-center rounded-full border shrink-0"
              style={{
                height: 22,
                padding: '0 8px',
                backgroundColor: active? 'rgba(255,255,255,0.18)' : '#2b2b2b',
                borderColor: active? 'rgba(255,255,255,0.35)' : '#444',
                borderWidth: 1,
                boxShadow: 'none',
              }}
            >
              <span className="font-bold tracking-wide leading-none" style={{ fontSize: 11, color: active? '#f0f0f0' : '#9a9a9a' }}>
                <span className="font-medium opacity-40" style={{ marginRight: 1 }}>{catNum}_</span><span>{catSuffix}</span>
              </span>
            </div>
          ) : (
            <span className="font-black leading-none" style={{ fontSize: 11, color: active? '#f0f0f0' : '#9a9a9a' }}>{catNum}</span>
          )}
          {!active && (
            <div
              className="pointer-events-none absolute opacity-60"
              style={{ top: 3, left: '10%', right: '10%', height: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.04)', filter: 'blur(2px)' }}
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
  const [menuAnim, setMenuAnim] = useState<'in' | 'out' | null>(null)   // 'in' = kaskáda + přejezd světla, 'out' = náklon + sjetí
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
    const t = window.setTimeout(() => setMenuAnim(null), isMenuVisible? 900 : 520)   // musí být delší než nejdelší animace
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
      idx: Math.min(12, Math.max(0, flatItems.findIndex((f: any) => f.id === id))),   // max 12 = strop zpoždění kaskády
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
        data-anim={menuAnim ?? undefined}
        className="hidden md:flex w-[300px] flex-col fixed left-0 top-[56px] bottom-[42px] z-30"
        style={{
          transform: isMenuVisible? 'translateX(0)' : 'translateX(-90%)',
          // příchod: dlouhý expo-out dojezd, odchod: plynulý ease-in-out
          transition: isMenuVisible? 'transform 640ms cubic-bezier(0.16,1,0.3,1)' : 'transform 460ms cubic-bezier(0.65,0,0.35,1)',
          willChange: 'transform',
          animation: menuAnim === 'out'? 'menuNudgeOut 460ms cubic-bezier(0.4,0,0.2,1)' : undefined,
        }}
      >
        <style>{`
          .clay-noscroll::-webkit-scrollbar { display: none; }
          /* PŘÍCHOD: kaskáda položek s jemným přestřelením (overshoot) */
          @keyframes menuItemIn {
            from { opacity: 0; translate: -34px 0; scale: 0.94; }
            to   { opacity: 1; translate: 0 0; scale: 1; }
          }
          [data-anim='in'] .menu-stagger {
            animation: menuItemIn 520ms cubic-bezier(0.34,1.56,0.64,1) backwards;
            animation-delay: calc(var(--i) * 24ms + 90ms);
          }
          /* PŘÍCHOD: jednorázový světelný přejezd přes panel */
          .menu-sheen::after {
            content: ''; position: absolute; top: -10%; bottom: -10%; left: 0; width: 55%;
            background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0) 25%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 75%, transparent 100%);
            opacity: 0; translate: -130% 0;
          }
          [data-anim='in'] .menu-sheen::after { animation: menuSheen 820ms cubic-bezier(0.4,0,0.2,1) 160ms both; }
          @keyframes menuSheen {
            0%   { translate: -130% 0; opacity: 0; }
            20%  { opacity: 1; }
            80%  { opacity: 1; }
            100% { translate: 230% 0; opacity: 0; }
          }
          /* ODCHOD: krátké "nadechnutí" doprava a pak sjetí doleva (samotný posun řeší transition) */
          @keyframes menuNudgeOut {
            0%   { translate: 0 0; }
            20%  { translate: 16px 0; }
            100% { translate: 0 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-anim] .menu-stagger, [data-anim] .menu-sheen::after { animation: none !important; }
          }
        `}</style>
        <div
          className="relative rounded-[32px] border border-[#444] p-[14px] pt-[16px] pb-[18px] h-full overflow-y-auto overflow-x-hidden clay-noscroll"
          style={{
            backgroundColor: clay.panelBg,
            backgroundImage: clay.pattern,
            boxShadow: '0 18px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',   // měkká hloubka
            scrollbarWidth: 'none',
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[26px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" />

          <div className="relative flex flex-col gap-[8px]">
            {currentStructure.map((node: any) =>
              node.type === 'item' ? (
                <ClayItem key={node.id} {...clayProps(node.id, node.label)} />
              ) : (
                <div key={node.id} className="contents">
                  <div
                    className="menu-stagger mt-[10px] mb-[-2px] px-[8px] flex items-center gap-2"
                    style={{ ['--i' as any]: Math.min(12, Math.max(0, flatItems.findIndex((f: any) => f.id === node.id))) }}
                  >
                    <div className="h-px w-4 bg-[#444] rounded-full" />
                    <span className="text-[10.5px] font-black tracking-[0.32em] text-[#9a9a9a] uppercase">{node.label}</span>
                    <div className="h-px flex-1 bg-[#444] rounded-full" />
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
            <div className="w-[28px] h-[8px] rounded-full bg-black/15 border border-[#444]" />
            <div className="w-[28px] h-[8px] rounded-full bg-black/15 border border-[#444]" />
            <div className="w-[28px] h-[8px] rounded-full bg-black/15 border border-[#444]" />
          </div>

          <div className="mt-4 flex items-center justify-between px-2">
            <span className="text-[10px] font-bold tracking-widest text-[#c9a646] border border-[#c9a646]/40 rounded-full px-2.5 py-1 bg-[#2b2b2b]">ROYAL • DARK</span>
            <span className="text-[10px] font-bold tracking-widest text-[#9a9a9a]">PROFIL {activeProfile + 1}/4</span>
          </div>

          {/* jednorázový světelný přejezd při příchodu */}
          <div className="menu-sheen pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]" />
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
            background: '#3a3a3a',
            border: '1px solid #444',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
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
              transform: isMenuVisible? 'rotate(180deg)' : 'rotate(0deg)', filter: 'grayscale(1) brightness(1.8)',
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
