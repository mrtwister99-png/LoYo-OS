// D:\dev\loyo-os\apps\web\src\components\Layout.tsx
import { useState, useEffect } from 'react'
import Header from './Header'
import Bottom from './Bottom'
import Mobil from './Mobil'
import { Menu } from './Menu'

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

// Tab sekvence
// Pořadí: BIOS → Logo → Notif(3.1 nové / 3.2 nutné / 3.3 schválení) → Chat → Čas → Datum → Aktivita → Builder → Mobil
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

// Header fokus: 0=logo, 1=notif-new, 2=notif-urgent, 3=notif-approval, 4=chat, 5=čas, 6=datum, 7=aktivita
const HEADER_MAX = 7

export default function Layout({ children, page, setPage, biosMode = false, setBiosMode, onOpenBuilderMenu, onOpenMobil }: LayoutProps) {
  const [telefonOpen, setTelefonOpen]   = useState(false)

  // prázdný blok — onOpenMobil je prop pro Header, Header si ho zavolá sám
  const [biosMenuOpen, setBiosMenuOpen] = useState(false)
  const [biosMenuIdx, setBiosMenuIdx]   = useState(0)
  const [headerFocus, setHeaderFocus]   = useState<number | null>(null)
  const [bottomFocus, setBottomFocus]   = useState(false)
  const [builderFocus, setBuilderFocus] = useState(false)
  // notif sub-fokus: 0=nové, 1=nutné, 2=schválení (null = žádný)
  const [notifSubFocus, setNotifSubFocus] = useState<0 | 1 | 2 | null>(null)

  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()

      if (!biosMenuOpen && headerFocus === null && !bottomFocus && !builderFocus) {
        // Start: BIOS menu
        setBiosMenuOpen(true)
        setBiosMenuIdx(0)
      } else if (biosMenuOpen) {
        // BIOS → Logo (header-0)
        setBiosMenuOpen(false)
        setHeaderFocus(0)
        setNotifSubFocus(null)
        setBottomFocus(false)
        setBuilderFocus(false)
      } else if (headerFocus !== null) {
        if (headerFocus === 0) {
          // Logo → rovnou notif 3.1 (přeskočíme headerFocus=1 jako mezikrok)
          setHeaderFocus(1)
          setNotifSubFocus(0)
        } else if (headerFocus === 1 && notifSubFocus === 0) {
          // 3.1 nové → 3.2 nutné
          setNotifSubFocus(1)
        } else if (headerFocus === 1 && notifSubFocus === 1) {
          // 3.2 nutné → 3.3 schválení
          setNotifSubFocus(2)
        } else if (headerFocus === 1 && notifSubFocus === 2) {
          // 3.3 schválení → Chat
          setNotifSubFocus(null)
          setHeaderFocus(2)
        } else if (headerFocus < HEADER_MAX) {
          setHeaderFocus(headerFocus + 1)
        } else {
          // Konec headeru → Builder
          setHeaderFocus(null)
          setBuilderFocus(true)
        }
      } else if (builderFocus) {
        setBuilderFocus(false)
        setBottomFocus(true)
      } else if (bottomFocus) {
        setBottomFocus(false)
        setBiosMenuOpen(true)
        setBiosMenuIdx(0)
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [biosMenuOpen, headerFocus, notifSubFocus, bottomFocus, builderFocus])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // ESC zavírá vše — vždy reset na výchozí stav
      setBiosMenuOpen(false)
      setHeaderFocus(null)
      setNotifSubFocus(null)
      setBottomFocus(false)
      setBuilderFocus(false)
      setTelefonOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Když Tab přeskočí na builder slot → automaticky otevře Builder
  useEffect(() => {
    if (builderFocus && onOpenBuilderMenu) {
      onOpenBuilderMenu()
    }
  }, [builderFocus])

  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if (bottomFocus) { e.preventDefault(); setTelefonOpen(v => !v) }
      if (builderFocus && onOpenBuilderMenu) { e.preventDefault(); onOpenBuilderMenu() }
    }
    window.addEventListener('keydown', handleEnter)
    return () => window.removeEventListener('keydown', handleEnter)
  }, [bottomFocus, builderFocus])

  return (
    <div
      className="relative h-screen w-screen flex flex-col overflow-hidden overscroll-none transition-colors duration-150"
      style={{ background: biosMode ? '#040b8d' : '#ededed' }}
    >
      <div className="relative z-10 h-screen w-screen flex flex-col overflow-hidden">
        <Header
          currentPage={page}
          focusedIdx={headerFocus}
          notifSubFocus={notifSubFocus}
          biosMode={biosMode}
          setBiosMode={setBiosMode}
          onOpenBuilderMenu={onOpenBuilderMenu}
          onOpenMobil={onOpenMobil}
        />
        <div className="flex flex-1 min-h-0 overflow-hidden overscroll-contain">
          <Menu
            page={page}
            setPage={setPage}
            forcedOpen={biosMenuOpen}
            forcedIdx={biosMenuIdx}
            onForcedIdxChange={setBiosMenuIdx}
            onClose={() => setBiosMenuOpen(false)}
            onTabToHeader={() => { setBiosMenuOpen(false); setHeaderFocus(0) }}
          />
          <main
            className="flex-1 w-full overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain transition-all duration-300"
            style={{
              background: biosMode ? 'rgba(4,11,141,0.8)' : 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(0.3px)',
            }}
          >
            <div className="min-h-full w-full">{children}</div>
          </main>
        </div>
        {/* Bottom bez focused — prop zatím neexistuje */}
        <Bottom />
        <Mobil open={telefonOpen} setOpen={setTelefonOpen} focused={bottomFocus} />
      </div>
    </div>
  )
}
