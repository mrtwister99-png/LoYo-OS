import { useEffect, useState, lazy, Suspense, useMemo } from 'react'
import Layout from './components/Layout'
import { useAppState } from './hooks/useAppState'
import { SaveStatusContext } from './hooks/useSaveStatus'
import Background from './components/Background'
import { Builder } from './components/Builder'

// Lazy load stránek - <100ms přepnutí, React.memo na Menu, useReducer v Layoutu
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Team = lazy(() => import('./pages/Team'))
const Agents = lazy(() => import('./pages/Agents'))
const Activity = lazy(() => import('./pages/Activity'))
const Notes = lazy(() => import('./pages/Notes'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Mcp = lazy(() => import('./pages/Mcp'))
const Skills = lazy(() => import('./pages/Skills'))
const Loops = lazy(() => import('./pages/Loops'))
const Api = lazy(() => import('./pages/Api'))
const Workflows = lazy(() => import('./pages/Workflows'))
const Cli = lazy(() => import('./pages/Cli'))

const General = () => <div className="p-10 text-sm opacity-60">General Settings • brzy...</div>

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'DASHBOARD',
  kalendar: 'KALENDÁŘ',
  activity: 'ACTIVITY',
  notes: 'POZNÁMKY',
  tasks: 'ÚKOLY',
  tym: 'TÝM',
  agenti: 'AGENTI',
  skills: 'SKILLS',
  mcp: 'MCP',
  cli: 'CLI',
  loops: 'LOOPS',
  api: 'API',
  workflows: 'WORKFLOWS',
  general: 'NASTAVENÍ',
}

const PageLoader = () => (
  <div className="flex items-center justify-center p-20">
    <div className="text-[10px] tracking-[0.3em] opacity-30 animate-pulse">LOADING...</div>
  </div>
)

export default function App() {
  const {
    page, setPage,
    biosMode, setBiosMode,
    builderOpen, openBuilder, closeBuilder,
    mobilOpen, openMobil, closeMobil,
  } = useAppState('dashboard')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'dirty'>('idle')
  const [saveClick, setSaveClick] = useState<(() => void) | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
   const [builderInitial, setBuilderInitial] = useState<{ type: any; id: string | number; extra?: string; prefill?: any } | null>(null)

  useEffect(() => {
    const handler = (e: any) => {
      const { type, id, extra, raw } = e.detail || {}
      const typeMap: Record<string, string> = { agents: 'agent', mcp: 'mcp', skills: 'skill', cli: 'cli', teams: 'team', workflows: 'workflow', loops: 'loop', api: 'api' }
      const builderType = (typeMap[type] || type || 'agent') as any
      const prefillBase: any = { _editId: id, _extra: extra, _raw: raw }
      if (extra && extra.includes('.json')) {
        fetch(`http://localhost:3001/api/tmp?path=${encodeURIComponent(extra)}`)
        .then(r => r.json())
        .then(j => setBuilderInitial({ type: builderType, id, extra, prefill: j }))
        .catch(() => setBuilderInitial({ type: builderType, id, extra, prefill: prefillBase }))
        openBuilder()
        if (builderType === 'agent') setPage('agenti' as any)
        if (builderType === 'mcp') setPage('mcp' as any)
        return
      }
      setBuilderInitial({ type: builderType, id, extra, prefill: prefillBase })
      openBuilder()
      const pageMap: Record<string, string> = { agent: 'agenti', mcp: 'mcp', skill: 'skills', cli: 'cli', team: 'tym', workflow: 'workflows', loop: 'loops', api: 'api' }
      if (pageMap[builderType]) setPage(pageMap[builderType] as any)
    }
    window.addEventListener('loyo:open-builder', handler as any)
    return () => window.removeEventListener('loyo:open-builder', handler as any)
  }, [])

  useEffect(() => {
    const title = PAGE_TITLES[page] || 'LOYO OS'
    const fullTitle = `${title} • LOYO OS${biosMode? ' • TRUE BIOS' : ''}`
    document.title = fullTitle
    if ((window as any).__TAURI__) {
      import('@tauri-apps/api/window')
       .then(({ getCurrentWindow }) => {
          getCurrentWindow().setTitle(fullTitle)
        })
       .catch(() => {})
    }
  }, [page, biosMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveStatus === 'dirty') saveClick?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveStatus, saveClick])

  const handleManifestComplete = async (type: string, manifest: object) => {
    try {
      await fetch('http://localhost:3001/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, manifest }),
      })
    } catch (err) {
      console.error('[Builder] Nepodařilo se uložit manifest:', err)
    }
  }

  const currentPageNode = useMemo(() => {
    switch (page) {
      case 'dashboard': return <Dashboard />
      case 'kalendar': return <Calendar />
      case 'activity': return <Activity />
      case 'notes': return <Notes />
      case 'tasks': return <Tasks />
      case 'tym': return <Team />
      case 'agenti': return <Agents />
      case 'skills': return <Skills />
      case 'mcp': return <Mcp />
      case 'loops': return <Loops />
      case 'api': return <Api />
      case 'workflows': return <Workflows />
      case 'cli': return <Cli />
      case 'general': return <General />
      default: return <Dashboard />
    }
  }, [page])

  return (
    <SaveStatusContext.Provider value={{ status: saveStatus, setStatus: setSaveStatus, onSaveClick: saveClick, setOnSaveClick: (fn) => setSaveClick(() => fn), lastSavedAt, setLastSavedAt }}>
    <div className="relative min-h-screen">
      <Background biosMode={biosMode} />
      <Layout
        page={page}
        setPage={setPage}
        biosMode={biosMode}
        setBiosMode={setBiosMode}
        onOpenBuilderMenu={openBuilder}
        onOpenMobil={openMobil}
      >
        <Suspense fallback={<PageLoader />}>
          {currentPageNode}
        </Suspense>
      </Layout>

      <Builder
        onManifestComplete={handleManifestComplete}
        focused={builderOpen}
        externalOpen={builderOpen}
        onExternalClose={closeBuilder}
        initialRequest={builderInitial}
        onInitialConsumed={() => setBuilderInitial(null)}
      />
    </div>
    </SaveStatusContext.Provider>
  )
}
