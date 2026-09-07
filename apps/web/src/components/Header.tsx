// D:\dev\loyo-os\apps\web\src\components\Header.tsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Chat from './Chat'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { Builder } from './Builder'

type Props = {
  currentPage?: string
  focusedIdx?: number | null
  notifSubFocus?: 0 | 1 | 2 | null
  biosMode?: boolean
  setBiosMode?: (v: boolean) => void
  onOpenBuilderMenu?: () => void
  onOpenMobil?: () => void
}

type TaskLite = { file_name: string; title: string; done: boolean }
const TASKS_DIR = 'D:/dev/loyo-os/data/ja/ukoly'

const toIso = (d: Date) => d.toISOString().slice(0, 10)
const dayLabel = (d: Date) =>
  d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
const monthYearLabel = (d: Date) =>
  d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })

// ── barvy ────────────────────────────────────────────────────
const C = {
  bg: '#ededed',
  headBg: '#949494',
  border: '#7a7a7a',
  blue: '#040b8d',
  red: '#ac0001',
  caramel: '#CDA24D',
  neonGreen: '#d9ff00',
  tileBg: '#d0d0d0',
  black: '#000000',
  darkGray: '#3a3a3a',

}

// ── profily ──────────────────────────────────────────────────
const PROFILES = [
  { letter: 'L', color: C.blue,      label: 'Osobní'   },
  { letter: 'O', color: C.red,       label: 'Pracovní' },
  { letter: 'Y', color: C.caramel,   label: 'Projekty' },
  { letter: 'O', color: C.neonGreen, label: 'Profil 4' },
]

// ── notif typy ───────────────────────────────────────────────
type NotifType = 'new' | 'urgent' | 'approval'

interface SchedulerNotification {
  id: string
  ts: string
  command: string
  message: string
  read: boolean
  type?: NotifType
}

function notifColor(type: NotifType | undefined) {
  if (type === 'urgent')   return C.caramel
  if (type === 'approval') return C.red
  return C.blue
}

function notifLabel(type: NotifType | undefined) {
  if (type === 'urgent')   return 'Nutné'
  if (type === 'approval') return 'Ke schválení'
  return 'Nové'
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)    return 'právě teď'
  if (diff < 3600)  return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return new Date(ts).toLocaleDateString('cs-CZ')
}

// ── kalendář ─────────────────────────────────────────────────
function buildMonthGrid(viewDate: Date): (Date | null)[] {
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

// ── activity event (lite) ────────────────────────────────────
interface ActivityEventLite {
  id: string
  ts: string
  agent: string
  type: string
  action: string
}

// BUILDER_ITEMS přesunuto do Builder.tsx

export default function Header({
  currentPage,
  focusedIdx,
  notifSubFocus,
  biosMode,
  setBiosMode,
  onOpenBuilderMenu,
  onOpenMobil,
}: Props) {
  const [time, setTime]                     = useState(new Date())
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)

  // profil
  const [profileIdx, setProfileIdx] = useState(0)

  // notifikace
  const [notifications, setNotifications] = useState<SchedulerNotification[]>([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [activeNotifIdx, setActiveNotifIdx] = useState(0)
  const [isNotifAnimating, setIsNotifAnimating] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  // filtrovaný panel — který typ je otevřený
  const [notifFilter, setNotifFilter] = useState<NotifType | null>(null)
  // animace +1 per typ
  const [notifBump, setNotifBump] = useState<Record<NotifType, boolean>>({ new: false, urgent: false, approval: false })
  const prevCounts = useRef<Record<NotifType, number>>({ new: 0, urgent: 0, approval: 0 })

  // chat – poslední zpráva
  const [lastChatMsg, setLastChatMsg] = useState<{ from: 'me' | 'mary'; text: string } | null>(null)

  // activity – poslední aktivita
  const [lastActivity, setLastActivity] = useState<ActivityEventLite | null>(null)

  // builder dropdown — řídí Builder.tsx interně
  const [showBuilderMenu, setShowBuilderMenu] = useState(false)

  // kalendář / den
  const [showCalendar, setShowCalendar]         = useState(false)
  const [showDayPanel, setShowDayPanel]         = useState(false)
  // animace zavírání panelů
  const [closingCalendar, setClosingCalendar]   = useState(false)
  const [closingDayPanel, setClosingDayPanel]   = useState(false)
  const [closingNotif, setClosingNotif]         = useState(false)
  const [closingBuilder, setClosingBuilder]     = useState(false)
  const [selectedDate, setSelectedDate]         = useState(new Date())
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())
  const [openTasks, setOpenTasks]               = useState<TaskLite[]>([])

  const dateBoxRef = useRef<HTMLDivElement>(null)
  const timeBoxRef = useRef<HTMLDivElement>(null)

  const { eventsForDate } = useCalendarEvents()

  // ── fetch notifikací ─────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifs()
    const i = setInterval(fetchNotifs, 15_000)
    return () => clearInterval(i)
  }, [fetchNotifs])

  // ── rotace notifikací — moderní single view s animací ───────
  useEffect(() => {
    if (notifications.length === 0) return
    const interval = setInterval(() => {
      setIsNotifAnimating(true)
      setTimeout(() => {
        setActiveNotifIdx(v => (v + 1) % 3)
        setIsNotifAnimating(false)
      }, 220)
    }, 3200)
    return () => clearInterval(interval)
  }, [notifications])

  // ── fetch poslední chat zprávy ────────────────────────────────
  const fetchLastChat = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/chat/history')
      if (!res.ok) return
      const data = await res.json()
      const msgs = data.messages || []
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1]
        setLastChatMsg({ from: last.from, text: last.text })
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchLastChat()
    const i = setInterval(fetchLastChat, 8_000)
    return () => clearInterval(i)
  }, [fetchLastChat])

  // ── fetch poslední aktivity ───────────────────────────────────
  const fetchLastActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=1')
      if (!res.ok) return
      const data = await res.json()
      const evs = data.events || []
      if (evs.length > 0) setLastActivity(evs[0])
    } catch {}
  }, [])

  useEffect(() => {
    fetchLastActivity()
    const i = setInterval(fetchLastActivity, 8_000)
    return () => clearInterval(i)
  }, [fetchLastActivity])

  // ── počty notifikací ─────────────────────────────────────────
  const newCount      = notifications.filter(n => !n.read && (!n.type || n.type === 'new')).length
  const urgentCount   = notifications.filter(n => !n.read && n.type === 'urgent').length
  const approvalCount = notifications.filter(n => !n.read && n.type === 'approval').length
  const unreadCount   = notifications.filter(n => !n.read).length

  // ── bump animace při nové notifikaci ─────────────────────────
  useEffect(() => {
    const checks: { type: NotifType; count: number }[] = [
      { type: 'new',      count: newCount      },
      { type: 'urgent',   count: urgentCount   },
      { type: 'approval', count: approvalCount },
    ]
    checks.forEach(({ type, count }) => {
      if (count > prevCounts.current[type]) {
        setNotifBump(prev => ({ ...prev, [type]: true }))
        setTimeout(() => setNotifBump(prev => ({ ...prev, [type]: false })), 700)
      }
      prevCounts.current[type] = count
    })
  }, [newCount, urgentCount, approvalCount])

  // ── čas ──────────────────────────────────────────────────────
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1_000)
    return () => clearInterval(i)
  }, [])

  // ── toast ─────────────────────────────────────────────────────
  const triggerSavedToast = () => {
    setShowSavedToast(true)
    window.setTimeout(() => setShowSavedToast(false), 2500)
  }

  // ── chat ──────────────────────────────────────────────────────
  const openChat   = () => setIsTerminalOpen(true)
  const closeChat  = () => setIsTerminalOpen(false)
  const toggleChat = () => { isTerminalOpen ? closeChat() : openChat() }

  // ── klávesnice ────────────────────────────────────────────────
    useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if (focusedIdx === 0) { e.preventDefault(); setProfileIdx(v => (v + 1) % PROFILES.length) }
      if (focusedIdx === 1) { e.preventDefault(); setShowNotifPanel(v => !v) }
      if (focusedIdx === 2) { e.preventDefault(); openChat() }
      if (focusedIdx === 3) { e.preventDefault(); setShowDayPanel(v => !v); setShowCalendar(false) }
      if (focusedIdx === 4) { e.preventDefault(); setShowCalendar(v => !v); setShowDayPanel(false) }
      if (focusedIdx === 5) { e.preventDefault(); fetchLastActivity() }
      if (focusedIdx === 6) { e.preventDefault(); setShowBuilderMenu(v => !v) }
    }
    window.addEventListener('keydown', handleEnter)
    return () => window.removeEventListener('keydown', handleEnter)
  }, [focusedIdx])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      if (e.key === 'Escape' && isTerminalOpen) { e.preventDefault(); closeChat(); return }
      if ((e.key === 'c' || e.key === 'C') && !isTyping) { e.preventDefault(); toggleChat() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isTerminalOpen])

  // ── zavření popoverů klikem mimo ─────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dateBoxRef.current  && !dateBoxRef.current.contains(e.target as Node)  && showCalendar)  closeCalendar()
      if (timeBoxRef.current  && !timeBoxRef.current.contains(e.target as Node)  && showDayPanel)  closeDayPanel()
      if (notifRef.current    && !notifRef.current.contains(e.target as Node)    && showNotifPanel) closeNotifPanel()
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [showCalendar, showDayPanel, showNotifPanel])

  // ── úkoly ─────────────────────────────────────────────────────
  const loadOpenTasks = async () => {
    const hasTauri = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
    if (!hasTauri) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<any[]>('list_tasks', { dir: TASKS_DIR })
      setOpenTasks((list || []).filter(t => !t.done).map(t => ({
        file_name: t.file_name,
        title: t.title,
        done: t.done,
      })))
    } catch {}
  }

  useEffect(() => { if (showDayPanel) loadOpenTasks() }, [showDayPanel])

  // ── animované zavírání panelů ─────────────────────────────────
  const closeCalendar = () => {
    setClosingCalendar(true)
    setTimeout(() => { setShowCalendar(false); setClosingCalendar(false) }, 280)
  }
  const closeDayPanel = () => {
    setClosingDayPanel(true)
    setTimeout(() => { setShowDayPanel(false); setClosingDayPanel(false) }, 280)
  }
  const closeNotifPanel = () => {
    setClosingNotif(true)
    setTimeout(() => { setShowNotifPanel(false); setNotifFilter(null); setClosingNotif(false) }, 280)
  }
  const closeBuilderPanel = () => {
    setClosingBuilder(true)
    setTimeout(() => { setShowBuilderMenu(false); setClosingBuilder(false) }, 280)
  }

  // ── mark read ─────────────────────────────────────────────────
  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  // ── helpers ───────────────────────────────────────────────────
  const isFocused = (idx: number) => focusedIdx === idx

  const monthGrid   = useMemo(() => buildMonthGrid(calendarViewDate), [calendarViewDate])
  const selectedIso = toIso(selectedDate)
  const dayEvents   = eventsForDate(selectedIso)

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(d)
  }

  const pickDate = (d: Date) => {
    setSelectedDate(d)
    setShowCalendar(false)
    setShowDayPanel(true)
  }

  const profile = PROFILES[profileIdx]

  const dateFormatted = (() => {
    const d  = time.getDate().toString().padStart(2, '0')
    const m  = (time.getMonth() + 1).toString().padStart(2, '0')
    const yy = time.getFullYear().toString().slice(2)
    return { d, m, yy }
  })()

   // ── sdílené styly sekce ───────────────────────────────────────
  const sectionBase = (idx: number, extraStyle?: React.CSSProperties): React.CSSProperties => ({
    background: isFocused(idx) ? 'rgba(0,0,0,0.12)' : 'transparent',
    borderRight: '1px solid rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    flexShrink: 0,
    position: 'relative',
    ...extraStyle,
  })

  // ── chat label ────────────────────────────────────────────────
  const chatLabel = (() => {
    if (!lastChatMsg) return 'Mary – sekretářka'
    const who = lastChatMsg.from === 'mary' ? 'Mary' : 'Já'
    return `${who}: ${lastChatMsg.text}`
  })()

  const hh = time.getHours().toString().padStart(2, '0')
  const mm = time.getMinutes().toString().padStart(2, '0')
  const ss = time.getSeconds().toString().padStart(2, '0')
  const colonBlinkOn = time.getSeconds() % 2 === 0

  return (
    <header
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'stretch',
        background: '#949494',
        borderBottom: '1px solid #6b6b6b',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        width: '100%',
        overflow: 'visible',
      }}
    >

      {/* ══════════════════════════════════════════════════════════
          1. LOGO + PROFIL — 10% (zkráceno, končí u žluté čárky)
      ══════════════════════════════════════════════════════════ */}
      <div style={{ ...sectionBase(0), width: '10%', padding: '0 10px', gap: 8 }}>
        {/* Logo čtverec */}
        <div
          onClick={() => setProfileIdx(v => (v + 1) % PROFILES.length)}
          onContextMenu={e => { e.preventDefault(); setBiosMode && setBiosMode(!biosMode) }}
          title={`Profil: ${profile.label} — klik = přepnout | pravý klik = BIOS`}
          style={{
            width: 38,
            height: 38,
            background: profile.color,
            color: profileIdx === 3 ? '#000' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 16,
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: isFocused(0)
              ? `0 0 0 3px ${profile.color}88`
              : '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {profile.letter}
        </div>

        {/* Název + verze */}
        <div style={{ lineHeight: 1 }}>
          <div style={{
            fontWeight: 900,
            fontSize: 13,
            letterSpacing: '0.15em',
            color: '#000000',
            lineHeight: 1,
          }}>
            LOYO OS
          </div>
          <div style={{
            fontSize: 8,
            fontFamily: 'monospace',
            color: '#3a3a3a',
            marginTop: 2,
          }}>
            v3.0
          </div>
        </div>

      </div>

           {/* ══════════════════════════════════════════════════════════
          2. NOTIFIKACE — 18% — 3 samostatné jednotky s filtrovaným panelem
      ══════════════════════════════════════════════════════════ */}
      <div
        ref={notifRef}
        style={{
          ...sectionBase(1),
          width: '18%',
          padding: '0 10px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          overflow: 'visible',
        }}
      >
        {/* Jednotka: Nové (modrá) */}
        <div
          onClick={e => {
            e.stopPropagation()
            if (notifFilter === 'new' && showNotifPanel) {
              setShowNotifPanel(false); setNotifFilter(null)
            } else {
              setNotifFilter('new'); setShowNotifPanel(true)
            }
          }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1,
            cursor: 'pointer', padding: '4px 2px', borderRadius: 6,
            background: notifFilter === 'new' && showNotifPanel
              ? 'rgba(4,11,141,0.18)'
              : notifSubFocus === 0 ? 'rgba(4,11,141,0.22)' : 'transparent',
            outline: notifSubFocus === 0 ? `2px solid ${C.blue}` : 'none',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: C.blue,
              boxShadow: newCount > 0 ? `0 0 7px ${C.blue}` : 'none',
              flexShrink: 0,
              animation: notifBump.new ? 'notifPulse 0.7s ease' : 'none',
            }} />
            <span style={{
              fontFamily: 'monospace', fontSize: 14, fontWeight: 900,
              color: C.blue, lineHeight: 1,
              animation: notifBump.new ? 'notifBump 0.7s cubic-bezier(0.16,1,0.3,1)' : 'none',
            }}>
              {newCount}
            </span>
            {notifBump.new && (
              <sup style={{
                fontSize: 9, color: C.blue, fontWeight: 900, fontFamily: 'monospace',
                animation: 'notifPlusOne 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
                position: 'absolute', marginLeft: 20, marginTop: -8,
              }}>+1</sup>
            )}
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            NOVÉ
          </span>
        </div>

        {/* Oddělovač */}
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Jednotka: Nutné (karamelová) */}
        <div
          onClick={e => {
            e.stopPropagation()
            if (notifFilter === 'urgent' && showNotifPanel) {
              setShowNotifPanel(false); setNotifFilter(null)
            } else {
              setNotifFilter('urgent'); setShowNotifPanel(true)
            }
          }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1,
            cursor: 'pointer', padding: '4px 2px', borderRadius: 6,
            background: notifFilter === 'urgent' && showNotifPanel
              ? 'rgba(205,162,77,0.15)'
              : notifSubFocus === 1 ? 'rgba(205,162,77,0.18)' : 'transparent',
            outline: notifSubFocus === 1 ? `2px solid ${C.caramel}` : 'none',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: C.caramel,
              boxShadow: urgentCount > 0 ? `0 0 7px ${C.caramel}` : 'none',
              flexShrink: 0,
              animation: notifBump.urgent ? 'notifPulse 0.7s ease' : 'none',
            }} />
            <span style={{
              fontFamily: 'monospace', fontSize: 14, fontWeight: 900,
              color: C.caramel, lineHeight: 1,
              animation: notifBump.urgent ? 'notifBump 0.7s cubic-bezier(0.16,1,0.3,1)' : 'none',
            }}>
              {urgentCount}
            </span>
            {notifBump.urgent && (
              <sup style={{
                fontSize: 9, color: C.caramel, fontWeight: 900, fontFamily: 'monospace',
                animation: 'notifPlusOne 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
                position: 'absolute', marginLeft: 20, marginTop: -8,
              }}>+1</sup>
            )}
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            NUTNÉ
          </span>
        </div>

        {/* Oddělovač */}
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Jednotka: Ke schválení (červená) */}
        <div
          onClick={e => {
            e.stopPropagation()
            if (notifFilter === 'approval' && showNotifPanel) {
              setShowNotifPanel(false); setNotifFilter(null)
            } else {
              setNotifFilter('approval'); setShowNotifPanel(true)
            }
          }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1,
            cursor: 'pointer', padding: '4px 2px', borderRadius: 6,
            background: notifFilter === 'approval' && showNotifPanel
              ? 'rgba(172,0,1,0.15)'
              : notifSubFocus === 2 ? 'rgba(172,0,1,0.18)' : 'transparent',
            outline: notifSubFocus === 2 ? `2px solid ${C.red}` : 'none',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: C.red,
              boxShadow: approvalCount > 0 ? `0 0 7px ${C.red}` : 'none',
              flexShrink: 0,
              animation: notifBump.approval ? 'notifPulse 0.7s ease' : 'none',
            }} />
            <span style={{
              fontFamily: 'monospace', fontSize: 14, fontWeight: 900,
              color: C.red, lineHeight: 1,
              animation: notifBump.approval ? 'notifBump 0.7s cubic-bezier(0.16,1,0.3,1)' : 'none',
            }}>
              {approvalCount}
            </span>
            {notifBump.approval && (
              <sup style={{
                fontSize: 9, color: C.red, fontWeight: 900, fontFamily: 'monospace',
                animation: 'notifPlusOne 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
                position: 'absolute', marginLeft: 20, marginTop: -8,
              }}>+1</sup>
            )}
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            SCHVÁLENÍ
          </span>
        </div>

        {/* ── NOTIF DROPDOWN — filtrovaný podle kliknuté jednotky ── */}
        {(showNotifPanel || closingNotif) && notifFilter && (() => {
          const accentColor = notifFilter === 'new' ? C.blue : notifFilter === 'urgent' ? C.caramel : C.red
          const filterLabel = notifFilter === 'new' ? 'Nové' : notifFilter === 'urgent' ? 'Nutné' : 'Ke schválení'
          const filtered = notifications.filter(n => {
            if (notifFilter === 'new')      return !n.type || n.type === 'new'
            if (notifFilter === 'urgent')   return n.type === 'urgent'
            if (notifFilter === 'approval') return n.type === 'approval'
            return true
          })
          const filteredUnread = filtered.filter(n => !n.read).length
          return (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 8,
                width: 360,
                background: '#1a1a1a',
                border: `1.5px solid ${accentColor}44`,
                borderTop: `3px solid ${accentColor}`,
                borderRadius: 12,
                boxShadow: `0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px ${accentColor}22`,
                zIndex: 50,
                overflow: 'hidden',
                animation: closingNotif
                  ? 'slideUp 0.28s cubic-bezier(0.4,0,1,1) forwards'
                  : 'slideDown 0.42s cubic-bezier(0.16,1,0.3,1)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header panelu */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: `1px solid ${accentColor}22`,
                background: `${accentColor}0d`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                  }} />
                  <span style={{ fontWeight: 900, fontSize: 12, color: accentColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {filterLabel}
                  </span>
                  <span style={{
                    fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                    color: 'rgba(255,255,255,0.3)',
                  }}>
                    {filtered.length} celkem
                  </span>
                </div>
                {filteredUnread > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); markAllRead() }}
                    style={{
                      fontSize: 10, fontWeight: 700, color: accentColor,
                      background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8,
                      letterSpacing: '0.05em',
                    }}
                  >
                    Označit vše ✓
                  </button>
                )}
              </div>

              {/* Seznam */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{
                    padding: '32px 16px', textAlign: 'center',
                    fontSize: 13, color: 'rgba(255,255,255,0.25)',
                  }}>
                    Žádné notifikace tohoto typu
                  </div>
                ) : (
                  filtered.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.read) markRead(n.id) }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 16px',
                        background: n.read ? 'transparent' : `${accentColor}08`,
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (n.read) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = n.read ? 'transparent' : `${accentColor}08` }}
                    >
                      <div style={{
                        width: 3, height: 36, borderRadius: 2,
                        background: accentColor,
                        opacity: n.read ? 0.25 : 1,
                        flexShrink: 0, marginTop: 2,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: accentColor,
                            opacity: n.read ? 0.45 : 1,
                          }}>
                            {notifLabel(n.type)}
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                            {n.command}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12, lineHeight: 1.45,
                          color: n.read ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.88)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 10, marginTop: 4, color: 'rgba(255,255,255,0.22)' }}>
                          {timeAgo(n.ts)}
                        </div>
                      </div>
                      {!n.read && (
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: accentColor,
                          boxShadow: `0 0 6px ${accentColor}`,
                          flexShrink: 0, marginTop: 6,
                        }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ══════════════════════════════════════════════════════════
          3. CHAT — 40% (prodlouženo)
      ══════════════════════════════════════════════════════════ */}
      <div
        onClick={toggleChat}
        style={{
          ...sectionBase(2),
          width: '40%',
          padding: '0 16px',
          cursor: 'pointer',
          gap: 8,
          overflow: 'hidden',
        }}
      >
        {/* zelená tečka */}
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#00D084',
          boxShadow: '0 0 6px #00D084',
          flexShrink: 0,
        }} />

        {/* label */}
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#000000',
          flexShrink: 0,
          letterSpacing: '0.08em',
        }}>
          CHAT:
        </span>

        {/* poslední zpráva */}
        <span style={{
          fontSize: 12,
          color: '#000000',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontWeight: 500,
        }}>
          {chatLabel}
        </span>

        {/* Chat komponenta */}
        <Chat
          isOpen={isTerminalOpen}
          onClose={closeChat}
          onUnreadMessage={() => {}}
          onSaved={triggerSavedToast}
        />

        {showSavedToast && (
          <span style={{
            position: 'absolute',
            top: '100%',
            right: 16,
            marginTop: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: '#00D084',
            color: '#000',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,208,132,0.4)',
          }}>
            ✓ Uloženo
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          4. ČAS — 7% — karamelová + vteřiny červeně (PRVNÍ)
      ══════════════════════════════════════════════════════════ */}
      <div ref={timeBoxRef} style={{ ...sectionBase(3), width: '7%', padding: '0 4px', cursor: 'pointer', justifyContent: 'center', alignItems: 'center' }} onClick={() => { if (showDayPanel) { closeDayPanel() } else { setShowDayPanel(true); if (showCalendar) closeCalendar() } }}>
        <span style={{ fontSize: 30, fontWeight: 900, fontFamily: 'monospace', color: C.caramel, letterSpacing: '-0.04em', textAlign: 'center', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 1 } as any}>
          <span>{hh}</span>
          <span style={{ opacity: colonBlinkOn ? 1 : 0.15, transition: 'opacity 0.1s', margin: '0 1px' }}>:</span>
          <span>{mm}</span>
          <sup style={{ fontSize: 11, color: C.red, verticalAlign: 'super', lineHeight: 0, fontWeight: 700, marginLeft: 3, display: 'inline-block' }}>{ss}</sup>
        </span>

        {/* Denní panel */}
        {(showDayPanel || closingDayPanel) && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 8,
            width: 320,
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            zIndex: 50,
            animation: closingDayPanel
              ? 'slideUp 0.28s cubic-bezier(0.4,0,1,1) forwards'
              : 'slideDown 0.42s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => shiftDay(-1)} style={navBtnStyle}>‹</button>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                {dayLabel(selectedDate)}
              </span>
              <button onClick={() => shiftDay(1)} style={navBtnStyle}>›</button>
            </div>
            <div style={panelSectionLabel}>UDÁLOSTI</div>
            {dayEvents.length === 0 ? (
              <div style={panelEmpty}>Žádné události</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {dayEvents.map(ev => (
                  <div key={ev.file_name} style={panelRow}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00D084' }}>{ev.time || '--:--'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.8)' }}>{ev.title}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={panelSectionLabel}>OTEVŘENÉ ÚKOLY</div>
            {openTasks.length === 0 ? (
              <div style={panelEmpty}>Žádné otevřené úkoly</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                {openTasks.map(t => (
                  <div key={t.file_name} style={panelRow}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.caramel, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.8)' }}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          5. DATUM — 7%
      ══════════════════════════════════════════════════════════ */}
          <div ref={dateBoxRef} style={{ ...sectionBase(4), width: '7%', padding: '0 4px', cursor: 'pointer', justifyContent: 'center', alignItems: 'center' }} onClick={() => { if (showCalendar) { closeCalendar() } else { setShowCalendar(true); if (showDayPanel) closeDayPanel() } }}>
        <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: '#000000', letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1 }}>
          {dateFormatted.d}.{dateFormatted.m}.<sup style={{ fontSize: 11, verticalAlign: 'super', lineHeight: 0, fontWeight: 700, color: C.red }}>{dateFormatted.yy}</sup>
        </span>

        {/* Kalendář */}
        {(showCalendar || closingCalendar) && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 280,
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            zIndex: 50,
            animation: closingCalendar
              ? 'slideUp 0.28s cubic-bezier(0.4,0,1,1) forwards'
              : 'slideDown 0.42s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button
                onClick={e => { e.stopPropagation(); setCalendarViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }}
                style={navBtnStyle}
              >‹</button>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                {monthYearLabel(calendarViewDate)}
              </span>
              <button
                onClick={e => { e.stopPropagation(); setCalendarViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }}
                style={navBtnStyle}
              >›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {monthGrid.map((d, i) => {
                if (!d) return <div key={i} />
                const iso        = toIso(d)
                const isToday    = iso === toIso(new Date())
                const isSelected = iso === selectedIso
                const hasEvents  = eventsForDate(iso).length > 0
                return (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); pickDate(d) }}
                    style={{
                      position: 'relative',
                      height: 28,
                      borderRadius: 6,
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? '#fff' : isToday ? C.blue : 'transparent',
                      color: isSelected ? '#000' : isToday ? '#fff' : 'rgba(255,255,255,0.8)',
                      fontWeight: (isSelected || isToday) ? 700 : 400,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {d.getDate()}
                    {hasEvents && (
                      <span style={{
                        position: 'absolute',
                        bottom: 2,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#00D084',
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

            {/* ══════════════════════════════════════════════════════════
          5. AKTIVITA — červená, větší sekce
      ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          ...sectionBase(5),
          width: '10%',
          padding: '0 12px',
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span style={{
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: '0.12em',
          color: C.red,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          Aktivita
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════
          6. BUILDER — label vlevo, B tlačítko vpravo ke kraji
      ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          ...sectionBase(6),
          flex: 1,
          padding: '0 10px 0 14px',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRight: 'none',
          overflow: 'visible',
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: '0.18em',
          color: 'rgba(0,0,0,0.35)',
          textTransform: 'uppercase',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          Builder
        </span>
        <Builder
          focused={isFocused(6)}
          externalOpen={showBuilderMenu}
          onExternalClose={() => setShowBuilderMenu(false)}
          onManifestComplete={(type, manifest) => {
            console.log('Builder manifest:', type, manifest)
          }}
        />
      </div>


           {/* ── CSS animace — vyjetí dolů + moderní notif rotace ─────── */}
      <style>{`
        @keyframes loyoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes notifSlideOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
        @keyframes chatSlideDown {
          from { opacity: 0; transform: translateY(-16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes secBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.25; }
        }
        @keyframes notifBump {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.45); }
          65%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        @keyframes notifPulse {
          0%   { box-shadow: 0 0 0px currentColor; }
          40%  { box-shadow: 0 0 14px currentColor; }
          100% { box-shadow: 0 0 4px currentColor; }
        }
        @keyframes notifPlusOne {
          0%   { opacity: 0; transform: translateY(4px) scale(0.7); }
          30%  { opacity: 1; transform: translateY(-6px) scale(1.1); }
          70%  { opacity: 1; transform: translateY(-8px) scale(1); }
          100% { opacity: 0; transform: translateY(-14px) scale(0.8); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-12px); }
        }
      `}</style>
    </header>
  )
}

// ── sdílené styly pro panely ─────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
  fontSize: 16,
}

const panelSectionLabel: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  letterSpacing: '0.15em',
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
  marginBottom: 8,
}

const panelEmpty: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.3)',
  marginBottom: 12,
}

const panelRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  borderRadius: 8,
  padding: '6px 10px',
  background: 'rgba(255,255,255,0.05)',
}
