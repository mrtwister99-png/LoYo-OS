// apps/web/src/hooks/useAppState.ts
// LOYO OS // Centrální app state — page, biosMode, builderOpen
import { useState, useCallback } from 'react'

export type Page =
  | 'dashboard'
  | 'kalendar'
  | 'activity'
  | 'notes'
  | 'tasks'
  | 'tym'
  | 'agenti'
  | 'skills'
  | 'mcp'
  | 'cli'
  | 'loops'
  | 'api'
  | 'workflows'
  | 'general'
  | 'rozdelane'
  | 'musthave'
  | 'testy'
  | 'zapisky'
  | 'projekty'
  | 'grnotes'
  | 'helenevim'
  | 'shaders'
  | 'threed'
  | 'knowledgebase'
  | 'macros'

interface AppState {
  page: Page
  setPage: (p: Page) => void
  biosMode: boolean
  setBiosMode: (v: boolean) => void
  builderOpen: boolean
  openBuilder: () => void
  closeBuilder: () => void
  toggleBuilder: () => void
  mobilOpen: boolean
  openMobil: () => void
  closeMobil: () => void
  toggleMobil: () => void
  activeProfile: number
  setActiveProfile: (n: number) => void
}

export function useAppState(initialPage: Page = 'dashboard'): AppState {
  const [page, setPageRaw]   = useState<Page>(initialPage)
  const [biosMode, setBiosMode] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [mobilOpen, setMobilOpen]     = useState(false)
  const [activeProfile, setActiveProfileRaw] = useState<number>(() => {
    try { const v = localStorage.getItem('loyo-active-profile'); return v ? parseInt(v, 10) : 0 } catch { return 0 }
  })

  const setPage = useCallback((p: Page) => setPageRaw(p), [])

  const openBuilder   = useCallback(() => setBuilderOpen(true),  [])
  const closeBuilder  = useCallback(() => setBuilderOpen(false), [])
  const toggleBuilder = useCallback(() => setBuilderOpen(v => !v), [])

  const openMobil   = useCallback(() => setMobilOpen(true),  [])
  const closeMobil  = useCallback(() => setMobilOpen(false), [])
  const toggleMobil = useCallback(() => setMobilOpen(v => !v), [])

  const setActiveProfile = useCallback((n: number) => {
    const idx = Math.max(0, Math.min(3, n))
    setActiveProfileRaw(idx)
    try { localStorage.setItem('loyo-active-profile', String(idx)) } catch {}
  }, [])

  return {
    page, setPage,
    biosMode, setBiosMode,
    builderOpen, openBuilder, closeBuilder, toggleBuilder,
    mobilOpen, openMobil, closeMobil, toggleMobil,
    activeProfile, setActiveProfile,
  }
}
