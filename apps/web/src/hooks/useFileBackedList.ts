// D:\dev\loyo-os\apps\web\src\hooks\useFileBackedList.ts
import { useState, useEffect, useRef } from 'react'

export type FileBackedItem = {
  file_name: string
  file_path: string
  content: string
  created_at: string
}

// převede titulek na bezpečnou část názvu souboru (bez diakritiky, mezer, velkých písmen)
export function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'bez-nazvu'
  )
}

type Commands = { list: string; save: string; del: string }

// Sdílená logika pro Notes.tsx a Tasks.tsx: detekce Tauri, čtení/zápis přes Rust invoke,
// fallback na localStorage ve web módu, polling pro auto-sync s diskem.
export function useFileBackedList<T extends FileBackedItem>(
  dir: string,
  commands: Commands,
  localStorageKey: string,
) {
  const [items, setItems] = useState<T[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [isTauri, setIsTauri] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  const loadItems = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<T[]>(commands.list, { dir })
      if (list && list.length > 0) {
        setItems(list)
        setSelectedId(prev => (!prev || !list.find(n => n.file_name === prev)) ? list[0].file_name : prev)
        setLastSync(new Date())
        setStatus(`✓ Sync: ${list.length} souborů`)
      } else {
        setItems([])
        setSelectedId('')
        setStatus('Složka prázdná')
      }
    } catch (e) {
      console.error('Load error:', e)
    }
  }

  useEffect(() => {
    const checkTauri = async () => {
      const hasTauri = typeof window !== 'undefined' &&
        ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
      setIsTauri(hasTauri)
      if (hasTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('ensure_dir', { path: dir })
          await loadItems()
        } catch (e) {
          setStatus(`Chyba: ${e}`)
        }
      } else {
        const saved = localStorage.getItem(localStorageKey)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed.length > 0) {
              setItems(parsed)
              setSelectedId(parsed[0].file_name)
            }
          } catch {}
        }
        setStatus('Web mód • localStorage')
      }
    }
    checkTauri()
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isTauri) return
    pollingRef.current = setInterval(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const list = await invoke<T[]>(commands.list, { dir })
        if (!list) return
        setItems(prevItems => {
          const oldIds = prevItems.map(n => n.file_name).sort().join('|')
          const newIds = list.map(n => n.file_name).sort().join('|')
          const sel = selectedIdRef.current
          const selOnDisk = sel ? list.find(n => n.file_name === sel) : null
          const selInMem = prevItems.find(n => n.file_name === sel)
          const countChanged = oldIds !== newIds
          const contentChanged = !!(selOnDisk && selInMem && selOnDisk.content !== selInMem.content)
          if (countChanged || contentChanged) {
            setLastSync(new Date())
            setStatus(`🔄 Auto-sync: ${list.length} souborů${contentChanged ? ' • externí edit' : ''}`)
            if (sel && !list.find(n => n.file_name === sel)) {
              setSelectedId(list.length > 0 ? list[0].file_name : '')
            }
            return list
          }
          return prevItems
        })
      } catch {}
    }, 3000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTauri])

  // optimisticPatch = okamžitý update v UI bez čekání na plný reload ze souboru (Vylepšení 2)
  const persist = async (item: T, newContent: string, optimisticPatch?: Partial<T>) => {
    const targetPath = item.file_path || `${dir}/${item.file_name}`
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke(commands.save, { path: targetPath, content: newContent })
      if (optimisticPatch) {
        setItems(prev => prev.map(n => n.file_name === item.file_name ? { ...n, content: newContent, ...optimisticPatch } : n))
      } else {
        await loadItems()
      }
    } else {
      setItems(prev => {
        const updated = prev.map(n => n.file_name === item.file_name ? { ...n, content: newContent, ...(optimisticPatch || {}) } : n)
        localStorage.setItem(localStorageKey, JSON.stringify(updated))
        return updated
      })
    }
  }

  const createItem = async (newItem: T) => {
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke(commands.save, { path: newItem.file_path, content: newItem.content })
        await loadItems()
        setSelectedId(newItem.file_name)
        setStatus(`✓ Vytvořeno: ${newItem.file_name}`)
      } else {
        setItems(prev => {
          const updated = [newItem, ...prev]
          localStorage.setItem(localStorageKey, JSON.stringify(updated))
          return updated
        })
        setSelectedId(newItem.file_name)
      }
    } catch (e) {
      setStatus(`Chyba: ${e}`)
    }
  }

  const deleteItem = async (item: T) => {
    const targetPath = item.file_path || `${dir}/${item.file_name}`
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke(commands.del, { path: targetPath })
        await loadItems()
      } else {
        setItems(prev => {
          const remain = prev.filter(n => n.file_name !== item.file_name)
          localStorage.setItem(localStorageKey, JSON.stringify(remain))
          setSelectedId(remain.length > 0 ? remain[0].file_name : '')
          return remain
        })
      }
      setStatus(`✓ Smazáno: ${item.file_name}`)
    } catch (e) {
      setStatus(`Chyba mazání: ${e}`)
    }
  }

  return {
    items, selectedId, setSelectedId,
    isTauri, saving, setSaving, status, setStatus, lastSync,
    persist, createItem, deleteItem,
  }
}
