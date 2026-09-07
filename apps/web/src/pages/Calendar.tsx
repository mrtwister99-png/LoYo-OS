// D:\dev\loyo-os\apps\web\src\pages\Calendar.tsx
import { useState, useMemo, useCallback } from 'react'
import { useCalendarEvents, KALENDAR_DIR, type CalendarEvent } from '../hooks/useCalendarEvents'

const MONTHS_CZ = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]
const DAYS_CZ = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function todayIso() {
  const t = new Date()
  return toIso(t.getFullYear(), t.getMonth(), t.getDate())
}

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'udalost'
}

function extractDescription(content: string) {
  return content
    .split('\n')
    .filter(line => !/^#\s*/.test(line) && !line.includes('**Datum:**') && !line.includes('**Čas:**'))
    .join('\n')
    .trim()
}

function buildContent(title: string, date: string, time: string, description: string) {
  const desc = description.trim()
  return `# ${title}\n\n**Datum:** ${date}\n**Čas:** ${time}\n\n${desc}`.trim() + '\n'
}

async function hasTauri() {
  return typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
}

type ModalState = {
  open: boolean
  editing: CalendarEvent | null
  title: string
  date: string
  time: string
  description: string
}

const EMPTY_MODAL: ModalState = { open: false, editing: null, title: '', date: '', time: '', description: '' }

export default function Calendar() {
  const { events, eventsForDate, reload } = useCalendarEvents()
  const today = todayIso()
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const monthDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const jsWeekday = firstOfMonth.getDay() // 0=Ne
    const leadingEmpty = (jsWeekday + 6) % 7 // Po=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: { day: number | null; iso: string | null }[] = []
    for (let i = 0; i < leadingEmpty; i++) cells.push({ day: null, iso: null })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, iso: toIso(viewYear, viewMonth, d) })
    return cells
  }, [viewYear, viewMonth])

  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of events) {
      if (!e.date) continue
      map[e.date] = (map[e.date] || 0) + 1
    }
    return map
  }, [events])

  const goPrevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else { setViewMonth(m => m - 1) }
  }, [viewMonth])

  const goNextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else { setViewMonth(m => m + 1) }
  }, [viewMonth])

  const goToday = useCallback(() => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setSelectedDate(todayIso())
  }, [])

  const openNewEvent = useCallback((iso?: string) => {
    setError('')
    setModal({ open: true, editing: null, title: '', date: iso || selectedDate, time: '12:00', description: '' })
  }, [selectedDate])

  const openEditEvent = useCallback((ev: CalendarEvent) => {
    setError('')
    setModal({ open: true, editing: ev, title: ev.title, date: ev.date, time: ev.time, description: extractDescription(ev.content) })
  }, [])

  const closeModal = useCallback(() => setModal(EMPTY_MODAL), [])

  const persistEvent = useCallback(async (ev: CalendarEvent) => {
    const content = buildContent(ev.title, ev.date, ev.time, extractDescription(ev.content))
    const full: CalendarEvent = { ...ev, content }
    if (await hasTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('save_event', { path: full.file_path, content })
    } else {
      const saved = localStorage.getItem('loyo-events')
      const list: CalendarEvent[] = saved ? JSON.parse(saved) : []
      const idx = list.findIndex(e => e.file_path === full.file_path)
      if (idx >= 0) list[idx] = full; else list.push(full)
      localStorage.setItem('loyo-events', JSON.stringify(list))
    }
    await reload()
  }, [reload])

  const deleteEvent = useCallback(async (ev: CalendarEvent) => {
    if (!confirm(`Smazat událost "${ev.title}"?`)) return
    if (await hasTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('delete_event', { path: ev.file_path })
    } else {
      const saved = localStorage.getItem('loyo-events')
      const list: CalendarEvent[] = saved ? JSON.parse(saved) : []
      localStorage.setItem('loyo-events', JSON.stringify(list.filter(e => e.file_path !== ev.file_path)))
    }
    await reload()
  }, [reload])

  const handleSubmit = useCallback(async () => {
    if (!modal.title.trim()) { setError('Zadej název události.'); return }
    if (!modal.date) { setError('Zadej datum.'); return }
    if (!modal.time) { setError('Zadej čas.'); return }
    setSaving(true)
    setError('')
    try {
      if (modal.editing) {
        await persistEvent({
          ...modal.editing,
          title: modal.title.trim(),
          date: modal.date,
          time: modal.time,
          content: modal.editing.content,
        })
      } else {
        const fileName = `${modal.date}_${modal.time.replace(':', '')}_${slugify(modal.title)}.md`
        const filePath = `${KALENDAR_DIR}/${fileName}`
        await persistEvent({
          file_name: fileName,
          file_path: filePath,
          title: modal.title.trim(),
          date: modal.date,
          time: modal.time,
          content: '',
        })
      }
      closeModal()
    } catch (e) {
      setError('Uložení se nezdařilo. Zkus to znovu.')
    } finally {
      setSaving(false)
    }
  }, [modal, persistEvent, closeModal])

  const selectedEvents = eventsForDate(selectedDate).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg md:text-xl font-black tracking-[0.2em]">KALENDÁŘ</h1>
        <button
          onClick={() => openNewEvent()}
          className="px-4 py-2 text-[12px] tracking-[0.15em] font-bold bg-[#1000a1] text-white hover:opacity-90 transition-opacity"
        >
          + PŘIDAT UDÁLOST
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Kalendářní mřížka */}
        <div className="bg-black text-white p-4 md:p-6 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={goPrevMonth} className="px-3 py-1 text-lg hover:bg-white/10 rounded-sm transition-colors">‹</button>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-bold tracking-[0.2em]">{MONTHS_CZ[viewMonth]} {viewYear}</span>
              <button onClick={goToday} className="text-[10px] tracking-[0.15em] px-2 py-1 border border-white/20 hover:bg-white/10 rounded-sm transition-colors">DNES</button>
            </div>
            <button onClick={goNextMonth} className="px-3 py-1 text-lg hover:bg-white/10 rounded-sm transition-colors">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_CZ.map(d => (
              <div key={d} className="text-center text-[10px] tracking-[0.15em] text-white/50 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((cell, i) => {
              if (!cell.day || !cell.iso) return <div key={`empty-${i}`} />
              const isToday = cell.iso === today
              const isSelected = cell.iso === selectedDate
              const count = eventCountByDate[cell.iso] || 0
              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelectedDate(cell.iso!)}
                  onDoubleClick={() => openNewEvent(cell.iso!)}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-sm text-[12px] font-semibold transition-colors ${
                    isSelected ? 'bg-[#1000a1] text-white' :
                    isToday ? 'bg-white/10 text-white border border-white/30' :
                    'hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>{cell.day}</span>
                  {count > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#ae1710]'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Přehled dne */}
        <div className="bg-white/80 backdrop-blur-sm p-4 md:p-5 rounded-sm border border-black/10">
          <div className="text-[12px] font-bold tracking-[0.15em] mb-3 opacity-70">
            {new Date(selectedDate).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {selectedEvents.length === 0 ? (
            <div className="text-[12px] opacity-50 py-6 text-center">Žádné události tento den.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map(ev => (
                <div key={ev.file_path} className="p-3 bg-white rounded-sm border border-black/10 group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.1em] opacity-60">{ev.time}</div>
                      <div className="text-[13px] font-semibold">{ev.title}</div>
                      {extractDescription(ev.content) && (
                        <div className="text-[11px] opacity-60 mt-1 whitespace-pre-wrap">{extractDescription(ev.content)}</div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEditEvent(ev)} className="text-[10px] px-2 py-1 border border-black/20 rounded-sm hover:bg-black/5">EDIT</button>
                      <button onClick={() => deleteEvent(ev)} className="text-[10px] px-2 py-1 border border-[#ae1710]/40 text-[#ae1710] rounded-sm hover:bg-[#ae1710]/10">SMAZAT</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => openNewEvent(selectedDate)}
            className="w-full mt-4 py-2 text-[11px] tracking-[0.15em] font-bold border border-black/20 rounded-sm hover:bg-black/5 transition-colors"
          >
            + PŘIDAT NA TENTO DEN
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-sm w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="text-[13px] font-bold tracking-[0.15em] mb-4">
              {modal.editing ? 'UPRAVIT UDÁLOST' : 'NOVÁ UDÁLOST'}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] tracking-[0.1em] opacity-60 block mb-1">NÁZEV</label>
                <input
                  autoFocus
                  value={modal.title}
                  onChange={e => setModal(m => ({ ...m, title: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] border border-black/20 rounded-sm outline-none focus:border-[#1000a1]"
                  placeholder="Např. Schůzka s klientem"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-[0.1em] opacity-60 block mb-1">DATUM</label>
                  <input
                    type="date"
                    value={modal.date}
                    onChange={e => setModal(m => ({ ...m, date: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-black/20 rounded-sm outline-none focus:border-[#1000a1]"
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-[0.1em] opacity-60 block mb-1">ČAS</label>
                  <input
                    type="time"
                    value={modal.time}
                    onChange={e => setModal(m => ({ ...m, time: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-black/20 rounded-sm outline-none focus:border-[#1000a1]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-[0.1em] opacity-60 block mb-1">POPIS (nepovinné)</label>
                <textarea
                  value={modal.description}
                  onChange={e => setModal(m => ({ ...m, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border border-black/20 rounded-sm outline-none focus:border-[#1000a1] resize-none"
                  placeholder="Volitelná poznámka k události..."
                />
              </div>

              {error && <div className="text-[11px] text-[#ae1710]">{error}</div>}

              <div className="flex justify-end gap-2 mt-2">
                <button onClick={closeModal} className="px-4 py-2 text-[11px] tracking-[0.1em] font-bold border border-black/20 rounded-sm hover:bg-black/5">
                  ZRUŠIT
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-[11px] tracking-[0.1em] font-bold bg-[#1000a1] text-white rounded-sm hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'UKLÁDÁM...' : 'ULOŽIT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
