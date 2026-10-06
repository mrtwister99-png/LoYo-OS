import { useState, useEffect } from 'react'
import type { BuilderProps } from '../Builder'
import AgentBuilder from './AgentBuilder'
import { categoryNumbers } from '../../styles/theme'
type ExtendedProps = BuilderProps & { initialData?: any; prefill?: any }
export default function TeamBuilder({ onComplete, initialData, prefill }: ExtendedProps) {
  const editSource = (prefill as any) || (initialData as any) || {}
  const [form, setForm] = useState({
    displayName: '', id: '', description: '',
    members: '', coordination: 'sequential', sharedMemory: '', tags: '',
  })
  const [isEditMode, setIsEditMode] = useState(false)

  // ÚKOL 25: existující agenti jako zaškrtávací seznam + možnost vytvořit nového
  const [agents, setAgents] = useState<{ id: string; displayName?: string; number?: number }[]>([])
  const [showNewAgent, setShowNewAgent] = useState(false)
  const loadAgents = () => {
    fetch('http://localhost:3001/api/capabilities?type=agent')
      .then(r => (r.ok? r.json() : null))
      .then(d => {
        const list = (d?.capabilities || []) as any[]
        setAgents(list.map(a => ({ id: a.id, displayName: a.displayName, number: a.number })).sort((a, b) => (a.number ?? 999) - (b.number ?? 999)))
      })
      .catch(() => {})
  }
  useEffect(() => { loadAgents() }, [])
  const memberList = () => form.members.split(',').map(s => s.trim()).filter(Boolean)
  const toggleMember = (id: string) => {
    const cur = memberList()
    const next = cur.includes(id)? cur.filter(m => m !== id) : [...cur, id]
    setForm(f => ({ ...f, members: next.join(', ') }))
  }
  // nový agent z AgentBuilderu: uloží se a rovnou přidá do týmu
  const handleNewAgent = async (manifest: any) => {
    try {
      const res = await fetch('http://localhost:3001/api/capabilities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'agent', manifest }),
      })
      if (res.status === 409) { window.alert(`Agent "${manifest?.id}" už existuje – zaškrtni ho v seznamu.`); setShowNewAgent(false); return }
      if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(`Chyba: ${d.error || res.status}`); return }
      setForm(f => ({ ...f, members: [...f.members.split(',').map(s => s.trim()).filter(Boolean), manifest.id].join(', ') }))
      loadAgents()
      setShowNewAgent(false)
    } catch { window.alert('API neodpovídá (localhost:3001).') }
  }
  useEffect(() => {
    const raw = editSource?._extra || editSource?._editId
    if (!raw) return
    let targetId = typeof raw === 'string'? raw : null
    if (!targetId) return
    const load = async () => {
      try {
        const r = await fetch(`http://localhost:3001/api/capabilities/${targetId}`); if (r.ok) { const d = await r.json(); setForm({ displayName: d.displayName||targetId, id: d.id||targetId, description: d.description||'', members: (d.members||[]).join(', '), coordination: d.coordination||'sequential', sharedMemory: d.sharedMemory||'', tags: (d.tags||[]).join(', ') }); setIsEditMode(true) }
      } catch {}
    }; load()
  }, [editSource?._extra, editSource?._editId])

  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => {
    const n = { ...f, [k]: v }
    if (k === 'displayName') n.id = toKebab(v)
    return n
  })

  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => (
    <div className="mb-4">
      <label className="block text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>
      {children}
    </div>
  )

  const handleSubmit = () => {
    onComplete({
      id: form.id, type: 'team', displayName: form.displayName,
      version: '1.0.0', status: 'draft', description: form.description,
      runtime: 'composite', entrypoint: './manifest.json',
      members: form.members.split(',').map(s => s.trim()).filter(Boolean),
      coordination: form.coordination,
      sharedMemory: form.sharedMemory || undefined,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
  }

  // krok „nový agent": AgentBuilder uvnitř týmového builderu
  if (showNewAgent) {
    return (
      <div>
        <button type="button" onClick={() => setShowNewAgent(false)} className="mb-4 text-[10px] tracking-[0.2em] text-white/50 hover:text-white">← ZPĚT NA TÝM</button>
        <AgentBuilder onComplete={handleNewAgent} />
      </div>
    )
  }

  return (
    <div className="text-white">
      {isEditMode && <div className="mb-4 px-3 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text- tracking-[0.2em] text-[#f5c518] font-bold">EDIT MÓD: #{editSource?._editId} {editSource?._extra}</div>}
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Obchodní tým" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="MEMBERS — agenti v týmu (0 nebo víc)">
        <div className="space-y-1 max-h-40 overflow-y-auto border border-white/10 p-2">
          {agents.length === 0 && <div className="text-[10px] text-white/30">Žádní agenti nenačteni</div>}
          {agents.map(a => (
            <label key={a.id} className="flex items-center gap-2 text-xs font-mono cursor-pointer">
              <input type="checkbox" checked={memberList().includes(a.id)} onChange={() => toggleMember(a.id)} />
              <span className="px-1.5 bg-white/10 text-white/70" style={{ fontSize: 10 }}>{categoryNumbers.agent}-{String(a.number ?? 0).padStart(2, '0')}</span>
              {a.displayName || a.id}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setShowNewAgent(true)} className="px-3 py-1.5 border border-[#f5c518]/50 text-[#f5c518] text-[10px] font-bold tracking-[0.2em] hover:bg-[#f5c518]/10">+ VYTVOŘIT NOVÉHO AGENTA</button>
        </div>
        <input className={inputCls + ' mt-2'} value={form.members} onChange={e => set('members', e.target.value)} placeholder="nebo ručně: lubor-nehleda, julia-nehledalova" />
      </Field>
      <Field label="COORDINATION">
        <select className={inputCls + " cursor-pointer"} value={form.coordination} onChange={e => set('coordination', e.target.value)}>
          {['sequential','parallel','router','debate'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="SHARED MEMORY (RAG ID, volitelné)">
        <input className={inputCls} value={form.sharedMemory} onChange={e => set('sharedMemory', e.target.value)} placeholder="leads-db" />
      </Field>
      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={handleSubmit} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
