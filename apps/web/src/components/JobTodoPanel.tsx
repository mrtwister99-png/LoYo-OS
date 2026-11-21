// components/JobTodoPanel.tsx — TODO třetího profilu (Y • JOB) na hlavním dashboardu.
// Zdroje (stejné jako stránky profilu 3): PROJEKTY (localStorage loyo-projekty, stav todo/doing),
// TASKS (loyo-tasks, nedokončené) a JOB poznámky z Dashboard3 (loyo-job-dashboard3).
// Jen čte; „OTEVŘÍT JOB →“ přepne na profil JOB / Projekty.
import { useEffect, useState } from 'react'

type Item = { key: string; title: string; sub: string; tag: 'PROJEKT' | 'TASK' | 'POZNÁMKA'; state?: string }

const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }

function loadItems(): Item[] {
  const projekty = (read('loyo-projekty') as any[]).filter(p => p.status === 'todo' || p.status === 'doing')
    .map(p => ({ key: 'p' + p.id, title: p.name, sub: p.client || '', tag: 'PROJEKT' as const, state: p.status }))
  const tasks = (read('loyo-tasks') as any[]).filter(t => !t.done)
    .map(t => ({ key: 't' + t.file_name, title: t.title || t.file_name, sub: t.created_at || '', tag: 'TASK' as const }))
  const notes = (read('loyo-job-dashboard3') as any[])
    .map(n => ({ key: 'n' + n.id, title: n.title, sub: new Date(n.createdAt).toLocaleDateString('cs-CZ'), tag: 'POZNÁMKA' as const }))
  return [...projekty.sort((a, b) => (a.state === 'doing' ? -1 : 1) - (b.state === 'doing' ? -1 : 1)), ...tasks, ...notes]
}

const TAG_COLOR: Record<Item['tag'], string> = { PROJEKT: '#ff6f00', TASK: '#12a4ff', 'POZNÁMKA': '#9a9a9a' }

export default function JobTodoPanel({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const [items, setItems] = useState<Item[]>(loadItems)
  useEffect(() => {
    const h = () => setItems(loadItems())
    window.addEventListener('storage', h)
    window.addEventListener('focus', h)
    return () => { window.removeEventListener('storage', h); window.removeEventListener('focus', h) }
  }, [])

  return (
    <div className="bg-[#3a3a3a] border border-[#444] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-xs tracking-[0.2em]">📋 TODO • PROFIL Y (JOB) • {items.length}</h3>
        {onOpenProfile && <button onClick={onOpenProfile} className="text-[10px] font-bold px-2 py-1 border border-[#444] hover:bg-[#444]">OTEVŘÍT JOB →</button>}
      </div>
      <div className="mt-3 space-y-1.5 overflow-auto flex-1 min-h-0 pr-1">
        {items.length === 0 && <div className="text-[11px] opacity-50 py-6 text-center">Nic otevřeného — v profilu JOB je čisto.</div>}
        {items.map(it => (
          <div key={it.key} className="flex items-center gap-2 bg-[#2f2f2f] border-l-2 px-3 py-2" style={{ borderLeftColor: TAG_COLOR[it.tag] }}>
            <span className="text-[9px] font-black tracking-widest w-[64px] shrink-0" style={{ color: TAG_COLOR[it.tag] }}>{it.tag}</span>
            <span className="text-[12px] font-bold truncate flex-1">{it.title}</span>
            {it.state && <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#444]">{it.state.toUpperCase()}</span>}
            <span className="text-[10px] font-mono opacity-50 truncate max-w-[90px]">{it.sub}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
