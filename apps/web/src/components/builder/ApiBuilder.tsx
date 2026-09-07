import { useState } from 'react'
import type { BuilderProps } from '../Builder'

export default function ApiBuilder({ onComplete }: BuilderProps) {
  const [form, setForm] = useState({ displayName: '', id: '', description: '', entrypoint: './src/routes', baseUrl: '', tags: '' })
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = { ...f, [k]: v }; if (k === 'displayName') n.id = toKebab(v); return n })
  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>{children}</div>

  return (
    <div className="text-white">
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="ARES API" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="ENTRYPOINT"><input className={inputCls} value={form.entrypoint} onChange={e => set('entrypoint', e.target.value)} /></Field>
      <Field label="BASE URL"><input className={inputCls} value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)} placeholder="https://ares.gov.cz/ekonomicke-subjekty-v-be/rest" /></Field>
      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'skill', displayName: form.displayName, version: '1.0.0', status: 'draft', description: form.description, runtime: 'node', entrypoint: form.entrypoint, pure: false, tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
