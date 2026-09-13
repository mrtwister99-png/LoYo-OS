import { useState, useEffect } from 'react'
import type { BuilderProps } from '../Builder'
type ExtendedProps = BuilderProps & { initialData?: any; prefill?: any }
export default function LoopBuilder({ onComplete, initialData, prefill }: ExtendedProps) {
  const editSource = (prefill as any) || (initialData as any) || {}
  const [form, setForm] = useState({ displayName: '', id: '', description: '', schedule: '0 9 * * 1-5', capabilityId: '', retryOnFailure: false, maxRetries: 0, tags: '' })
  const [isEditMode, setIsEditMode] = useState(false)
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = {...f, [k]: v }; if (k === 'displayName') n.id = toKebab(v); return n })
  useEffect(() => {
    const raw = editSource?._extra || editSource?._editId
    if (!raw) return
    let targetId = typeof raw === 'string'? raw : null
    if (!targetId) return
    const load = async () => {
      try {
        const r = await fetch(`http://localhost:3001/api/loops/${targetId}`); if (r.ok) { const data = await r.json(); setForm({ displayName: data.displayName||targetId, id: data.id||targetId, description: data.description||'', schedule: data.schedule||'0 9 * * 1-5', capabilityId: data.action?.capabilityId||'', retryOnFailure: data.retryOnFailure||false, maxRetries: data.maxRetries||0, tags: (data.tags||[]).join(', ') }); setIsEditMode(true) }
      } catch {}
    }; load()
  }, [editSource?._extra, editSource?._editId])
  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text- tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>{children}</div>

  return (
    <div className="text-white">
      {isEditMode && <div className="mb-4 px-3 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text- tracking-[0.2em] text-[#f5c518] font-bold">EDIT MÓD: #{editSource?._editId} {editSource?._extra}</div>}
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Denní report" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="SCHEDULE (cron)"><input className={inputCls} value={form.schedule} onChange={e => set('schedule', e.target.value)} placeholder="0 9 * * 1-5" /></Field>
      <Field label="CAPABILITY ID (co spustit)"><input className={inputCls} value={form.capabilityId} onChange={e => set('capabilityId', e.target.value)} placeholder="julia-nehledalova" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => set('retryOnFailure', !form.retryOnFailure)} className={`w-10 h-5 rounded-full transition-colors relative ${form.retryOnFailure ? 'bg-[#f5c518]' : 'bg-white/10'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${form.retryOnFailure ? 'left-5' : 'left-0.5'}`} />
          </button>
          <span className="text-[11px] text-white/60">RETRY ON FAIL</span>
        </div>
        <Field label="MAX RETRIES">
          <input type="number" min={0} max={5} className={inputCls} value={form.maxRetries} onChange={e => set('maxRetries', Number(e.target.value))} />
        </Field>
      </div>
      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'loop', displayName: form.displayName, version: '1.0.0', status: 'draft', description: form.description, runtime: 'node', entrypoint: './manifest.json', schedule: form.schedule, action: { capabilityId: form.capabilityId, input: {} }, retryOnFailure: form.retryOnFailure, maxRetries: form.maxRetries, tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
