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
  // | 'projekty' - smazán v3.0
  | 'skills'
  | 'mcp'
  | 'cli'
  | 'loops'
  | 'api'
  | 'workflows'
  | 'general'

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
}

export function useAppState(initialPage: Page = 'dashboard'): AppState {
  const [page, setPageRaw]   = useState<Page>(initialPage)
  const [biosMode, setBiosMode] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [mobilOpen, setMobilOpen]     = useState(false)

  const setPage = useCallback((p: Page) => setPageRaw(p), [])

  const openBuilder   = useCallback(() => setBuilderOpen(true),  [])
  const closeBuilder  = useCallback(() => setBuilderOpen(false), [])
  const toggleBuilder = useCallback(() => setBuilderOpen(v => !v), [])

  const openMobil   = useCallback(() => setMobilOpen(true),  [])
  const closeMobil  = useCallback(() => setMobilOpen(false), [])
  const toggleMobil = useCallback(() => setMobilOpen(v => !v), [])

  return {
    page, setPage,
    biosMode, setBiosMode,
    builderOpen, openBuilder, closeBuilder, toggleBuilder,
    mobilOpen, openMobil, closeMobil, toggleMobil,
  }
}
