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
// Profily L O Y O - dashboards + stránky
const Dashboard2 = lazy(() => import('./pages/profile2/Dashboard2'))
const Dashboard3 = lazy(() => import('./pages/profile3/Dashboard3'))
const Dashboard4 = lazy(() => import('./pages/profile4/Dashboard4'))
const Rozdelane = lazy(() => import('./pages/profile2/Rozdelane'))
const MustHave = lazy(() => import('./pages/profile2/MustHave'))
const Testy = lazy(() => import('./pages/profile2/Testy'))
const KnowledgeBase = lazy(() => import('./pages/profile2/KnowledgeBase'))
const CodingNotes = lazy(() => import('./pages/profile2/CodingNotes'))
const Zapisky = lazy(() => import('./pages/profile3/Zapisky'))
const Projekty = lazy(() => import('./pages/profile3/Projekty'))
const GRNotes = lazy(() => import('./pages/profile4/GRNotes'))
const HeleNevim = lazy(() => import('./pages/profile4/HeleNevim'))
const Shaders = lazy(() => import('./pages/profile4/Shaders'))
const ThreeD = lazy(() => import('./pages/profile4/ThreeD'))

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
  rozdelane: 'ROZDĚLANÉ',
  musthave: 'MUST HAVE',
  testy: 'TESTY',
  knowledgebase: 'KNOWLEDGE BASE',
  zapisky: 'ZÁPISKY',
  projekty: 'PROJEKTY',
  grnotes: 'GR NOTES',
  helenevim: 'HELE NEVIM',
  shaders: 'SHADERS',
  threed: '3D',
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
    activeProfile, setActiveProfile,
  } = useAppState('dashboard')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'dirty'>('idle')
  const [saveClick, setSaveClick] = useState<(() => void) | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
   const [builderInitial, setBuilderInitial] = useState<{ type: any; id: string | number; extra?: string; prefill?: any } | null>(null)

  // hlídání neplatné stránky při switchi profilu – vždy dashboard jako základ
  useEffect(() => {
    const validByProfile: Record<number, string[]> = {
      0: ['dashboard','kalendar','activity','notes','tasks','tym','agenti','skills','mcp','cli','loops','api','workflows','general'],
      1: ['dashboard','rozdelane','musthave','testy','knowledgebase','notes'],
      2: ['dashboard','zapisky','projekty','tym','tasks'],
      3: ['dashboard','grnotes','helenevim','shaders','threed'],
    }
    const valid = validByProfile[activeProfile] || validByProfile[0]
    if (!valid.includes(page as any)) {
      setPage('dashboard' as any)
    }
  }, [activeProfile])

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
    if (page === 'dashboard') {
      if (activeProfile === 1) return <Dashboard2 />
      if (activeProfile === 2) return <Dashboard3 />
      if (activeProfile === 3) return <Dashboard4 />
      return <Dashboard />
    }
    switch (page) {
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
      case 'rozdelane': return <Rozdelane />
      case 'musthave': return <MustHave />
      case 'testy': return <Testy />
      case 'knowledgebase': return <KnowledgeBase />
      case 'zapisky': return <Zapisky />
      case 'projekty': return <Projekty />
      case 'grnotes': return <GRNotes />
      case 'helenevim': return <HeleNevim />
      case 'shaders': return <Shaders />
      case 'threed': return <ThreeD />
      default: return activeProfile === 1? <Dashboard2 /> : activeProfile === 2? <Dashboard3 /> : activeProfile === 3? <Dashboard4 /> : <Dashboard />
    }
  }, [page, activeProfile])

  return (
    <SaveStatusContext.Provider value={{ status: saveStatus, setStatus: setSaveStatus, onSaveClick: saveClick, setOnSaveClick: (fn) => setSaveClick(() => fn), lastSavedAt, setLastSavedAt }}>
    <div className="relative min-h-screen">
      <Background biosMode={biosMode} />
      <Layout
        page={page}
        setPage={setPage}
        activeProfile={activeProfile}
        setActiveProfile={setActiveProfile}
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
