import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import { useAppState } from './hooks/useAppState'
import { SaveStatusContext } from './hooks/useSaveStatus'
import Background from './components/Background'
import { Builder } from './components/Builder'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Team from './pages/Team'
// Projekty smazán v3.0
import Agents from './pages/Agents'
import Activity from './pages/Activity'
import Notes from './pages/Notes'
import Tasks from './pages/Tasks'
import Mcp from './pages/Mcp'
import Skills from './pages/Skills'
import Loops from './pages/Loops'
import Api from './pages/Api'
import Workflows from './pages/Workflows'
import Cli from './pages/Cli'

const General = () => <div className="p-10 text-sm opacity-60">General Settings • brzy...</div>

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'DASHBOARD',
  kalendar: 'KALENDÁŘ',
  activity: 'ACTIVITY',
  notes: 'POZNÁMKY',
  tasks: 'ÚKOLY',
  tym: 'TÝM',
  agenti: 'AGENTI',
  // projekty: smazán v3.0
  skills: 'SKILLS',
  mcp: 'MCP',
  cli: 'CLI',
  loops: 'LOOPS',
  api: 'API',
  workflows: 'WORKFLOWS',
  general: 'NASTAVENÍ',
}

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
      // Koštěrad pošle zprávu do chatu — až bude agent hotový
    } catch (err) {
      console.error('[Builder] Nepodařilo se uložit manifest:', err)
    }
  }

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
        {page === 'dashboard' && <Dashboard />}
        {page === 'kalendar' && <Calendar />}
        {page === 'activity' && <Activity />}
        {page === 'notes' && <Notes />}
        {page === 'tasks' && <Tasks />}
        {page === 'tym' && <Team />}
        {page === 'agenti' && <Agents />}
        {/* projekty smazán */}
        {page === 'skills' && <Skills />}
        {page === 'mcp' && <Mcp />}
        {page === 'loops' && <Loops />}
        {page === 'api' && <Api />}
        {page === 'workflows' && <Workflows />}
        {page === 'cli' && <Cli />}
        {page === 'general' && <General />}
      </Layout>

      {/* Builder panel — fixní, nezávislý na stránce */}
      <Builder
        onManifestComplete={handleManifestComplete}
        focused={builderOpen}
        externalOpen={builderOpen}
        onExternalClose={closeBuilder}
      />
    </div>
    </SaveStatusContext.Provider>
  )
}
