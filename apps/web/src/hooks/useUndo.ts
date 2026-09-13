import { useEffect, useState, useCallback, useRef } from 'react'

// ÚKOL 19: Undo pro poznámky/tasks
// Každý save uloží předchozí verzi do data/history/notes/:id/:timestamp.md
// Ctrl+Z vrátí

type FileType = 'notes' | 'tasks'

export function useUndo(
  fileName: string | null,
  fileType: FileType,
  onRestore: (content: string) => void
) {
  const [canUndo, setCanUndo] = useState(false)
  const [historyCount, setHistoryCount] = useState(0)
  const fileNameRef = useRef(fileName)
  useEffect(() => { fileNameRef.current = fileName }, [fileName])

  const checkHistory = useCallback(async () => {
    const current = fileNameRef.current
    if (!current) {
      setCanUndo(false)
      setHistoryCount(0)
      return
    }
    try {
      const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        const list = await invoke<string[]>('list_history_versions', {
          fileName: current,
          fileType,
        })
        setHistoryCount(list.length)
        setCanUndo(list.length > 0)
      } else {
        const key = `loyo-history-${fileType}-${current}`
        const raw = localStorage.getItem(key)
        const arr = raw ? JSON.parse(raw) : []
        setHistoryCount(arr.length)
        setCanUndo(arr.length > 0)
      }
    } catch {
      setCanUndo(false)
    }
  }, [fileType])

  const saveToHistoryWeb = useCallback((oldContent: string) => {
    const current = fileNameRef.current
    if (!current || !oldContent) return
    const key = `loyo-history-${fileType}-${current}`
    const raw = localStorage.getItem(key)
    const arr = raw ? JSON.parse(raw) : []
    arr.push({
      timestamp: new Date().toISOString(),
      content: oldContent,
    })
    // limit 50 verzí
    const trimmed = arr.slice(-50)
    localStorage.setItem(key, JSON.stringify(trimmed))
    setHistoryCount(trimmed.length)
    setCanUndo(true)
  }, [fileType])

  const undo = useCallback(async () => {
    const current = fileNameRef.current
    if (!current) return null
    try {
      const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        const content = await invoke<string>('restore_history_version', {
          fileName: current,
          fileType,
          timestampFile: null, // vezme nejnovější
        })
        onRestore(content)
        await checkHistory()
        return content
      } else {
        const key = `loyo-history-${fileType}-${current}`
        const raw = localStorage.getItem(key)
        const arr = raw ? JSON.parse(raw) : []
        if (arr.length === 0) return null
        const last = arr[arr.length - 1]
        onRestore(last.content)
        localStorage.setItem(key, JSON.stringify(arr.slice(0, -1)))
        setHistoryCount(arr.length - 1)
        setCanUndo(arr.length - 1 > 0)
        return last.content
      }
    } catch (e) {
      console.error('Undo failed', e)
      return null
    }
  }, [fileType, onRestore, checkHistory])

 
   const restoreSpecific = useCallback(async (specificFileName: string) => {
    try {
      const isTauri = typeof window!== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        const content = await invoke<string>('restore_history_version', { fileName: specificFileName, fileType, timestampFile: null })
        return content
      } else {
        const key = `loyo-history-${fileType}-${specificFileName}`
        const raw = localStorage.getItem(key)
        const arr = raw? JSON.parse(raw) : []
        if (arr.length === 0) return null
        const last = arr[arr.length - 1]
        localStorage.setItem(key, JSON.stringify(arr.slice(0, -1)))
        return last.content as string
      }
    } catch { return null }
  }, [fileType])

  // kontrola při změně souboru
  useEffect(() => {
    checkHistory()
  }, [fileName, checkHistory])

  return { canUndo, historyCount, undo, checkHistory, saveToHistoryWeb, restoreSpecific }
}