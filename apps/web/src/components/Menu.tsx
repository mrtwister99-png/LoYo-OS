import { useState, useEffect, useMemo } from 'react'
import sipkaImg from '../images/sipka.png'
import sipka2Img from '../images/sipka2.png'
import type { Page } from '../hooks/useAppState'


type Props = {
  page: Page
  setPage: (id: Page) => void
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
      // PROJEKTY smazán v3.0 - viz ARCHITECTURE.md
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

export function Menu({ page, setPage, forcedOpen, forcedIdx, onForcedIdxChange, onClose, onTabToHeader }: Props) {
  const [open, setOpen] = useState({ firma: true, config: true })
  const [isHovered, setIsHovered] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalIdx, setInternalIdx] = useState(0)

  const isControlled = forcedOpen!== undefined
  const keyboardOpen = isControlled? forcedOpen! : internalOpen
  const selectedIdx = isControlled? (forcedIdx?? 0) : internalIdx

  useEffect(() => {
    if (isControlled &&!forcedOpen) {
      setIsHovered(false)
    }
  }, [forcedOpen, isControlled])

  const setSelectedIdx = (fn: any) => {
    if (isControlled && onForcedIdxChange) {
      if (typeof fn === 'function') {
        const next = fn(forcedIdx?? 0)
        onForcedIdxChange(next)
      } else {
        onForcedIdxChange(fn)
      }
    } else {
      setInternalIdx(fn)
    }
  }

  const flatItems = useMemo(() => {
    const list: any[] = []
    for (const node of MENU_STRUCTURE) {
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
  }, [open])

  useEffect(() => {
    if (selectedIdx >= flatItems.length) {
      setSelectedIdx(Math.max(0, flatItems.length - 1))
    }
  }, [flatItems, selectedIdx])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (!keyboardOpen) return
      if (k === 'q' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev: number) => (prev - 1 + flatItems.length) % flatItems.length)
      } else if (k === 'a' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev: number) => (prev + 1) % flatItems.length)
      } else if (k === 'o' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (onClose) onClose()
        else setInternalOpen(false)
      } else if (k === 'p' || e.key === 'ArrowRight') {
        e.preventDefault()
        const cur = flatItems[selectedIdx]
        if (!cur) return
        if (cur.type === 'group') {
          setOpen(s => ({...s, [cur.id]:!(s as any)[cur.id] }))
        } else {
          setPage(cur.id)
        }
      } else if (k === 'enter') {
        e.preventDefault()
        const cur = flatItems[selectedIdx]
        if (!cur) return
        if (cur.type === 'group') {
          setOpen(s => ({...s, [cur.id]:!(s as any)[cur.id] }))
        } else {
          setPage(cur.id)
        }
      } else if (k === 'escape') {
        e.preventDefault()
        if (onClose) onClose()
        else setInternalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [keyboardOpen, flatItems, selectedIdx, setPage, onClose])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('aside')) {
        setSelectedIdx(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isMenuVisible = isHovered || keyboardOpen

  const Item = ({ id, label, focused }: any) => {
    const active = page === id
    return (
      <button
        onClick={() => setPage(id)}
        onMouseEnter={() => {
          const idx = flatItems.findIndex((f: any) => f.id === id && f.type === 'item')
          if (idx!== -1) setSelectedIdx(idx)
        }}
        onMouseLeave={() => {
          if (!keyboardOpen) setSelectedIdx(-1)
        }}
           className={`w-full text-left px-6 py-[14px] text-[12px] tracking-[0.2em] font-bold border-b flex justify-between items-center transition-all duration-150 ease-out ${
          focused? 'bg-[#ac0001] text-white border-white/30 shadow-[inset_0_0_0_1px_white]' :
          active? 'bg-[#ac0001] text-white border-white/20' :
          'bg-[#040b8d] text-white hover:bg-[#040b8d]/80 border-white/10'
        }`}
      >
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span className={`transition-opacity duration-150 ${isMenuVisible? 'opacity-100' : 'opacity-0'}`}>{active? '●' : ''}</span>
        </span>
      </button>
    )
  }

  const Group = ({ id, label, children, focused }: any) => {
    const isOpen = (open as any)[id]
    return (
      <div className="border-b border-white/10">
        <button
          onClick={() => setOpen(s => ({...s, [id]:!(s as any)[id] }))}
          onMouseEnter={() => {
            const idx = flatItems.findIndex((f: any) => f.id === id && f.type === 'group')
            if (idx!== -1) setSelectedIdx(idx)
          }}
          onMouseLeave={() => {
            if (!keyboardOpen) setSelectedIdx(-1)
          }}
          className={`w-full flex justify-between items-center px-6 py-3 text-[12px] tracking-[0.3em] font-black transition-all duration-150 ease-out hover:bg-[#cccccc]/80 ${
            focused? 'bg-[#ac0001] text-white shadow-[inset_0_0_0_1px_white]' : 'bg-[#cccccc] text-black hover:bg-[#ac0001]/20'
          }`}
        >
          <span>{label}</span>
          <span className="flex items-center justify-center w-[20px] h-[20px] rounded-full bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.6)]">
            <img 
              src={sipkaImg} 
              alt="sipka" 
              className={`w-[12px] h-[12px] object-contain transition-transform duration-200 ${isOpen? 'rotate-90' : 'rotate-0'}`}
              style={{ imageRendering: 'pixelated', filter: 'brightness(0) saturate(100%)' }}
            />
          </span>
        </button>
        {isOpen && <div className="bg-[#040b8d]">{children}</div>}
      </div>
    )
  }

  const getFocused = (id: string, type: 'item' | 'group') => {
    if (selectedIdx < 0) return false
    const cur = flatItems[selectedIdx]
    return cur && cur.id === id && cur.type === type
  }

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          if (!keyboardOpen) setSelectedIdx(-1)
        }}
                className="hidden md:flex w-[280px] bg-[#040b8d] flex-col fixed left-0 top-[56px] bottom-[42px] z-30 shadow-[4px_0_24px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] border-r border-white/10"
        style={{ transform: isMenuVisible? 'translateX(0)' : 'translateX(-90%)' }}
      >
        {/* 10% viditelný proužek s 2 ŠIPKAMI - klik VŽDY zavře/sbalí menu */}
        <div
                    onClick={() => {
            setIsHovered(false)
            if (onClose) onClose()
            else setInternalOpen(false)
          }}
          className="absolute right-0 top-0 bottom-0 w-[25px] bg-[#CDA24D] flex flex-col items-center justify-between py-4 border-l border-white/10 cursor-pointer"
        >
          <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white shadow-[0_0_6px_rgba(0,87,247,0.7)]">
            <img 
              src={isMenuVisible? sipka2Img : sipkaImg} 
              alt="toggle top" 
              className="w-[11px] h-[11px] object-contain transition-all duration-200"
              style={{ imageRendering: 'pixelated', filter: 'brightness(0) saturate(100%)' }}
            />
          </span>
          <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white shadow-[0_0_6px_rgba(0,87,247,0.7)]">
            <img 
              src={isMenuVisible? sipka2Img : sipkaImg} 
              alt="toggle bottom" 
              className="w-[11px] h-[11px] object-contain transition-all duration-200"
              style={{ imageRendering: 'pixelated', filter: 'brightness(0) saturate(100%)' }}
            />
          </span>
        </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden pr-">
          {MENU_STRUCTURE.map((node) =>
            node.type === 'item' ? (
              <Item key={node.id} id={node.id} label={node.label} focused={getFocused(node.id, 'item')} />
            ) : (
              <Group key={node.id} id={node.id} label={node.label} focused={getFocused(node.id, 'group')}>
                {node.children.map((child) => (
                  <Item key={child.id} id={child.id} label={child.label} focused={getFocused(child.id, 'item')} />
                ))}
              </Group>
            )
          )}
        </div>
      </aside>

            <aside className="md:hidden w-full bg-black flex flex-col border-b border-white/10">
        <div className="flex-1 overflow-y-auto">
          <div className="text- tracking-[0.4em] text-white/50 px-6 py-3 font-bold bg-black">MENU</div>
          {MENU_STRUCTURE.map((node) =>
            node.type === 'item' ? (
              <Item key={node.id} id={node.id} label={node.label} focused={false} />
            ) : (
              <Group key={node.id} id={node.id} label={node.label} focused={false}>
                {node.children.map((child) => (
                  <Item key={child.id} id={child.id} label={child.label} focused={false} />
                ))}
              </Group>
            )
          )}
        </div>
      </aside>
    </>
  )
}
