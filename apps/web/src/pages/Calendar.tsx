// D:\dev\loyo-os\apps\web\src\pages\Calendar.tsx
import { useState, useMemo, useCallback } from 'react'
import { useCalendarEvents, type CalendarEvent } from '../hooks/useCalendarEvents'
import { JA_KALENDAR_DIR } from '../lib/dataPaths'
import { categoryColors, categoryNumbers, categoryGradients } from '../styles/theme'

const CALENDAR_COLOR = categoryColors.calendar
const CALENDAR_NUM = categoryNumbers.calendar
const CALENDAR_GRADIENT = categoryGradients.calendar

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
   .filter(line =>!/^#\s*/.test(line) &&!line.includes('**Datum:**') &&!line.includes('**Čas:**') &&!line.includes('**Délka:**'))
   .join('\n')
   .trim()
}

function buildContent(title: string, date: string, time: string, duration: number, description: string) {
  const desc = description.trim()
  return `# ${title}\n\n**Datum:** ${date}\n**Čas:** ${time}\n**Délka:** ${duration}\n\n${desc}`.trim() + '\n'
}

function getWeekDays(iso: string) {
  const d = new Date(iso)
  const day = d.getDay() === 0? 7 : d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day - 1))
  return Array.from({length:7}).map((_,i)=>{
    const cur = new Date(monday)
    cur.setDate(monday.getDate()+i)
    return toIso(cur.getFullYear(), cur.getMonth(), cur.getDate())
  })
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
  duration: number
  description: string
}

const EMPTY_MODAL: ModalState = { open: false, editing: null, title: '', date: '', time: '', duration: 60, description: '' }

export default function Calendar() {
  const { events, eventsForDate, reload } = useCalendarEvents()
  const today = todayIso()
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'week'>('grid')
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
    setModal({ open: true, editing: null, title: '', date: iso || selectedDate, time: '12:00', duration: 60, description: '' })
  }, [selectedDate])

  const openEditEvent = useCallback((ev: CalendarEvent) => {
    setError('')
    setModal({ open: true, editing: ev, title: ev.title, date: ev.date, time: ev.time, duration: ev.duration||60, description: extractDescription(ev.content) })
  }, [])

  const closeModal = useCallback(() => setModal(EMPTY_MODAL), [])

   const persistEvent = useCallback(async (ev: CalendarEvent) => {
    const content = buildContent(ev.title, ev.date, ev.time, ev.duration||60, extractDescription(ev.content))
    const full: CalendarEvent = {...ev, content }
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
        const filePath = `${JA_KALENDAR_DIR}/${fileName}`
        await persistEvent({
          file_name: fileName,
          file_path: filePath,
          title: modal.title.trim(),
          date: modal.date,
          time: modal.time,
          duration: modal.duration,
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
  const weekDays = useMemo(()=> getWeekDays(selectedDate), [selectedDate])
  const [dragging, setDragging] = useState<CalendarEvent | null>(null)
  const [resizing, setResizing] = useState<{ev:CalendarEvent, startY:number, startDur:number, previewDur?:number} | null>(null)

  const handleDrop = useCallback(async (e: React.DragEvent, targetDate: string, container: HTMLElement) => {
    e.preventDefault()
    if(!dragging) return
    const rect = container.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const minutes = Math.round((y/52)*60/15)*15
    const hh = Math.floor(Math.max(0, Math.min(1439, minutes))/60)
    const mm = Math.max(0, Math.min(1439, minutes))%60
    const newTime = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
    const updated = {...dragging, date: targetDate, time: newTime }
    setDragging(null)
    await persistEvent(updated)
  }, [dragging, persistEvent])

  const handleResizeMove = useCallback((e: MouseEvent)=>{
    if(!resizing) return
    const deltaY = e.clientY - resizing.startY
    const deltaMin = Math.round((deltaY/52)*60/15)*15
    const newDur = Math.max(15, resizing.startDur + deltaMin)
    setResizing(r=> r? {...r, previewDur: newDur} : r)
  }, [resizing])

  const handleResizeEnd = useCallback(async ()=>{
    if(!resizing) return
    const finalDur = resizing.previewDur || resizing.startDur
    const ev = resizing.ev
    setResizing(null)
    window.removeEventListener('mousemove', handleResizeMove as any)
    window.removeEventListener('mouseup', handleResizeEnd as any)
    if(finalDur!== resizing.startDur){
      await persistEvent({...ev, duration: finalDur})
    }
  }, [resizing, persistEvent, handleResizeMove])

  const startResizing = useCallback((e: React.MouseEvent, ev: CalendarEvent)=>{
    e.stopPropagation()
    e.preventDefault()
    setResizing({ev, startY: e.clientY, startDur: ev.duration||60})
    window.addEventListener('mousemove', handleResizeMove as any)
    window.addEventListener('mouseup', handleResizeEnd as any)
  }, [handleResizeMove, handleResizeEnd])

  return (
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg md:text-xl font-black tracking-[0.2em]">KALENDÁŘ</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-[#444] rounded-sm overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 text- tracking-[0.15em] font-bold ${viewMode==='grid'? 'bg-[#12a4ff] text-white' : 'bg-[#3a3a3a] hover:bg-white/5'}`}>GRID</button>
            <button onClick={() => setViewMode('timeline')} className={`px-3 py-1.5 text- tracking-[0.15em] font-bold ${viewMode==='timeline'? 'bg-[#12a4ff] text-white' : 'bg-[#3a3a3a] hover:bg-white/5'}`}>DEN</button>
            <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 text- tracking-[0.15em] font-bold ${viewMode==='week'? 'bg-[#12a4ff] text-white' : 'bg-[#3a3a3a] hover:bg-white/5'}`}>TÝDEN</button>
          </div>
          <button
            onClick={() => openNewEvent()}
            className="px-4 py-2 text- tracking-[0.15em] font-bold bg-[#12a4ff] text-[#f0f0f0] hover:opacity-90 transition-opacity"
          >
            + PŘIDAT UDÁLOST
          </button>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Kalendářní mřížka */}
        <div className="bg-[#444] text-[#f0f0f0] p-4 md:p-6 rounded-sm">
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
              <div key={d} className="text-center text-[10px] tracking-[0.15em] text-[#9a9a9a] py-1">{d}</div>
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
                    isSelected ? 'bg-[#12a4ff] text-[#f0f0f0]' :
                    isToday ? 'bg-white/10 text-[#f0f0f0] border border-white/30' :
                    'hover:bg-white/10 text-[#f0f0f0]'
                  }`}
                >
                  <span>{cell.day}</span>
                  {count > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-[#3a3a3a]' : 'bg-[#444]'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

               {/* Přehled dne / Timeline - ÚKOL 17 */}
        <div className="bg-[#3a3a3a] backdrop-blur-sm p-4 md:p-5 rounded-sm border border-[#444]">
          <div className="flex items-center justify-between mb-3">
            <div className="text- font-bold tracking-[0.15em] opacity-70">
              {new Date(selectedDate).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {viewMode==='timeline' && <div className="text- opacity-50">{selectedEvents.length} událostí</div>}
          </div>

          {viewMode==='grid'? (
            <>
              {selectedEvents.length === 0? (
                <div className="text- opacity-50 py-6 text-center">Žádné události tento den.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedEvents.map((ev) => (
                    <div key={ev.file_path} className="p-3 bg-[#3a3a3a] rounded-sm border border-[#444] group border-l" style={{ borderLeftColor: CALENDAR_COLOR, background: `linear-gradient(90deg, #3a3a3a 70%, ${CALENDAR_COLOR}22 100%)` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text- font-bold tracking-[0.1em] opacity-60">{ev.time}</div>
                          <div className="text- font-semibold">{ev.title}</div>
                          {extractDescription(ev.content) && (
                            <div className="text- opacity-60 mt-1 whitespace-pre-wrap">{extractDescription(ev.content)}</div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEditEvent(ev)} className="text- px-2 py-1 border border-[#444] rounded-sm hover:bg-white/5">EDIT</button>
                          <button onClick={() => deleteEvent(ev)} className="text- px-2 py-1 border border-[#ff1e00]/40 rounded-sm royal-danger">SMAZAT</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="relative border border-[#444] rounded-sm bg-[#3a3a3a] overflow-hidden">
              <div className="h- overflow-y-auto relative">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="absolute left-0 right-0 flex" style={{ top: `${h * 52}px`, height: '52px' }}>
                    <div className="w-12 text- opacity-40 pr-2 text-right pt-1 border-r border-[#444]">{String(h).padStart(2,'0')}:00</div>
                    <div className="flex-1 border-t border-[#444]"></div>
                  </div>
                ))}
                {(() => {
                  const toMin = (t:string)=>{ const [hh,mm]=t.split(':').map(Number); return (hh||0)*60+(mm||0) }
                  const sorted = [...selectedEvents].sort((a,b)=>toMin(a.time)-toMin(b.time))
                  const cols: typeof sorted[] = []
                  const placed = sorted.map(ev=>{
                    const start = toMin(ev.time)
                    const dur = ev.duration||60
                    let colIdx = cols.findIndex(col=>{
                      const last = col[col.length-1]
                      return last? toMin(last.time)+(last.duration||60) <= start : true
                    })
                    if(colIdx===-1){ colIdx=cols.length; cols.push([]) }
                    cols[colIdx].push(ev)
                    return {ev, colIdx, start, dur}
                  })
                  // konflikt detekce >50% překryvu
                  const hasConflict = (a:any,b:any)=>{
                    const aEnd = a.start + a.dur
                    const bEnd = b.start + b.dur
                    const overlap = Math.max(0, Math.min(aEnd,bEnd) - Math.max(a.start,b.start))
                    const shorter = Math.min(a.dur,b.dur)
                    return overlap > shorter*0.5
                  }
                  const conflicts = new Set<string>()
                  placed.forEach((p,i)=>{
                    placed.forEach((q,j)=>{
                      if(i!==j && p.ev.date===q.ev.date && hasConflict(p,q)) conflicts.add(p.ev.file_path)
                    })
                  })
                  const colCount = Math.max(1, cols.length)
                  return placed.map(({ev, colIdx, start, dur})=>{
                    const top = (start/60)*52
                    const isResizingThis = resizing?.ev.file_path===ev.file_path
                    const h = ((isResizingThis? (resizing.previewDur||dur) : dur)/60)*52
                    const isConflict = conflicts.has(ev.file_path)
                    return (
                      <div
                        key={ev.file_path}
                        draggable
                        onDragStart={()=> setDragging(ev)}
                        onDragEnd={()=> setDragging(null)}
                        className={`absolute rounded-sm border shadow-sm group cursor-grab active:cursor-grabbing hover:z-10 hover:shadow-md transition-all ${isConflict? 'border-[#444]/60 bg-[#444]/10' : 'border-[#12a4ff]/30'}`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(22,h)}px`,
                          left: `calc(48px + ${(colIdx/colCount)*100}% - ${(colIdx/colCount)*48}px)`,
                          width: `calc(${100/colCount}% - 48px/${colCount} - 4px)`,
                          background: isConflict? `linear-gradient(135deg, #3a3a3a 0%, #444 100%)` : `linear-gradient(135deg, #3a3a3a 0%, ${CALENDAR_COLOR}18 100%)`,
                          borderLeft: `2px solid ${isConflict? '#ff1e00' : CALENDAR_COLOR}`,
                          opacity: dragging?.file_path===ev.file_path? 0.5 : 1
                        }}
                        onClick={()=>openEditEvent(ev)}
                      >
                        <div className="px-2 py-1">
                          <div className="text- font-bold truncate flex items-center gap-1">
                            {ev.time} {ev.title}
                            {isConflict && <span className="text- bg-[#444] text-[#f0f0f0] px-1 rounded-sm">KONFLIKT</span>}
                          </div>
                          <div className="text- opacity-60 truncate">{ev.duration||60}m · {extractDescription(ev.content).slice(0,40)}</div>
                        </div>
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/5 hover:bg-white/5"
                          onMouseDown={(e)=> startResizing(e, ev)}
                        />
                      </div>
                    )
                  })
                })()}
                {selectedDate===today && (
                  <div className="absolute left-0 right-0 h-0.5 bg-[#444] z-20 pointer-events-none" style={{ top: `${(new Date().getHours()*60+new Date().getMinutes())/60*52}px` }}>
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-[#444]"></div>
                  </div>
                )}
              </div>
                  {selectedEvents.length===0 && <div className="text- opacity-50 p-3 text-center">Žádné události - přetah se nezobrazí</div>}
            </div>
          )}

          {viewMode==='week' && (
            <div className="mt-4 border border-[#444] rounded-sm bg-[#3a3a3a] overflow-hidden">
              <div className="grid grid-cols-7 border-b border-[#444] bg-white/5">
                {weekDays.map(d=>{
                  const isSel = d===selectedDate
                  const dayEvents = events.filter(ev=>ev.date===d)
                  return (
                    <div key={d} className={`p-2 text-center border-r last:border-r-0 ${isSel? 'bg-[#12a4ff] text-[#f0f0f0]' : ''}`}>
                      <div className="text- opacity-60">{new Date(d).toLocaleDateString('cs-CZ',{weekday:'short'})}</div>
                      <div className="text- font-bold">{new Date(d).getDate()}</div>
                      <div className="text- opacity-50">{dayEvents.length}×</div>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 h- overflow-y-auto">
                {weekDays.map(dayIso=>(
                  <div
                    key={dayIso}
                    className="relative border-r last:border-r-0 border-[#444]"
                    onDragOver={e=> e.preventDefault()}
                    onDrop={e=>{
                      const cont = e.currentTarget as HTMLElement
                      handleDrop(e, dayIso, cont)
                    }}
                  >
                    {Array.from({length:24}).map((_,h)=>(
                      <div key={h} className="absolute left-0 right-0 border-t border-[#444]" style={{top:`${h*52}px`}} />
                    ))}
                    {events.filter(ev=>ev.date===dayIso).map(ev=>{
                      const toMin = (t:string)=>{ const [hh,mm]=t.split(':').map(Number); return hh*60+mm }
                      const start = toMin(ev.time)
                      const h = ((ev.duration||60)/60)*52
                      return (
                        <div
                          key={ev.file_path}
                          draggable
                          onDragStart={()=> setDragging(ev)}
                          className="absolute left-0 right-1 rounded-sm border-l bg-[#3a3a3a] shadow-sm text- px-1 py-0.5 truncate cursor-grab"
                          style={{top:`${(start/60)*52}px`, height:`${h}px`, borderLeftColor: CALENDAR_COLOR}}
                          onClick={()=>openEditEvent(ev)}
                        >
                          {ev.time} {ev.title}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => openNewEvent(selectedDate)}
            className="w-full mt-4 py-2 text- tracking-[0.15em] font-bold border border-[#444] rounded-sm hover:bg-white/5 transition-colors"
          >
            + PŘIDAT NA TENTO DEN
          </button>
        </div>
      </div>


      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-[#3a3a3a] rounded-sm w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
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
                  className="w-full px-3 py-2 text-[13px] border border-[#444] rounded-sm outline-none focus:border-[#12a4ff]"
                  placeholder="Např. Schůzka s klientem"
                />
              </div>

                     <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text- tracking-[0.1em] opacity-60 block mb-1">DATUM</label>
                  <input
                    type="date"
                    value={modal.date}
                    onChange={e => setModal(m => ({...m, date: e.target.value }))}
                    className="w-full px-3 py-2 text- border border-[#444] rounded-sm outline-none focus:border-[#12a4ff]"
                  />
                </div>
                <div>
                  <label className="text- tracking-[0.1em] opacity-60 block mb-1">ČAS</label>
                  <input
                    type="time"
                    value={modal.time}
                    onChange={e => setModal(m => ({...m, time: e.target.value }))}
                    className="w-full px-3 py-2 text- border border-[#444] rounded-sm outline-none focus:border-[#12a4ff]"
                  />
                </div>
                <div>
                  <label className="text- tracking-[0.1em] opacity-60 block mb-1">DÉLKA</label>
                  <select
                    value={modal.duration}
                    onChange={e => setModal(m => ({...m, duration: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 text- border border-[#444] rounded-sm outline-none focus:border-[#12a4ff]"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
              </div>
                  <label className="text-[10px] tracking-[0.1em] opacity-60 block mb-1">ČAS</label>
                  <input
                    type="time"
                    value={modal.time}
                    onChange={e => setModal(m => ({ ...m, time: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#444] rounded-sm outline-none focus:border-[#12a4ff]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-[0.1em] opacity-60 block mb-1">POPIS (nepovinné)</label>
                <textarea
                  value={modal.description}
                  onChange={e => setModal(m => ({ ...m, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border border-[#444] rounded-sm outline-none focus:border-[#12a4ff] resize-none"
                  placeholder="Volitelná poznámka k události..."
                />
              </div>

              {error && <div className="text-[11px] text-[#9a9a9a]">{error}</div>}

              <div className="flex justify-end gap-2 mt-2">
                <button onClick={closeModal} className="px-4 py-2 text-[11px] tracking-[0.1em] font-bold border border-[#444] rounded-sm hover:bg-white/5">
                  ZRUŠIT
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-[11px] tracking-[0.1em] font-bold bg-[#12a4ff] text-[#f0f0f0] rounded-sm hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'UKLÁDÁM...' : 'ULOŽIT'}
                </button>
              </div>
            </div>
      )}
    </div>
  )
}
