import { useState } from 'react'
import type { BuilderProps } from '../Builder'

export default function RagBuilder({ onComplete }: BuilderProps) {
  const [form, setForm] = useState({ displayName: '', id: '', description: '', embeddingModel: 'nomic-embed-text', chunkSize: 1000, chunkOverlap: 200, sourcePath: '', sourceType: 'dir', tags: '' })
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = { ...f, [k]: v }; if (k === 'displayName') n.id = toKebab(v); return n })
  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>{children}</div>

  return (
    <div className="text-white">
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Leads DB" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="EMBEDDING MODEL"><input className={inputCls} value={form.embeddingModel} onChange={e => set('embeddingModel', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="CHUNK SIZE"><input type="number" className={inputCls} value={form.chunkSize} onChange={e => set('chunkSize', Number(e.target.value))} /></Field>
        <Field label="CHUNK OVERLAP"><input type="number" className={inputCls} value={form.chunkOverlap} onChange={e => set('chunkOverlap', Number(e.target.value))} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <div className="text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">SOURCE TYPE</div>
          <select className={inputCls + " cursor-pointer"} value={form.sourceType} onChange={e => set('sourceType', e.target.value)}>
            {['file','dir','url'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">SOURCE PATH</div>
          <input className={inputCls} value={form.sourcePath} onChange={e => set('sourcePath', e.target.value)} placeholder="data/leads" />
        </div>
      </div>
      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'rag', displayName: form.displayName, version: '1.0.0', status: 'draft', description: form.description, runtime: 'node', entrypoint: './manifest.json', embeddingModel: form.embeddingModel, chunkSize: form.chunkSize, chunkOverlap: form.chunkOverlap, sources: form.sourcePath ? [{ type: form.sourceType, path: form.sourcePath }] : [], tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
