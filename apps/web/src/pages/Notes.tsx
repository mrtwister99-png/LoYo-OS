import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFileBackedList, slugify } from '../hooks/useFileBackedList'
import { JA_POZNAMKY_DIR, getNotesPath } from '../lib/dataPaths'
import { useSaveStatus } from '../hooks/useSaveStatus'

type Note = {
  file_name: string
  file_path: string
  title: string
  content: string
  created_at: string
}

export default function Notes() {
  const NOTES_DIR = JA_POZNAMKY_DIR // KONVENCE v3 - relativně vůči DATA_DIR, Rust řeší LOYO_DATA_DIR, žádný D:/ hardcode

  const {
    items: notes, selectedId, setSelectedId,
    isTauri, saving, setSaving, status, setStatus, lastSync,
    persist, createItem, deleteItem,
  } = useFileBackedList<Note>(NOTES_DIR, { list: 'list_notes', save: 'save_note', del: 'delete_note' }, 'loyo-notes')

  const [search, setSearch] = useState('')
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const isDirtyRef = useRef(false)
  const safeSetSelectedId = useCallback((id: string) => {
    if (isDirtyRef.current) {
      if (!confirm('Máš neuložené změny. Zahodit?')) return;
      isDirtyRef.current = false;
    }
    setSelectedId(id);
  }, [])
  // ÚKOL 13: auto-save - stav a debounce ref
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<number | null>(null)
  const skipNextAutoSaveRef = useRef(false)
  const { setStatus: setGlobalStatus, setOnSaveClick } = useSaveStatus()

  useEffect(() => {
    const sel = notes.find((n: Note) => n.file_name === selectedId)
    if (sel) {
      skipNextAutoSaveRef.current = true
      setEditingTitle(sel.title)
      setEditingContent(sel.content.replace(/^#.*\n\n?/, ''))
      setAutoSaveState('idle')
    }
  }, [selectedId, notes])

  // ÚKOL 13: debounce 800ms -> PUT /api/notes/:id via persist
  useEffect(() => {
    const sel = notes.find((n: Note) => n.file_name === selectedId)
    if (!sel) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }
    const titleClean = editingTitle.trim() || 'Bez názvu'
    const bodyClean = editingContent.replace(/^#.*\n\n?/, '')
    const originalBody = sel.content.replace(/^#.*\n\n?/, '')
    if (titleClean === sel.title && bodyClean === originalBody) return
    setAutoSaveState('saving')
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const newContent = `# ${titleClean}\n\n${bodyClean}`
        await persist(sel, newContent, { title: titleClean } as Partial<Note>)
        setAutoSaveState('saved')
        setStatus(isTauri? `✓ Auto uloženo: ${sel.file_name}` : '✓ Auto uloženo (localStorage)')
        window.setTimeout(() => setAutoSaveState('idle'), 5000)
      } catch (e) {
        setAutoSaveState('idle')
        setStatus(`Chyba auto-save: ${e}`)
      }
    }, 800)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [editingTitle, editingContent])

  const filtered = useMemo(() => {
    if (!search) return notes
    return notes.filter((n: Note) =>
      `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase())
    )
  }, [notes, search])

  const selected = notes.find((n: Note) => n.file_name === selectedId)

  const isDirty = useMemo(() => {
    if (!selected) return false
    const body = selected.content.replace(/^#.*\n\n?/, '')
    const titleClean = editingTitle.trim() || 'Bez názvu'
    const bodyClean = editingContent.replace(/^#.*\n\n?/, '')
    return titleClean!== selected.title || bodyClean!== body
  }, [selected, editingTitle, editingContent])

  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [])

  useEffect(() => {
    if (isDirty) setGlobalStatus('dirty')
    else if (autoSaveState === 'saving') setGlobalStatus('saving')
    else if (autoSaveState === 'saved') setGlobalStatus('saved')
    else setGlobalStatus('idle')
    return () => setGlobalStatus('idle')
  }, [isDirty, autoSaveState])

  useEffect(() => {
    setOnSaveClick(() => handleSave)
  }, [editingTitle, editingContent])

  const handleSave = useCallback(async () => {
    if (!selected) return
    setSaving(true)
    setAutoSaveState('saving')
    const titleClean = editingTitle.trim() || 'Bez názvu'
    const bodyClean = editingContent.replace(/^#.*\n\n?/, '')
    const newContent = `# ${titleClean}\n\n${bodyClean}`
       try {
      await persist(selected, newContent, { title: titleClean } as Partial<Note>)
      setAutoSaveState('saved')
      setStatus(isTauri? `✓ Uloženo: ${selected.file_name}` : '✓ Uloženo (localStorage)')
      window.setTimeout(() => setAutoSaveState('idle'), 2000)
    } catch (e) {
      setAutoSaveState('idle')
      setStatus(`Chyba: ${e}`)
    }
    setSaving(false)
  }, [selected, editingTitle, editingContent, saving])

  const handleNew = async () => {
    const title = 'Nová poznámka'
    const timestamp = Date.now()
    const fileName = `${timestamp}_poznamka_${slugify(title)}.md`
    const filePath = getNotesPath(fileName)
    const today = new Date().toISOString().slice(0, 10)
    const newNote: Note = {
      file_name: fileName,
      file_path: filePath,
      title,
      content: `# ${title}\n\nZačni psát...`,
      created_at: today
    }
    await createItem(newNote)
  }

  const handleDelete = async () => {
    if (!selected || !confirm(`Smazat "${selected.title}"?`)) return
    await deleteItem(selected)
  }

  return (
    <div className="min-h-full bg-[#F8F6F1]/80 p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <div className="mono text-[10px] tracking-[0.3em] text-black/40">
              LOYO OS • NOTES • {notes.length} SOUBORŮ • {isTauri ? 'TAURI FS' : 'LOCAL MOCK'}
            </div>
            <h1 className="text-5xl font-black tracking-tighter mt-2">Poznámky</h1>
            <div className="text-sm text-black/50 mt-2 flex flex-wrap gap-2 items-center">
              <span>{filtered.length} z {notes.length} • ukládá se do</span>
              <span className="font-mono text-[11px] bg-white border border-black/10 px-2.5 py-1 rounded-full">
                {NOTES_DIR}
              </span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full ${isTauri ? 'bg-[#00D084] text-black' : 'bg-[#FF3B30] text-white'}`}>
                {isTauri ? '✓ napojeno na disk' : '× spusť pnpm tauri dev'}
              </span>
              {lastSync && <span className="text-[10px] mono text-black/30">poslední sync: {lastSync.toLocaleTimeString()}</span>}
            </div>
            {status && <div className="mt-2 text-[11px] mono bg-black text-white px-3 py-1.5 rounded-full inline-block">{status}</div>}
          </div>
          <div className="flex gap-3 items-center">
            <div className={`w-2 h-2 rounded-full ${isTauri ? 'bg-[#00D084] animate-pulse' : 'bg-[#FF3B30]'}`} />
            <button onClick={handleNew} className="bg-black text-white px-6 py-3 rounded-[12px] text-[11px] font-black tracking-[0.2em] hover:bg-zinc-900 transition">+ NOVÁ POZNÁMKA</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-[16px] p-6 border border-black/[0.06]">
            <div className="mono text-[10px] tracking-widest text-black/30">CELKEM POZNÁMEK</div>
            <div className="text-4xl font-black mt-3">{notes.length}</div>
            <div className="text-[11px] text-black/40 mt-1">{filtered.length} vyfiltrováno • {isTauri ? 'soubory na disku' : 'localStorage'}</div>
          </div>
          <div className="bg-black text-white rounded-[16px] p-6">
            <div className="mono text-[10px] tracking-widest text-white/30">STORAGE • TAURI BACKEND</div>
            <div className="text-[13px] font-bold mt-3 font-mono leading-tight break-all">{NOTES_DIR}/</div>
            <div className="text-[11px] text-white/50 mt-2 flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${isTauri ? 'bg-[#00D084]' : 'bg-[#FF3B30]'}`} />{isTauri ? 'FS napojen • Rust fs::write' : 'Mock localStorage'}</div>
          </div>
          <div className="bg-white rounded-[16px] p-6 border border-black/[0.06]">
            <div className="mono text-[10px] tracking-widest text-black/30">AKTIVNÍ SOUBOR</div>
            <div className="text-[14px] font-black mt-3 truncate">{selected?.title || '—'}</div>
            <div className="text-[11px] text-black/40 mt-1 mono truncate">{selected?.file_name} • {selected?.created_at}</div>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-4">
            <div className="bg-white rounded-[16px] border border-black/[0.06] p-4">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat v poznámkách..." className="w-full px-4 py-3 bg-[#F8F6F1] border border-black/[0.06] rounded-[10px] text-[13px] outline-none focus:border-black focus:bg-white transition placeholder:text-black/20" />
            </div>
            <div className="bg-white rounded-[16px] border border-black/[0.06] overflow-hidden">
              <div className="p-4 border-b border-black/[0.06] flex justify-between items-center"><span className="mono text-[10px] tracking-[0.3em] text-black/30">SEZNAM • {filtered.length}</span><span className="text-[10px] opacity-30">.md</span></div>
                            <div className="max-h- overflow-y-auto divide-y divide-black/[0.04]">
                {filtered.length === 0? <div className="p-8 text-center text- text-black/30 mono">Žádné poznámky</div> : filtered.map((note: Note) => {
                  const isActive = note.file_name === selectedId
                  return <div key={note.file_name} onClick={() => safeSetSelectedId(note.file_name)} className={`p-5 cursor-pointer transition hover:bg-[#F8F6F1] ${isActive? 'bg-black text-white hover:bg-black' : 'bg-white'}`}><div className="font-bold text- leading-tight line-clamp-1">{note.title}</div><div className={`text- mt-2 line-clamp-2 leading-relaxed ${isActive? 'text-white/60' : 'text-black/50'}`}>{note.content.replace(/^#.*\n\n?/, '').slice(0, 120)}</div><div className={`mono text- mt-3 ${isActive? 'text-white/30' : 'text-black/30'}`}>{note.created_at} • {note.file_name}</div></div>
                })}
              </div>
            </div>
          </div>
          <div className="col-span-8">
            {selected ? <div className="bg-white rounded-[20px] border border-black/[0.06] overflow-hidden flex flex-col min-h-[70vh] shadow-[0_20px_60px_rgba(0,0,0,0.04)]"><div className="p-8 border-b border-black/[0.06]"><div className="flex justify-between items-start gap-4"><input value={editingTitle} onChange={e => setEditingTitle(e.target.value)} placeholder="Název poznámky" className="w-full text-4xl font-black tracking-tighter bg-transparent outline-none placeholder:opacity-20" /><span className="mono text-[10px] px-2.5 py-1 rounded-full border border-black/10 bg-white flex items-center gap-1.5 shrink-0 mt-2"><span className={`w-2 h-2 rounded-full ${autoSaveState === 'saving'? 'bg-[#FFC700] animate-pulse' : autoSaveState === 'saved'? 'bg-[#00D084]' : 'bg-black/20'}`} /><span>{autoSaveState === 'saving'? '🟡 ukládám' : autoSaveState === 'saved'? '🟢 uloženo' : '• idle'}</span></span></div><div className="mt-3 flex gap-2 mono text-[11px] text-black/40"><span className="px-2.5 py-1 bg-[#F8F6F1] rounded-full border border-black/[0.06] truncate max-w-[340px]">{selected.file_path}</span><span className="px-2.5 py-1 bg-black text-white rounded-full">{selected.created_at}</span></div></div><textarea value={editingContent} onChange={e => setEditingContent(e.target.value)} placeholder="Obsah... markdown" className="flex-1 w-full p-8 text-[14px] leading-[1.7] bg-transparent outline-none resize-none min-h-[420px] font-mono placeholder:opacity-30" /><div className="p-5 border-t border-black/[0.06] flex justify-between items-center bg-[#F8F6F1]"><button onClick={handleDelete} className="text-[11px] px-4 py-2 rounded-full border border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition font-bold tracking-widest">SMAZAT</button><div className="flex gap-3 items-center"><span className="mono text-[10px] flex items-center gap-2"><span className={`w-2 h-2 rounded-full inline-block ${autoSaveState === 'saving'? 'bg-[#FFC700] animate-pulse' : autoSaveState === 'saved'? 'bg-[#00D084]' : 'bg-black/20'}`} /><span className="opacity-40">{autoSaveState === 'saving'? '🟡 ukládám...' : autoSaveState === 'saved'? '🟢 uloženo' : saving? 'Ukládám...' : isTauri? 'Uloží se na disk • Rust FS' : 'localStorage'}</span></span><button onClick={handleSave} disabled={saving} className="px-8 py-3 bg-black text-white text-[11px] font-black tracking-[0.2em] rounded-[12px] hover:bg-zinc-900 disabled:opacity-30 transition">{saving ? '...' : 'ULOŽIT'}</button></div></div></div> : <div className="bg-white rounded-[20px] border border-dashed border-black/10 min-h-[70vh] flex items-center justify-center"><div className="text-center"><div className="text-[48px] font-black text-black/10">∅</div><div className="mt-4 text-[14px] text-black/30 mono">{notes.length === 0 ? 'Žádné poznámky • klikni + NOVÁ' : 'Vyber poznámku vlevo'}</div></div></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
