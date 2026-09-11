// D:\dev\loyo-os\apps\web\src\hooks\useCalendarEvents.ts
import { useState, useEffect, useCallback } from 'react'

export type CalendarEvent = {
  file_name: string
  file_path: string
  title: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  content: string
}

import { JA_KALENDAR_DIR } from '../lib/dataPaths'
export const KALENDAR_DIR = JA_KALENDAR_DIR

function parseEventFile(file_name: string, file_path: string, content: string): CalendarEvent {
  const titleMatch = content.match(/^#\s*(.+)$/m)
  const dateMatch = content.match(/\*\*Datum:\*\*\s*(\d{4}-\d{2}-\d{2})/)
  const timeMatch = content.match(/\*\*Čas:\*\*\s*(\d{2}:\d{2})/)
  return {
    file_name,
    file_path,
    title: titleMatch ? titleMatch[1].trim() : 'Bez názvu',
    date: dateMatch ? dateMatch[1] : '',
    time: timeMatch ? timeMatch[1] : '',
    content,
  }
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isTauri, setIsTauri] = useState(false)

  const load = useCallback(async () => {
    const hasTauri = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
    setIsTauri(hasTauri)
    if (hasTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('ensure_dir', { path: KALENDAR_DIR })
        const raw = await invoke<{ file_name: string; file_path: string; content: string }[]>('list_events', { dir: KALENDAR_DIR })
        setEvents((raw || []).map(f => parseEventFile(f.file_name, f.file_path, f.content)))
      } catch (e) {
        console.error('Nelze načíst kalendář:', e)
      }
    } else {
      const saved = localStorage.getItem('loyo-events')
      if (saved) {
        try { setEvents(JSON.parse(saved)) } catch {}
      }
    }
  }, [])

  useEffect(() => {
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [load])

  const eventsForDate = useCallback((iso: string) => events.filter(e => e.date === iso), [events])

  return { events, eventsForDate, reload: load, isTauri }
}
