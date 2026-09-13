import { useReducer, useEffect, useCallback, useMemo } from 'react'
import Header from './Header'
import Bottom from './Bottom'
import Mobil from './Mobil'
import { Menu } from './Menu'
import { useSaveStatus } from '../hooks/useSaveStatus'

import type { Page } from '../hooks/useAppState'

type LayoutProps = {
  children: any
  page: Page
  setPage: (id: Page) => void
  biosMode?: boolean
  setBiosMode?: (v: boolean) => void
  onOpenBuilderMenu?: () => void
  onOpenMobil?: () => void
}

const TAB_STEPS = [
  { id: 'bios-menu',    label: 'BIOS menu'        },
  { id: 'header-0',    label: 'Logo/Profil'       },
  { id: 'header-1-1',  label: 'Notif: Nové'       },
  { id: 'header-1-2',  label: 'Notif: Nutné'      },
  { id: 'header-1-3',  label: 'Notif: Schválení'  },
  { id: 'header-2',    label: 'Chat'              },
  { id: 'header-3',    label: 'Čas'               },
  { id: 'header-4',    label: 'Datum'             },
  { id: 'header-5',    label: 'Aktivita'          },
  { id: 'builder',     label: 'Builder menu'      },
  { id: 'mobil',       label: 'Mobil'             },
] as const

const HEADER_MAX = 5

type State = {
  biosMenuOpen: boolean
  biosMenuIdx: number
  headerFocus: number | null
  notifSubFocus: 0 | 1 | 2 | null
  profileSubFocus: 0 | 1 | 2 | 3 | null
  bottomFocus: boolean
  builderFocus: boolean
  telefonOpen: boolean
}

type Action =
  | { type: 'SET_BIOS_OPEN'; v: boolean }
  | { type: 'SET_BIOS_IDX'; v: number }
  | { type: 'SET_HEADER'; v: number | null }
  | { type: 'SET_NOTIF'; v: 0 | 1 | 2 | null }
  | { type: 'SET_PROFILE'; v: 0 | 1 | 2 | 3 | null }
  | { type: 'SET_BOTTOM'; v: boolean }
  | { type: 'SET_BUILDER'; v: boolean }
  | { type: 'SET_TELEFON'; v: boolean }
  | { type: 'TOGGLE_TELEFON' }
  | { type: 'RESET_ALL' }
  | { type: 'CYCLE_PROFILE' }
  | { type: 'CYCLE_NOTIF' }
  | { type: 'FOCUS'; header: number | null; notif?: 0 | 1 | 2 | null; profile?: 0 | 1 | 2 | 3 | null; builder?: boolean; bottom?: boolean }
  | { type: 'TAB' }
  | { type: 'ESC' }
  | { type: 'ENTER' }

const initialState: State = {
  biosMenuOpen: false,
  biosMenuIdx: 0,
  headerFocus: null,
  notifSubFocus: null,
  profileSubFocus: null,
  bottomFocus: false,
  builderFocus: false,
  telefonOpen: false,
}

function layoutReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BIOS_OPEN': return { ...state, biosMenuOpen: action.v }
    case 'SET_BIOS_IDX': return { ...state, biosMenuIdx: action.v }
    case 'SET_HEADER': return { ...state, headerFocus: action.v, builderFocus: false, bottomFocus: false, biosMenuOpen: false }
    case 'SET_NOTIF': return { ...state, notifSubFocus: action.v }
    case 'SET_PROFILE': return { ...state, profileSubFocus: action.v }
    case 'SET_BOTTOM': return { ...state, bottomFocus: action.v, builderFocus: false, headerFocus: null, biosMenuOpen: false }
    case 'SET_BUILDER': return { ...state, builderFocus: action.v, bottomFocus: false, headerFocus: null, biosMenuOpen: false }
    case 'SET_TELEFON': return { ...state, telefonOpen: action.v }
    case 'TOGGLE_TELEFON': return { ...state, telefonOpen: !state.telefonOpen }
    case 'RESET_ALL':
      return { ...state, biosMenuOpen: false, headerFocus: null, notifSubFocus: null, profileSubFocus: null, bottomFocus: false, builderFocus: false, telefonOpen: false }
    case 'CYCLE_PROFILE': {
      const next = state.profileSubFocus === null ? 0 : (state.profileSubFocus + 1) % 4 as 0 | 1 | 2 | 3
      return { ...state, profileSubFocus: next, headerFocus: 0, notifSubFocus: null, biosMenuOpen: false, builderFocus: false, bottomFocus: false }
    }
    case 'CYCLE_NOTIF': {
      const next = state.notifSubFocus === null ? 0 : (state.notifSubFocus + 1) % 3 as 0 | 1 | 2
      return { ...state, notifSubFocus: next, headerFocus: 1, biosMenuOpen: false, builderFocus: false, bottomFocus: false }
    }
    case 'FOCUS': {
      return {
        ...state,
        headerFocus: action.header,
        notifSubFocus: action.notif ?? (action.header === 1 ? state.notifSubFocus : null),
        profileSubFocus: action.profile ?? (action.header === 0 ? (state.profileSubFocus ?? 0) : state.profileSubFocus),
        builderFocus: action.builder ?? false,
        bottomFocus: action.bottom ?? false,
        biosMenuOpen: false,
      }
    }
    case 'TAB': {
      if (!state.biosMenuOpen && state.headerFocus === null && !state.bottomFocus && !state.builderFocus) {
        return { ...state, biosMenuOpen: true, biosMenuIdx: 0 }
      }
      if (state.biosMenuOpen) {
        return { ...state, biosMenuOpen: false, headerFocus: 0, profileSubFocus: state.profileSubFocus ?? 0, notifSubFocus: null, bottomFocus: false, builderFocus: false }
      }
      if (state.headerFocus !== null) {
        if (state.headerFocus === 0) {
          return { ...state, headerFocus: 1, notifSubFocus: 0 }
        }
        if (state.headerFocus === 1) {
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
    }
    case 'ESC':
      return { ...state, biosMenuOpen: false, headerFocus: null, notifSubFocus: null, profileSubFocus: null, bottomFocus: false, builderFocus: false, telefonOpen: false }
    case 'ENTER':
      if (state.bottomFocus) return { ...state, telefonOpen: !state.telefonOpen }
      return state
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

export default function Layout({ children, page, setPage, biosMode = false, setBiosMode, onOpenBuilderMenu, onOpenMobil }: LayoutProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialState)
  const { status: saveStatus, onSaveClick } = useSaveStatus()
  const { biosMenuOpen, biosMenuIdx, headerFocus, notifSubFocus, profileSubFocus, bottomFocus, builderFocus, telefonOpen } = state

  const handleSetBiosIdx = useCallback((n: number) => dispatch({ type: 'SET_BIOS_IDX', v: n }), [])
  const handleCloseBios = useCallback(() => dispatch({ type: 'SET_BIOS_OPEN', v: false }), [])
  const handleTabToHeader = useCallback(() => dispatch({ type: 'FOCUS', header: 0, profile: 0 }), [])
  const setTelefonOpen = useCallback((v: boolean | ((prev:boolean)=>boolean)) => {
    if (typeof v === 'function') dispatch({ type: 'TOGGLE_TELEFON' })
    else dispatch({ type: 'SET_TELEFON', v })
  }, [])

  useEffect(() => {
    if (builderFocus && onOpenBuilderMenu) onOpenBuilderMenu()
  }, [builderFocus, onOpenBuilderMenu])

  useEffect(() => {
    const isTyping = (t: HTMLElement | null) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const lower = e.key.toLowerCase()
      const code = (e as any).code as string

      // Shift + 1..8 - vždy povolit i když píše? ne, blokujeme v inputu
      if (isTyping(target) && !(e.shiftKey && code?.startsWith('Digit'))) {
        // dovolíme shift+digit i v inputu? radši ne - uživatel chce psát
        if (!e.shiftKey) return
      }

      if (e.shiftKey && (code === 'Digit1' || e.key === '1' || e.key === '!')) {
        e.preventDefault()
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

      // fallback pro e.key když code není (CZ klávesnice)
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
        if (bottomFocus) { e.preventDefault(); dispatch({ type: 'TOGGLE_TELEFON' }) }
        if (builderFocus && onOpenBuilderMenu) { e.preventDefault(); onOpenBuilderMenu() }
        return
      }

      // Q/O = předchozí, A/P = další - jen když je fokus v headeru
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
  }, [state, headerFocus, bottomFocus, builderFocus, onOpenBuilderMenu])

  const memoHeader = useMemo(() => (
    <Header
      currentPage={page}
      focusedIdx={headerFocus}
      notifSubFocus={notifSubFocus}
      profileSubFocus={profileSubFocus}
      biosMode={biosMode}
      setBiosMode={setBiosMode}
      onOpenBuilderMenu={onOpenBuilderMenu}
      onOpenMobil={onOpenMobil}
      saveStatus={saveStatus}
      onSaveClick={onSaveClick || undefined}
    />
  ), [page, headerFocus, notifSubFocus, profileSubFocus, biosMode, setBiosMode, onOpenBuilderMenu, onOpenMobil, saveStatus, onSaveClick])

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
            forcedOpen={biosMenuOpen}
            forcedIdx={biosMenuIdx}
            onForcedIdxChange={handleSetBiosIdx}
            onClose={handleCloseBios}
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
        <Mobil open={telefonOpen} setOpen={setTelefonOpen} focused={bottomFocus} />
      </div>
    </div>
  )
}
