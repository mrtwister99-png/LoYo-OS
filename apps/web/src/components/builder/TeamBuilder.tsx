import { useState } from 'react'
import type { BuilderProps } from '../Builder'

export default function TeamBuilder({ onComplete }: BuilderProps) {
  const [form, setForm] = useState({
    displayName: '', id: '', description: '',
    members: '', coordination: 'sequential', sharedMemory: '', tags: '',
  })

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

  return (
    <div className="text-white">
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Obchodní tým" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="MEMBERS — capability IDs (čárkou)">
        <input className={inputCls} value={form.members} onChange={e => set('members', e.target.value)} placeholder="lubor-nehleda, julia-nehledalova" />
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
