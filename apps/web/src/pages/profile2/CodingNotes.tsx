import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFileBackedList } from '../../hooks/useFileBackedList'
import { JA_CODING_POZNAMKY_DIR, getCodingNotesPath } from '../../lib/dataPaths'
import { useSaveStatus } from '../../hooks/useSaveStatus'
import { useUndo } from '../../hooks/useUndo'
import { profile2Colors } from './themeP2'

type Note = {
  file_name: string
  file_path: string
  title: string
  content: string
  created_at: string
}

type Props = { embedded?: boolean }

export default function CodingNotes({ embedded = false }: Props) {
  const CODING_DIR = JA_CODING_POZNAMKY_DIR

  const {
    items: notes, selectedId, setSelectedId,
    isTauri, saving, setSaving, status, setStatus,
    persist, createItem, deleteItem,
  } = useFileBackedList<Note>(CODING_DIR, { list: 'list_notes', save: 'save_note', del: 'delete_note' }, 'loyo-coding-notes-p2')

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
  }, [setSelectedId])

  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<number | null>(null)
  const skipNextRef = useRef(false)
  const { setStatus: setGlobalStatus } = useSaveStatus()

  useEffect(() => {
    const sel = notes.find(n => n.file_name === selectedId)
    if (sel) {
      skipNextRef.current = true
      setEditingTitle(sel.title)
      setEditingContent(sel.content.replace(/^#.*\n\n?/, ''))
      setAutoSaveState('idle')
    }
  }, [selectedId, notes])

  useEffect(() => {
    const sel = notes.find(n => n.file_name === selectedId)
    if (!sel) return
    if (skipNextRef.current) { skipNextRef.current = false; return }
    const titleClean = editingTitle.trim() || 'Bez názvu'
    const bodyClean = editingContent.replace(/^#.*\n\n?/, '')
    const origBody = sel.content.replace(/^#.*\n\n?/, '')
    if (titleClean === sel.title && bodyClean === origBody) return
    setAutoSaveState('saving')
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const newContent = `# ${titleClean}\n\n${bodyClean}`
        await persist(sel, newContent, { title: titleClean } as Partial<Note>)
        setAutoSaveState('saved')
        setStatus(`✓ Uloženo: ${sel.file_name}`)
        setTimeout(() => setAutoSaveState('idle'), 3000)
      } catch (e) {
        setAutoSaveState('idle')
        setStatus(`Chyba: ${e}`)
      }
    }, 800)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [editingTitle, editingContent])

  const filtered = useMemo(() => {
    if (!search) return notes
    return notes.filter(n => `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase()))
  }, [notes, search])

  const selected = notes.find(n => n.file_name === selectedId)
  const isDirty = useMemo(() => {
    if (!selected) return false
    const body = selected.content.replace(/^#.*\n\n?/, '')
    return editingTitle.trim() !== selected.title || editingContent.replace(/^#.*\n\n?/, '') !== body
  }, [selected, editingTitle, editingContent])

  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])
  useEffect(() => {
    if (isDirty) setGlobalStatus('dirty')
    else if (autoSaveState === 'saving') setGlobalStatus('saving')
    else if (autoSaveState === 'saved') setGlobalStatus('saved')
    else setGlobalStatus('idle')
  }, [isDirty, autoSaveState, setGlobalStatus])

  const handleNew = async () => {
    const fileName = `${Date.now()}_coding_${Math.random().toString(36).slice(2,6)}.md`
    const filePath = getCodingNotesPath(fileName)
    const today = new Date().toISOString().slice(0, 10)
    const newNote: Note = { file_name: fileName, file_path: filePath, title: 'Nová coding poznámka', content: '# Nová coding poznámka\n\n// code here', created_at: today }
    await createItem(newNote)
    setSelectedId(fileName)
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Smazat ${selected.title}?`)) return
    await deleteItem(selected.file_name)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const newContent = `# ${editingTitle}\n\n${editingContent}`
      await persist(selected, newContent, { title: editingTitle } as Partial<Note>)
      setStatus('Uloženo')
    } catch (e) { setStatus(`Chyba: ${e}`) }
    finally { setSaving(false) }
  }

  if (embedded) {
    return (
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-5">
          <div className="flex gap-2 mb-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="hledat coding..." className="flex-1 px-2 py-2 bg-[#ededed] border-2 border-black text-xs outline-none" />
            <button onClick={handleNew} className="px-3 bg-black text-white text-xs font-black border-2 border-black" style={{ background: profile2Colors.accent }}>+ NEW</button>
          </div>
          <div className="max-h-[300px] overflow-auto border-2 border-black divide-y divide-black/10 bg-white">
            {filtered.map(n=>(
              <div key={n.file_name} onClick={()=>safeSetSelectedId(n.file_name)} className={`p-2 cursor-pointer text-xs border-l-4 ${selectedId===n.file_name?'bg-black text-white':'hover:bg-[#ededed] bg-white'}`} style={{ borderLeftColor: profile2Colors.accent }}>
                <div className="font-bold truncate">{n.title}</div>
                <div className="text-[10px] opacity-60 truncate">{n.file_name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-7">
          {selected ? (
            <div className="bg-[#ededed] border-2 border-black p-3">
              <input value={editingTitle} onChange={e=>setEditingTitle(e.target.value)} className="w-full font-black text-sm bg-transparent outline-none mb-2" />
              <textarea value={editingContent} onChange={e=>setEditingContent(e.target.value)} className="w-full h-[200px] text-xs font-mono bg-white border border-black p-2 outline-none resize-none" />
              <div className="flex justify-between mt-2 text-[10px]"><span>{autoSaveState}</span><button onClick={handleSave} className="px-3 py-1 text-white font-bold" style={{ background: profile2Colors.accent }}>ULOŽIT</button></div>
            </div>
          ) : <div className="h-[240px] flex items-center justify-center border-2 border-dashed text-xs opacity-30">Vyber coding note</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-black p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-black text-xs" style={{ color: profile2Colors.accent }}>CODING NOTES • P2 • {notes.length}</h3>
        <button onClick={handleNew} className="px-4 py-2 text-xs font-black text-white border-2 border-black" style={{ background: profile2Colors.accent }}>+ NOVÁ CODING</button>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hledat..." className="w-full px-3 py-2 bg-[#ededed] border-2 border-black text-xs mb-2 outline-none" />
          <div className="divide-y border-2 border-black max-h-[500px] overflow-auto">
            {filtered.map(n=>(
              <div key={n.file_name} onClick={()=>safeSetSelectedId(n.file_name)} className={`p-3 cursor-pointer border-l-4 ${selectedId===n.file_name?'bg-black text-white':'bg-white hover:bg-[#ededed]'}`} style={{ borderLeftColor: profile2Colors.accent }}>
                <div className="font-bold text-xs truncate">{n.title}</div>
                <div className="text-[10px] opacity-60">{n.file_name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-8">
          {selected ? (
            <div className="bg-[#ededed] border-2 border-black p-4 min-h-[400px] flex flex-col">
              <input value={editingTitle} onChange={e=>setEditingTitle(e.target.value)} className="text-lg font-black outline-none bg-transparent mb-2" />
              <textarea value={editingContent} onChange={e=>setEditingContent(e.target.value)} className="flex-1 w-full font-mono text-xs outline-none resize-none min-h-[300px] bg-white border border-black p-3" />
              <div className="flex justify-between mt-3"><button onClick={handleDelete} className="text-[#ac0001] text-xs font-bold">SMAZAT</button><button onClick={handleSave} className="px-6 py-2 text-xs font-black text-white border-2 border-black" style={{ background: profile2Colors.accent }}>ULOŽIT</button></div>
            </div>
          ) : <div className="border-2 border-dashed min-h-[400px] flex items-center justify-center text-xs opacity-30">Vyber poznámku</div>}
        </div>
      </div>
    </div>
  )
}
