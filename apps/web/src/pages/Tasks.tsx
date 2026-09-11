import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { JA_UKOLY_AKTIVNI_DIR, JA_UKOLY_HOTOVE_DIR, getTasksPath } from '../lib/dataPaths'
import { useSaveStatus } from '../hooks/useSaveStatus'

type Task = {
  file_name: string
  file_path: string
  title: string
  content: string
  done: boolean
  created_at: string
}

const slugify = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'bez-nazvu'

const TaskRow = memo(function TaskRow({ task, isActive, onSelect, onToggle, stripHeader }: { task: Task; isActive: boolean; onSelect: (id: string) => void; onToggle: (t: Task) => void; stripHeader: (c: string) => string }) {
  return (
    <div onClick={() => onSelect(task.file_name)} className={`p-5 cursor-pointer transition hover:bg-[#F8F6F1] flex gap-3 items-start ${isActive? 'bg-black text-white hover:bg-black' : 'bg-white'}`}>
      <input type="checkbox" checked={task.done} onClick={e => e.stopPropagation()} onChange={() => onToggle(task)} className="mt-1 w-4 h-4 accent-[#00D084] cursor-pointer flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-[14px] leading-tight line-clamp-1 ${task.done? 'line-through opacity-50' : ''}`}>{task.title}</div>
        <div className={`text-[12px] mt-2 line-clamp-2 leading-relaxed ${isActive? 'text-white/60' : 'text-black/50'}`}>{stripHeader(task.content).slice(0, 120)}</div>
        <div className={`mono text-[10px] mt-3 ${isActive? 'text-white/30' : 'text-black/30'}`}>{task.created_at} • {task.file_name}</div>
      </div>
    </div>
  )
})

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const isDirtyRef = useRef(false)
  const [search, setSearch] = useState('')
  const [filterDone, setFilterDone] = useState<'all' | 'open' | 'done'>('open')
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [editingDone, setEditingDone] = useState(false)
  const [isTauri, setIsTauri] = useState(false)
  const [saving, setSaving] = useState(false)
  // auto-save Tasks
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<number | null>(null)
  const skipNextAutoSaveRef = useRef(false)
  const [status, setStatus] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tasksRef = useRef<Task[]>([])
  const selectedIdRef = useRef<string>('')
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const ACTIVE_DIR = JA_UKOLY_AKTIVNI_DIR
  const DONE_DIR = JA_UKOLY_HOTOVE_DIR
  const { setStatus: setGlobalStatus, setOnSaveClick } = useSaveStatus()

  const buildContent = (title: string, done: boolean, body: string) => `# ${title || 'Bez názvu'}\n\n**Hotovo:** ${done}\n\n${body}`
  const stripHeader = (content: string) => content.replace(/^#.*\n\n?/, '').replace(/^\*\*Hotovo:\*\*.*\n\n?/, '')

  useEffect(() => {
    const checkTauri = async () => {
      const hasTauri = typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
      setIsTauri(hasTauri)
      if (hasTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('ensure_dir', { path: ACTIVE_DIR })
          await invoke('ensure_dir', { path: DONE_DIR })
          await loadTasks()
        } catch (e) { setStatus(`Chyba: ${e}`) }
      } else {
        const saved = localStorage.getItem('loyo-tasks')
        if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) { setTasks(parsed); setSelectedId(parsed[0].file_name) } } catch {} }
        setStatus('Web mód • localStorage')
      }
    }
    checkTauri()
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (debounceRef.current) { window.clearTimeout(debounceRef.current as any); }
    }
  }, [])

  const loadTasks = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<Task[]>('list_tasks_multi', { dirs: [ACTIVE_DIR, DONE_DIR] })
      if (list.length > 0) {
        setTasks(list)
        if (!selectedIdRef.current || !list.find(t => t.file_name === selectedIdRef.current)) setSelectedId(list[0].file_name)
        setLastSync(new Date())
        setStatus(`✓ Sync: ${list.length} úkolů`)
      } else { setTasks([]); setSelectedId(''); setStatus('Složka prázdná') }
    } catch (e) { console.error('Load error:', e) }
  }

  useEffect(() => {
    if (!isTauri) return
    pollingRef.current = setInterval(async () => {
      if (saving) return
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const list = await invoke<Task[]>('list_tasks_multi', { dirs: [ACTIVE_DIR, DONE_DIR] })
        if (list) {
          const curTasks = tasksRef.current
          const curSel = selectedIdRef.current
          const oldIds = curTasks.map(t => t.file_name).sort().join('|')
          const newIds = list.map(t => t.file_name).sort().join('|')
          const selOnDisk = curSel? list.find(t => t.file_name === curSel) : null
          const selInMem = curTasks.find(t => t.file_name === curSel)
          const countChanged = oldIds!== newIds
          const contentChanged =!!(selOnDisk && selInMem && selOnDisk.content!== selInMem.content)
          if (countChanged || contentChanged) {
            setTasks(list)
            setLastSync(new Date())
            setStatus(`🔄 Auto-sync: ${list.length} úkolů${contentChanged? ' • externí edit' : ''}`)
            if (curSel &&!list.find(t => t.file_name === curSel)) setSelectedId(list.length > 0? list[0].file_name : '')
          }
        }
      } catch {}
    }, 3000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [isTauri])

  useEffect(() => {
    const sel = tasks.find(t => t.file_name === selectedId)
    if (sel) {
      skipNextAutoSaveRef.current = true
      setEditingTitle(sel.title)
      setEditingContent(stripHeader(sel.content))
      setEditingDone(sel.done)
      setAutoSaveState('idle')
    }
  }, [selectedId])

  const filtered = useMemo(() => {
    let list = tasks
    if (filterDone === 'open') list = list.filter(t =>!t.done)
    if (filterDone === 'done') list = list.filter(t => t.done)
    if (search) list = list.filter(t => `${t.title} ${t.content}`.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [tasks, search, filterDone])

  const selected = tasks.find(t => t.file_name === selectedId)
  const isDirty = useMemo(() => {
    if (!selected) return false
    const body = stripHeader(selected.content)
    return editingTitle!== selected.title || editingContent!== body || editingDone!== selected.done
  }, [selected, editingTitle, editingContent, editingDone])

  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])

  const safeSetSelectedId = useCallback((id: string) => {
    if (isDirtyRef.current) {
      if (!confirm('Máš neuložené změny. Zahodit?')) return;
      isDirtyRef.current = false;
    }
    setSelectedId(id);
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [])

  useEffect(() => {
    if (isDirty) setGlobalStatus('dirty')
    else if (saving) setGlobalStatus('saving')
    else setGlobalStatus('idle')
    return () => setGlobalStatus('idle')
  }, [isDirty, saving])

  const checklistItems = useMemo(() => {
    return editingContent.split('\n').map((line, lineIdx) => {
      const m = line.match(/^- \[( |x)\] (.*)$/i)
      if (!m) return null
      return { lineIdx, checked: m[1].toLowerCase() === 'x', text: m[2] }
    }).filter(Boolean) as { lineIdx: number; checked: boolean; text: string }[]
  }, [editingContent])

  const toggleChecklistItem = async (lineIdx: number) => {
    if (!selected) return
    const lines = editingContent.split('\n')
    const line = lines[lineIdx]
    const match = line.match(/^- \[( |x)\] (.*)$/i)
    if (!match) return
    const newChecked = match[1].toLowerCase()!== 'x'
    lines[lineIdx] = `- [${newChecked? 'x' : ' '}] ${match[2]}`
    const newBody = lines.join('\n')
    setEditingContent(newBody)
    const titleClean = editingTitle.trim() || selected.title
    const newContent = buildContent(titleClean, editingDone, newBody)
    try { await persist({...selected, title: titleClean }, newContent) } catch (e) { setStatus(`Chyba: ${e}`) }
  }

  const persist = async (task: Task, newContent: string) => {
    const targetPath = task.file_path || `${ACTIVE_DIR}/${task.file_name}`
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('save_task', { path: targetPath, content: newContent })
      await loadTasks()
    } else {
      const updated = tasks.map(t => t.file_name === task.file_name? {...t, content: newContent } : t)
      setTasks(updated)
      localStorage.setItem('loyo-tasks', JSON.stringify(updated))
    }
  }

  const persistMoved = async (task: Task, newContent: string, newDone: boolean) => {
    const oldPath = task.file_path || `${ACTIVE_DIR}/${task.file_name}`
    const newPath = `${newDone? DONE_DIR : ACTIVE_DIR}/${task.file_name}`
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('save_task', { path: newPath, content: newContent })
      if (newPath!== oldPath) await invoke('delete_task', { path: oldPath })
      await loadTasks()
    } else {
      const updated = tasks.map(t => t.file_name === task.file_name? {...t, content: newContent, done: newDone, file_path: newPath } : t)
      setTasks(updated)
      localStorage.setItem('loyo-tasks', JSON.stringify(updated))
    }
  }

  const toggleDoneQuick = async (task: Task) => {
    const newDone =!task.done
    const body = stripHeader(task.content)
    const newContent = buildContent(task.title, newDone, body)
    try { await persistMoved(task, newContent, newDone); setStatus(`✓ ${newDone? 'Splněno' : 'Vráceno do otevřených'}: ${task.title}`) } catch (e) { setStatus(`Chyba: ${e}`) }
  }

  const handleToggleDone = async () => {
    if (!selected) return
    const newDone =!editingDone
    setEditingDone(newDone)
    const titleClean = editingTitle.trim() || selected.title
    const newContent = buildContent(titleClean, newDone, editingContent)
    try { await persistMoved({...selected, title: titleClean }, newContent, newDone); setStatus(`✓ ${newDone? 'Splněno' : 'Vráceno do otevřených'}: ${titleClean}`) } catch (e) { setStatus(`Chyba: ${e}`) }
  }

  const handleSave = useCallback(async () => {
    if (!selected) return
    if (saving) return
    setSaving(true)
    const titleClean = editingTitle.trim() || 'Bez názvu'
    const newContent = buildContent(titleClean, editingDone, editingContent)
    try { await persist({...selected, title: titleClean }, newContent); setStatus(`✓ Uloženo: ${selected.file_name}`) } catch (e) { setStatus(`Chyba: ${e}`) }
    setSaving(false)
  }, [selected, editingTitle, editingContent, editingDone, saving])

  useEffect(() => { setOnSaveClick(() => handleSave) }, [handleSave])

  const handleNew = async () => {
    const title = 'Nový úkol'
    const timestamp = Date.now()
    const fileName = `${timestamp}_ukol_${slugify(title)}.md`
    const filePath = getTasksPath(fileName, false)
    const today = new Date().toISOString().slice(0, 10)
    const content = buildContent(title, false, 'Popiš, co je potřeba udělat...')
    const newTask: Task = { file_name: fileName, file_path: filePath, title, content, done: false, created_at: today }
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('save_task', { path: filePath, content })
        await loadTasks()
        setSelectedId(fileName)
        setStatus(`✓ Vytvořeno: ${fileName}`)
      } else {
        setTasks([newTask,...tasks]); setSelectedId(fileName); localStorage.setItem('loyo-tasks', JSON.stringify([newTask,...tasks]))
      }
    } catch (e) { setStatus(`Chyba: ${e}`) }
  }

  const handleDelete = async () => {
    if (!selected ||!confirm(`Smazat úkol "${selected.title}"?`)) return
    const targetPath = selected.file_path || `${ACTIVE_DIR}/${selected.file_name}`
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('delete_task', { path: targetPath })
        await loadTasks()
        const remain = tasks.filter(t => t.file_name!== selectedId)
        setSelectedId(remain.length > 0? remain[0].file_name : '')
      } else {
        const remain = tasks.filter(t => t.file_name!== selectedId)
        setTasks(remain); setSelectedId(remain.length > 0? remain[0].file_name : ''); localStorage.setItem('loyo-tasks', JSON.stringify(remain))
      }
      setStatus(`✓ Smazáno: ${selected.file_name}`)
    } catch (e) { setStatus(`Chyba mazání: ${e}`) }
  }

  const openCount = tasks.filter(t =>!t.done).length
  const doneCount = tasks.filter(t => t.done).length

  return (
    <div className="min-h-full bg-[#F8F6F1]/80 p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <div className="mono text-[10px] tracking-[0.3em] text-black/40">LOYO OS • TASKS • {openCount} OTEVŘENÝCH • {isTauri? 'TAURI FS' : 'LOCAL MOCK'}</div>
            <h1 className="text-5xl font-black tracking-tighter mt-2">Úkoly</h1>
            <div className="text-sm text-black/50 mt-2 flex flex-wrap gap-2 items-center">
              <span>{filtered.length} z {tasks.length} • ukládá se do</span>
              <span className="font-mono text-[11px] bg-white border border-black/10 px-2.5 py-1 rounded-full">{ACTIVE_DIR},{DONE_DIR}</span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full ${isTauri? 'bg-[#00D084] text-black' : 'bg-[#FF3B30] text-white'}`}>{isTauri? '✓ napojeno na disk' : '× spusť pnpm tauri dev'}</span>
              {lastSync && <span className="text-[10px] mono text-black/30">poslední sync: {lastSync.toLocaleTimeString()}</span>}
            </div>
            {status && <div className="mt-2 text-[11px] mono bg-black text-white px-3 py-1.5 rounded-full inline-block">{status}</div>}
          </div>
          <div className="flex gap-3 items-center">
            <div className={`w-2 h-2 rounded-full ${isTauri? 'bg-[#00D084] animate-pulse' : 'bg-[#FF3B30]'}`} />
            <button onClick={handleNew} className="bg-black text-white px-6 py-3 rounded-[12px] text-[11px] font-black tracking-[0.2em] hover:bg-zinc-900 transition">+ NOVÝ ÚKOL</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-[16px] p-6 border border-black/[0.06]"><div className="mono text-[10px] tracking-widest text-black/30">OTEVŘENÉ</div><div className="text-4xl font-black mt-3">{openCount}</div><div className="text-[11px] text-black/40 mt-1">čekají na vyřízení</div></div>
          <div className="bg-black text-white rounded-[16px] p-6"><div className="mono text-[10px] tracking-widest text-white/30">HOTOVÉ</div><div className="text-4xl font-black mt-3">{doneCount}</div><div className="text-[11px] text-white/50 mt-1">splněných úkolů celkem</div></div>
          <div className="bg-white rounded-[16px] p-6 border border-black/[0.06]"><div className="mono text-[10px] tracking-widest text-black/30">AKTIVNÍ ÚKOL</div><div className="text-[14px] font-black mt-3 truncate">{selected?.title || '—'}</div><div className="text-[11px] text-black/40 mt-1 mono truncate">{selected?.file_name} • {selected?.created_at}</div></div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-4">
            <div className="bg-white rounded-[16px] border border-black/[0.06] p-4 space-y-3">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat v úkolech..." className="w-full px-4 py-3 bg-[#F8F6F1] border border-black/[0.06] rounded-[10px] text-[13px] outline-none focus:border-black focus:bg-white transition placeholder:text-black/20" />
              <div className="flex gap-2">
                {(['open', 'done', 'all'] as const).map(f => (<button key={f} onClick={() => setFilterDone(f)} className={`flex-1 text-[10px] font-black tracking-widest py-2 rounded-[8px] transition ${filterDone=== f? 'bg-black text-white' : 'bg-[#F8F6F1] text-black/40 hover:text-black/70'}`}>{f=== 'open'? 'OTEVŘENÉ' : f=== 'done'? 'HOTOVÉ' : 'VŠE'}</button>))}
              </div>
            </div>
            <div className="bg-white rounded-[16px] border border-black/[0.06] overflow-hidden">
              <div className="p-4 border-b border-black/[0.06] flex justify-between items-center">
                <span className="mono text-[10px] tracking-[0.3em] text-black/30">SEZNAM • {filtered.length}</span>
                <span className="text-[10px] opacity-30">.md</span>
              </div>
                            <div className="max-h- overflow-y-auto divide-y divide-black/[0.04]">
                {filtered.length=== 0? (<div className="p-8 text-center text- text-black/30 mono">Žádné úkoly</div>) : filtered.map(task => (<TaskRow key={task.file_name} task={task} isActive={task.file_name=== selectedId} onSelect={safeSetSelectedId} onToggle={toggleDoneQuick} stripHeader={stripHeader} />))}
              </div>
            </div>
          </div>

          <div className="col-span-8">
            {selected? (
              <div className="bg-white rounded-[20px] border border-black/[0.06] overflow-hidden flex flex-col min-h-[70vh] shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
                <div className="p-8 border-b border-black/[0.06]">
                  <div className="flex items-center gap-4">
                    <input type="checkbox" checked={editingDone} onChange={handleToggleDone} className="w-6 h-6 accent-[#00D084] cursor-pointer flex-shrink-0" />
                    <input value={editingTitle} onChange={e => setEditingTitle(e.target.value)} placeholder="Název úkolu" className={`w-full text-4xl font-black tracking-tighter bg-transparent outline-none placeholder:opacity-20 ${editingDone? 'line-through opacity-50' : ''}`} />
                  </div>
                  <div className="mt-3 flex gap-2 mono text-[11px] text-black/40">
                    <span className="px-2.5 py-1 bg-[#F8F6F1] rounded-full border border-black/[0.06] truncate max-w-[340px]">{selected.file_path}</span>
                    <span className="px-2.5 py-1 bg-black text-white rounded-full">{selected.created_at}</span>
                    <span className={`px-2.5 py-1 rounded-full ${editingDone? 'bg-[#00D084] text-black' : 'bg-[#FF9500] text-white'}`}>{editingDone? 'HOTOVO' : 'OTEVŘENÉ'}</span>
                  </div>
                </div>
                {checklistItems.length> 0 && (
                  <div className="px-8 pt-6 flex flex-col gap-2 border-b border-black/[0.06] pb-6">
                    <div className="mono text-[10px] tracking-widest text-black/30 mb-1">POLOŽKY • {checklistItems.filter(i => i.checked).length}/{checklistItems.length}</div>
                    {checklistItems.map(item => (<label key={item.lineIdx} className="flex items-center gap-3 text-[14px] cursor-pointer"><input type="checkbox" checked={item.checked} onChange={() => toggleChecklistItem(item.lineIdx)} className="w-5 h-5 accent-[#00D084] cursor-pointer flex-shrink-0" /><span className={item.checked? 'line-through opacity-50' : ''}>{item.text}</span></label>))}
                  </div>
                )}
                <textarea value={editingContent} onChange={e => setEditingContent(e.target.value)} placeholder="Popis úkolu..." className="flex-1 w-full p-8 text-[14px] leading-[1.7] bg-transparent outline-none resize-none min-h-[420px] font-mono placeholder:opacity-30" />
                <div className="p-5 border-t border-black/[0.06] flex justify-between items-center bg-[#F8F6F1]">
                  <button onClick={handleDelete} className="text-[11px] px-4 py-2 rounded-full border border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition font-bold tracking-widest">SMAZAT</button>
                  <div className="flex gap-3 items-center">
                    <span className="mono text-[10px] opacity-40">{saving? 'Ukládám...' : isTauri? 'Uloží se na disk • Rust FS' : 'localStorage'}</span>
                    <button onClick={handleSave} disabled={saving} className="px-8 py-3 bg-black text-white text-[11px] font-black tracking-[0.2em] rounded-[12px] hover:bg-zinc-900 disabled:opacity-30 transition">{saving? '...' : 'ULOŽIT'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[20px] border border-dashed border-black/10 min-h-[70vh] flex items-center justify-center">
                <div className="text-center"><div className="text-5xl font-black text-black/10">∅</div><div className="mt-4 text-sm text-black/30 mono">{tasks.length=== 0? 'Žádné úkoly • klikni + NOVÝ ÚKOL' : 'Vyber úkol vlevo'}</div></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
