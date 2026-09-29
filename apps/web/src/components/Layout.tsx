import { useReducer, useEffect, useCallback, useMemo } from 'react'
import Header from './Header'
import Bottom from './Bottom'
import { Menu } from './Menu'
import { useSaveStatus } from '../hooks/useSaveStatus'

import type { Page } from '../hooks/useAppState'

type LayoutProps = {
  children: any
  page: Page
  setPage: (id: Page) => void
  activeProfile: number
  setActiveProfile: (n: number) => void
  biosMode?: boolean
  setBiosMode?: (v: boolean) => void
  onOpenBuilderMenu?: () => void
}

const TAB_STEPS = [
  { id: 'bios-menu',    label: 'BIOS menu'        },
  { id: 'header-0',    label: 'Logo'              },
  { id: 'header-1',    label: 'Notifikace'        },
  { id: 'header-2',    label: 'Calendar'          },
  { id: 'header-3',    label: 'Tasks'             },
  { id: 'header-4',    label: 'Notes'             },
  { id: 'header-5',    label: 'Builder'           },
  { id: 'builder',     label: 'Builder panel'     },
  { id: 'bottom',      label: 'Bottom bar'        },
] as const

const HEADER_MAX = 5

type State = {
  biosMenuOpen: boolean
  biosMenuIdx: number
  headerFocus: number | null
  notifSubFocus: 0|1|2|null
  profileSubFocus: 0|1|2|3|null
  bottomFocus: boolean
  builderFocus: boolean
}

type Action =
  | { type: 'SET_BIOS_OPEN'; v: boolean }
  | { type: 'SET_BIOS_IDX'; v: number }
  | { type: 'FOCUS'; header?: number; notif?: 0|1|2|null; profile?: 0|1|2|3|null }
  | { type: 'TAB' }
  | { type: 'ESC' }
  | { type: 'CYCLE_PROFILE' }
  | { type: 'CYCLE_NOTIF' }
  | { type: 'SET_BUILDER'; v: boolean }
  | { type: 'SET_BOTTOM'; v: boolean }

const initialState: State = {
  biosMenuOpen: false,
  biosMenuIdx: 0,
  headerFocus: null,
  notifSubFocus: null,
  profileSubFocus: null,
  bottomFocus: false,
  builderFocus: false,
}

function layoutReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BIOS_OPEN': return { ...state, biosMenuOpen: action.v }
    case 'SET_BIOS_IDX': return { ...state, biosMenuIdx: action.v }
    case 'SET_BUILDER': return { ...state, builderFocus: action.v, headerFocus: null }
    case 'SET_BOTTOM': return { ...state, bottomFocus: action.v, headerFocus: null }
    case 'FOCUS':
      return {
        ...state,
        headerFocus: action.header ?? state.headerFocus,
        notifSubFocus: action.notif ?? null,
        profileSubFocus: action.profile ?? state.profileSubFocus,
        biosMenuOpen: false,
      }
    case 'CYCLE_PROFILE':
      if (state.headerFocus === 0) {
        const next = state.profileSubFocus=== null? 0 : (state.profileSubFocus+1)%4
        return { ...state, profileSubFocus: next as any }
      }
      return state
    case 'CYCLE_NOTIF':
      if (state.headerFocus === 1) {
        if (state.notifSubFocus=== null) return { ...state, notifSubFocus: 0 }
        if (state.notifSubFocus === 0) return { ...state, notifSubFocus: 1 }
        if (state.notifSubFocus === 1) return { ...state, notifSubFocus: 2 }
        if (state.notifSubFocus === 2) return { ...state, notifSubFocus: null, headerFocus: 2 }
      }
      return state
    case 'TAB':
      if (state.biosMenuOpen) {
        return { ...state, biosMenuIdx: (state.biosMenuIdx+1) % 10 }
      }
      if (state.headerFocus!== null) {
        if (state.headerFocus === 1 && state.notifSubFocus!== null) {
          if (state.notifSubFocus === 0) return { ...state, notifSubFocus: 1 }
          if (state.notifSubFocus === 1) return { ...state, notifSubFocus: 2 }
          if (state.notifSubFocus === 2) return { ...state, notifSubFocus: null, headerFocus: 2 }
        }
        if (state.headerFocus < HEADER_MAX) {
          return { ...state, headerFocus: state.headerFocus + 1, notifSubFocus: null }
        } else {
          return { ...state, headerFocus: null, builderFocus: true }
        }
      }
      if (state.builderFocus) {
        return { ...state, builderFocus: false, bottomFocus: true }
      }
      if (state.bottomFocus) {
        return { ...state, bottomFocus: false, biosMenuOpen: true, biosMenuIdx: 0 }
      }
      return state
    case 'ESC':
      return { ...state, biosMenuOpen: false, headerFocus: null, notifSubFocus: null, profileSubFocus: null, bottomFocus: false, builderFocus: false }
    default:
      return state
  }
}

function headerLinear(state: State): number {
  if (state.headerFocus === 0) return 0
  if (state.headerFocus === 1) {
    if (state.notifSubFocus === 0) return 1
    if (state.notifSubFocus === 1) return 2
    if (state.notifSubFocus === 2) return 3
    return 1
  }
  if (state.headerFocus === 2) return 4
  if (state.headerFocus === 3) return 5
  if (state.headerFocus === 4) return 6
  if (state.headerFocus === 5) return 7
  return -1
}

function linearToHeader(linear: number): { header: number; notif: 0|1|2|null } {
  const map = [
    { header: 0, notif: null },
    { header: 1, notif: 0 },
    { header: 1, notif: 1 },
    { header: 1, notif: 2 },
    { header: 2, notif: null },
    { header: 3, notif: null },
    { header: 4, notif: null },
    { header: 5, notif: null },
  ] as const
  const m = map[linear] ?? map[0]
  return { header: m.header, notif: m.notif as any }
}

export default function Layout({ children, page, setPage, activeProfile, setActiveProfile, biosMode = false, setBiosMode, onOpenBuilderMenu }: LayoutProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialState)
  const { status: saveStatus, onSaveClick } = useSaveStatus()
  const { biosMenuOpen, biosMenuIdx, headerFocus, notifSubFocus, profileSubFocus, bottomFocus, builderFocus } = state

  const handleSetBiosIdx = useCallback((n: number) => dispatch({ type: 'SET_BIOS_IDX', v: n }), [])
  const handleCloseBios = useCallback(() => dispatch({ type: 'SET_BIOS_OPEN', v: false }), [])
  const handleOpenBios = useCallback(() => dispatch({ type: 'SET_BIOS_OPEN', v: true }), [])
  const handleTabToHeader = useCallback(() => dispatch({ type: 'FOCUS', header: 0, profile: 0 }), [])

  useEffect(() => {
    if (builderFocus && onOpenBuilderMenu) onOpenBuilderMenu()
  }, [builderFocus, onOpenBuilderMenu])

  useEffect(() => {
    const isTyping = (t: HTMLElement | null) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const lower = e.key.toLowerCase()
      const code = (e as any).code as string

      if (isTyping(target) && !(e.shiftKey && code?.startsWith('Digit'))) {
        if (!e.shiftKey) return
      }

      if (e.shiftKey && (code === 'Digit1' || e.key === '1' || e.key === '!')) {
        e.preventDefault()
        const next = ((activeProfile ?? 0) + 1) % 4
        setActiveProfile(next)
        setPage('dashboard' as any)
        dispatch({ type: 'CYCLE_PROFILE' })
        return
      }
      if (e.shiftKey && (code === 'Digit2' || e.key === '2' || e.key === '@')) {
        e.preventDefault()
        dispatch({ type: 'CYCLE_NOTIF' })
        return
      }
      if (e.shiftKey && code === 'Digit3') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 2 }); return }
      if (e.shiftKey && code === 'Digit4') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 3 }); return }
      if (e.shiftKey && code === 'Digit5') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 4 }); return }
      if (e.shiftKey && code === 'Digit6') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 5 }); return }
      if (e.shiftKey && code === 'Digit7') { e.preventDefault(); dispatch({ type: 'SET_BUILDER', v: true }); return }
      if (e.shiftKey && code === 'Digit8') { e.preventDefault(); dispatch({ type: 'SET_BOTTOM', v: true }); return }

      if (e.shiftKey && e.key === '3') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 2 }); return }
      if (e.shiftKey && e.key === '4') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 3 }); return }
      if (e.shiftKey && e.key === '5') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 4 }); return }
      if (e.shiftKey && e.key === '6') { e.preventDefault(); dispatch({ type: 'FOCUS', header: 5 }); return }
      if (e.shiftKey && e.key === '7') { e.preventDefault(); dispatch({ type: 'SET_BUILDER', v: true }); return }
      if (e.shiftKey && e.key === '8') { e.preventDefault(); dispatch({ type: 'SET_BOTTOM', v: true }); return }

      if (!e.shiftKey && lower === 'm') {
        if (isTyping(target)) return
        e.preventDefault()
        dispatch({ type: 'SET_BOTTOM', v: true })
        return
      }

      if (e.key === 'Tab') {
        if (isTyping(target)) return
        e.preventDefault()
        dispatch({ type: 'TAB' })
        return
      }

      if (e.key === 'Escape') {
        dispatch({ type: 'ESC' })
        return
      }

      if (e.key === 'Enter') {
        if (builderFocus && onOpenBuilderMenu) { e.preventDefault(); onOpenBuilderMenu() }
        return
      }

      if (headerFocus !== null && !isTyping(target)) {
        if (lower === 'q' || lower === 'o') {
          e.preventDefault()
          const cur = headerLinear(state)
          const prev = (cur - 1 + 8) % 8
          const { header, notif } = linearToHeader(prev)
          dispatch({ type: 'FOCUS', header, notif, profile: header === 0 ? (state.profileSubFocus ?? 0) : undefined })
          return
        }
        if (lower === 'a' || lower === 'p') {
          e.preventDefault()
          const cur = headerLinear(state)
          const next = (cur + 1) % 8
          const { header, notif } = linearToHeader(next)
          dispatch({ type: 'FOCUS', header, notif, profile: header === 0 ? (state.profileSubFocus ?? 0) : undefined })
          return
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state, headerFocus, bottomFocus, builderFocus, onOpenBuilderMenu, activeProfile, setActiveProfile, setPage])

  const memoHeader = useMemo(() => (
    <Header
      currentPage={page}
      focusedIdx={headerFocus}
      notifSubFocus={notifSubFocus}
      profileSubFocus={profileSubFocus}
      activeProfile={activeProfile}
      setActiveProfile={setActiveProfile}
      setPage={setPage}
      biosMode={biosMode}
      setBiosMode={setBiosMode}
      onOpenBuilderMenu={onOpenBuilderMenu}
      saveStatus={saveStatus}
      onSaveClick={onSaveClick || undefined}
    />
  ), [page, headerFocus, notifSubFocus, profileSubFocus, activeProfile, biosMode, setBiosMode, onOpenBuilderMenu, saveStatus, onSaveClick])

  return (
    <div
      className="relative h-screen w-screen flex flex-col overflow-hidden overscroll-none transition-colors duration-150"
      style={{ background: biosMode? '#040b8d' : '#cccccc' }}
    >
      <div className="relative z-10 h-full w-full flex flex-col overflow-hidden">
        {memoHeader}
        <div className="flex flex-1 min-h-0 overflow-hidden overscroll-contain">
          <Menu
            page={page}
            setPage={setPage}
            activeProfile={activeProfile}
            forcedOpen={biosMenuOpen}
            forcedIdx={biosMenuIdx}
            onForcedIdxChange={handleSetBiosIdx}
            onClose={handleCloseBios}
            onOpen={handleOpenBios}
            onTabToHeader={handleTabToHeader}
          />
          <main
            className="flex-1 w-full overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain transition-all duration-300 pb-"
            style={{
              background: biosMode? 'rgba(4,11,141,0.8)' : 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(0.3px)',
            }}
          >
            <div className="min-h-full w-full pb-">{children}</div>
          </main>
        </div>
        <Bottom />
      </div>
    </div>
  )
}
