import { useState, useEffect } from 'react'

export function useBuilderEdit(editSource: any, type: string) {
  const [loaded, setLoaded] = useState<any>(null)
  const [isEdit, setIsEdit] = useState(false)

  useEffect(() => {
    const rawId = editSource?._extra || editSource?._editId
    if (!rawId) return
    let targetId = typeof rawId === 'string'? rawId : null
    // pro číslo zkus najít podle number v index.json
    const load = async () => {
      try {
        const listRes = await fetch(`http://localhost:3001/api/capabilities?type=${type}`)
        if (listRes.ok) {
          const list = await listRes.json()
          const arr = Array.isArray(list)? list : list.items || list.agents || []
          const found = arr.find((a: any) => a.id === targetId || String(a.number) === String(rawId) || a.folder === targetId)
          if (found) {
            // načti detail manifestu
            const detailRes = await fetch(`http://localhost:3001/api/capabilities/${type}/${found.id || found.folder}`)
            if (detailRes.ok) {
              const detail = await detailRes.json()
              setLoaded(detail.manifest || detail)
              setIsEdit(true)
              return
            }
            setLoaded(found)
            setIsEdit(true)
          }
        }
      } catch {}
    }
    load()
  }, [editSource?._extra, editSource?._editId, type])

  return { loaded, isEdit }
}