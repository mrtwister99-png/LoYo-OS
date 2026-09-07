import { useState } from 'react'
import type { BuilderProps } from '../Builder'

export default function SkillBuilder({ onComplete }: BuilderProps) {
  const [form, setForm] = useState({ displayName: '', id: '', description: '', entrypoint: './dist/index.js', runtime: 'node', pure: true, tags: '' })
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = { ...f, [k]: v }; if (k === 'displayName') n.id = toKebab(v); return n })
  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>{children}</div>

  return (
    <div className="text-white">
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Ares Lookup" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="ENTRYPOINT"><input className={inputCls} value={form.entrypoint} onChange={e => set('entrypoint', e.target.value)} /></Field>
      <Field label="RUNTIME">
        <select className={inputCls + " cursor-pointer"} value={form.runtime} onChange={e => set('runtime', e.target.value)}>
          {['node','python','rust'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => set('pure', !form.pure)} className={`w-10 h-5 rounded-full transition-colors relative ${form.pure ? 'bg-[#f5c518]' : 'bg-white/10'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${form.pure ? 'left-5' : 'left-0.5'}`} />
        </button>
        <span className="text-[11px] text-white/60">PURE (bez vedlejších efektů)</span>
      </div>
      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'skill', displayName: form.displayName, version: '1.0.0', status: 'draft', description: form.description, runtime: form.runtime, entrypoint: form.entrypoint, pure: form.pure, tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
