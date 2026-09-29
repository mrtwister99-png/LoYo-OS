import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import sipkkkkaaImg from '../images/sipkkkkaa.png'
import type { Page } from '../hooks/useAppState'
import { categoryColors, categoryNumbers, categoryGradients } from '../styles/theme'
import { MENU_STRUCTURE_P2, MENU_META_P2 } from '../pages/profile2/MenuP2'
import { MENU_STRUCTURE_P3, MENU_META_P3 } from '../pages/profile3/MenuP3'
import { MENU_STRUCTURE_P4, MENU_META_P4 } from '../pages/profile4/MenuP4'

const MENU_META: Record<string, { color: string; num: string; gradient?: string }> = {
  dashboard: { color: categoryColors.dashboard, num: '0_01' },
  kalendar: { color: categoryColors.calendar, num: '0_02', gradient: categoryGradients.calendar },
  activity: { color: categoryColors.activity, num: '0_03', gradient: categoryGradients.activity },
  notes: { color: categoryColors.notes, num: '0_04', gradient: categoryGradients.notes },
  tasks: { color: categoryColors.tasks, num: '0_05', gradient: categoryGradients.tasks },
  tym: { color: categoryColors.teams, num: '7_01' },
  agenti: { color: categoryColors.agents, num: '1_01' },
  skills: { color: categoryColors.skills, num: '3_01' },
  mcp: { color: categoryColors.mcp, num: '2_01' },
  loops: { color: categoryColors.loops, num: '6_01' },
  workflows: { color: categoryColors.workflows, num: '8_01' },
  cli: { color: categoryColors.cli, num: '4_01' },
}

type Props = {
  page: Page
  setPage: (id: Page) => void
  activeProfile: number
  forcedOpen?: boolean
  forcedIdx?: number
  onForcedIdxChange?: (n: number) => void
  onClose?: () => void
  onTabToHeader?: () => void
}

type MenuNode =
  | { type: 'item'; id: string; label: string }
  | { type: 'group'; id: string; label: string; children: { id: string; label: string }[] }

const MENU_STRUCTURE: MenuNode[] = [
  { type: 'item', id: 'dashboard', label: 'DASHBOARD' },
  { type: 'item', id: 'kalendar', label: 'KALENDÁŘ' },
  { type: 'item', id: 'activity', label: 'ACTIVITY' },
  { type: 'item', id: 'notes', label: 'NOTES' },
  { type: 'item', id: 'tasks', label: 'TASKS' },
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

function MenuComponent({ page, setPage, activeProfile, forcedOpen, forcedIdx, onForcedIdxChange, onClose, onTabToHeader }: Props) {
  const [open, setOpen] = useState({ firma: true, config: true, jobtools: true } as any)
  const [isHovered, setIsHovered] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalIdx, setInternalIdx] = useState(0)

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

  const Item = ({ id, label, focused }: any) => {
    const active = page === id
    const meta = (currentMeta as any)[id] || (MENU_META as any)[id] || { color: profileAccent, num: '0_00' }
    const [prefix, seq] = String(meta.num || '0_00').split('_')
    const accent = meta.color || profileAccent
    return (
      <button
        onClick={() => setPage(id as any)}
        onMouseEnter={() => { const idx = flatItems.findIndex((f: any) => f.id === id && f.type === 'item'); if (idx!== -1) setSelectedIdx(idx) }}
        onMouseLeave={() => { if (!keyboardOpen) setSelectedIdx(-1) }}
        style={{
          width: '100%',
          textAlign: 'left',
          background: active? '#0a0a0a' : '#ffffff',
          color: active? '#ffffff' : '#0a0a0a',
          border: '3px solid #0a0a0a',
          borderTop: `6px solid ${accent}`,
          borderRadius: 14,
          padding: '12px 14px',
          fontWeight: 900,
          letterSpacing: '0.08em',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: focused? `6px 6px 0px ${accent}, 0 0 0 2px ${accent}` : '5px 5px 0px #0a0a0a',
          transform: focused? 'translate(-1px,-1px)' : 'translate(0,0)',
          transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
          outline: 'none',
          marginBottom: 10,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: 'ui-monospace', background: active? '#ffffff' : '#0a0a0a', color: active? '#0a0a0a' : '#ffffff', borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 900, display: 'flex' }}>
            <span style={{ opacity: 0.6 }}>{prefix}_</span>{seq}
          </span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: active? '#ffffff' : accent, opacity: active? 1 : 0.9, flexShrink: 0 }} />
      </button>
    )
  }

  const Group = ({ id, label, children, focused }: any) => {
    const isOpen = (open as any)[id]
    return (
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setOpen((s: any) => ({...s, [id]:!(s as any)[id] }))}
          onMouseEnter={() => {
            const idx = flatItems.findIndex((f: any) => f.id === id && f.type === 'group')
            if (idx!== -1) setSelectedIdx(idx)
          }}
          onMouseLeave={() => {
            if (!keyboardOpen) setSelectedIdx(-1)
          }}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0a0a0a',
            color: '#ffffff',
            border: '3px solid #0a0a0a',
            borderRadius: 14,
            padding: '12px 16px',
            fontSize: 11,
            letterSpacing: '0.18em',
            fontWeight: 900,
            boxShadow: focused? `5px 5px 0px ${profileAccent}` : '4px 4px 0px #0a0a0a',
            transform: focused? 'translate(-1px,-1px)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          <span>{label}</span>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={sipkkkkaaImg}
              alt="sipka group"
              style={{ width: 12, height: 12, objectFit: 'contain', transform: isOpen? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </span>
        </button>
        {isOpen && <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>{children}</div>}
      </div>
    )
  }

  const getFocused = useCallback((id: string, type: 'item' | 'group') => {
    if (selectedIdx < 0) return false
    const cur = flatItems[selectedIdx]
    return cur && cur.id === id && cur.type === type
  }, [selectedIdx, flatItems])

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          if (!keyboardOpen) setSelectedIdx(-1)
        }}
        className="hidden md:flex w- bg-[#f5f5f3] flex-col fixed left-0 top- bottom- z-30 shadow-[8px_0_0_#0a0a0a] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] border-r- border-[#0a0a0a]"
        style={{ transform: isMenuVisible? 'translateX(0)' : 'translateX(-90%)' }}
      >
        {/* SEXY MENU – jen 10% kouká, šipka sipkkkkaa pouze nahoře v kolečku */}
        <button
          onClick={() => {
            setIsHovered(false)
            if (keyboardOpen) {
              if (onClose) onClose()
              else setInternalOpen(false)
            } else {
              setInternalOpen(true)
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
          title={isMenuVisible? 'Zavřít menu' : 'Otevřít sexy menu – 10% peek'}
        >
          <img
            src={sipkkkkaaImg}
            alt="toggle sexy sipkkkkaa"
            style={{
              width: 22,
              height: 22,
              objectFit: 'contain',
              transform: isMenuVisible? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </button>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 pl-3 py-4">
          {currentStructure.map((node: any) =>
            node.type === 'item'? (
              <Item key={node.id} id={node.id} label={node.label} focused={getFocused(node.id, 'item')} />
            ) : (
              <Group key={node.id} id={node.id} label={node.label} focused={getFocused(node.id, 'group')}>
                {node.children.map((child: any) => (
                  <Item key={child.id} id={child.id} label={child.label} focused={getFocused(child.id, 'item')} />
                ))}
              </Group>
            )
          )}
        </div>

        <div style={{ padding: '8px 12px', borderTop: '3px solid #0a0a0a', background: profileAccent, color: profileAccent === '#CDA24D'? '#000' : '#fff', fontWeight: 900, fontSize: 10, letterSpacing: '0.15em', display: 'flex', justifyContent: 'space-between' }}>
          <span>PROFIL {activeProfile + 1}/4</span>
          <span>{['L OSOBNÍ','O DEV','Y JOB','O 3D'][activeProfile]}</span>
        </div>
      </aside>

      {isMenuVisible && (
        <div
          className="hidden md:block fixed left- top- bottom- right-0 z-20 bg-black/20 backdrop-blur-"
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