import { useState, useEffect } from 'react'
import type { BuilderProps } from '../Builder'
type Step = { id: string; capabilityId: string; dependsOn: string }
type ExtendedProps = BuilderProps & { initialData?: any; prefill?: any }
export default function WorkflowBuilder({ onComplete, initialData, prefill }: ExtendedProps) {
  const editSource = (prefill as any) || (initialData as any) || {}
  const [form, setForm] = useState({ displayName: '', id: '', description: '', tags: '' })
  const [steps, setSteps] = useState<Step[]>([{ id: 'step-1', capabilityId: '', dependsOn: '' }])
  const [isEditMode, setIsEditMode] = useState(false)
  useEffect(() => {
    const raw = editSource?._extra || editSource?._editId
    if (!raw) return
    let targetId = typeof raw === 'string'? raw : null
    if (!targetId) return
    const load = async () => {
      try {
        const r = await fetch(`http://localhost:3001/api/workflows/${targetId}`); if (r.ok) { const d = await r.json(); setForm({ displayName: d.displayName||targetId, id: d.id||targetId, description: d.description||'', tags: (d.tags||[]).join(', ') }); if (d.steps?.length) setSteps(d.steps.map((s:any)=>({ id: s.id, capabilityId: s.capabilityId, dependsOn: (s.dependsOn||[])[0]||'' }))); setIsEditMode(true) }
      } catch {}
    }; load()
  }, [editSource?._extra, editSource?._editId])
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = { ...f, [k]: v }; if (k === 'displayName') n.id = toKebab(v); return n })
  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>{children}</div>

  const addStep = () => setSteps(s => [...s, { id: `step-${s.length + 1}`, capabilityId: '', dependsOn: '' }])
  const setStep = (i: number, k: keyof Step, v: string) => setSteps(s => s.map((st, idx) => idx === i ? { ...st, [k]: v } : st))

  return (
    <div className="text-white">
      {isEditMode && <div className="mb-4 px-3 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text- tracking-[0.2em] text-[#f5c518] font-bold">EDIT MÓD: #{editSource?._editId} {editSource?._extra}</div>}
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Najdi a prozkoumej" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>

      <div className="mb-4">
        <div className="text-[10px] tracking-[0.2em] text-white/50 mb-2 font-bold flex justify-between">
          <span>KROKY</span>
          <button onClick={addStep} className="text-[#f5c518] hover:text-white">+ přidat krok</button>
        </div>
        {steps.map((step, i) => (
          <div key={i} className="border border-white/10 p-3 mb-2 bg-black/30">
            <div className="grid grid-cols-3 gap-2">
              <div><div className="text-[9px] text-white/30 mb-1">ID</div><input className={inputCls} value={step.id} onChange={e => setStep(i, 'id', e.target.value)} /></div>
              <div><div className="text-[9px] text-white/30 mb-1">CAPABILITY</div><input className={inputCls} value={step.capabilityId} onChange={e => setStep(i, 'capabilityId', e.target.value)} placeholder="lubor-nehleda" /></div>
              <div><div className="text-[9px] text-white/30 mb-1">DEPENDS ON</div><input className={inputCls} value={step.dependsOn} onChange={e => setStep(i, 'dependsOn', e.target.value)} placeholder="step-1" /></div>
            </div>
          </div>
        ))}
      </div>

      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'workflow', displayName: form.displayName, version: '1.0.0', status: 'draft', description: form.description, runtime: 'composite', entrypoint: './manifest.json', steps: steps.map(s => ({ id: s.id, capabilityId: s.capabilityId, input: {}, dependsOn: s.dependsOn ? [s.dependsOn] : [], retryPolicy: 'none' })), tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
