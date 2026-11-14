import { useState, useEffect } from 'react'
import type { BuilderProps } from '../Builder'
type Step = { id: string; capabilityId: string; dependsOn: string }
type ExtendedProps = BuilderProps & { initialData?: any; prefill?: any }
export default function WorkflowBuilder({ onComplete, initialData, prefill }: ExtendedProps) {
  const editSource = (prefill as any) || (initialData as any) || {}
  const [form, setForm] = useState({ displayName: '', id: '', description: '', tags: '' })
  const [steps, setSteps] = useState<Step[]>([{ id: 'step-1', capabilityId: '', dependsOn: '' }])
  const [isEditMode, setIsEditMode] = useState(false)
  const [orig, setOrig] = useState<any>(null) // původní manifest z edit módu (aby se neztratila pole mimo formulář)
  useEffect(() => {
    const raw = editSource?._extra || editSource?._editId
    if (!raw) return
    let targetId = typeof raw === 'string'? raw : null
    if (!targetId) return
    const load = async () => {
      try {
        const r = await fetch(`http://localhost:3001/api/capabilities/${targetId}`); if (r.ok) { const d = await r.json(); setForm({ displayName: d.displayName||targetId, id: d.id||targetId, description: d.description||'', tags: (d.tags||[]).join(', ') }); if (d.steps?.length) setSteps(d.steps.map((s:any)=>({ id: s.id, capabilityId: s.capabilityId, dependsOn: (s.dependsOn||[]).join(', ') }))); setOrig(d); setIsEditMode(true) }
      } catch {}
    }; load()
  }, [editSource?._extra, editSource?._editId])
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = { ...f, [k]: v }; if (k === 'displayName' && !isEditMode) n.id = toKebab(v); return n })
  const inputCls = "w-full bg-white/5 border border-white/10 text-[#f0f0f0] text-xs font-mono px-3 py-2 outline-none focus:border-[#444]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text-[10px] tracking-[0.2em] text-[#9a9a9a] mb-1 font-bold">{label}</label>{children}</div>

  const addStep = () => setSteps(s => [...s, { id: `step-${s.length + 1}`, capabilityId: '', dependsOn: '' }])
  const setStep = (i: number, k: keyof Step, v: string) => setSteps(s => s.map((st, idx) => idx === i ? { ...st, [k]: v } : st))

  return (
    <div className="text-[#f0f0f0]">
      {isEditMode && <div className="mb-4 px-3 py-2 bg-[#444]/20 border border-[#444]/40 text- tracking-[0.2em] text-[#9a9a9a] font-bold">EDIT MÓD: #{editSource?._editId} {editSource?._extra}</div>}
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Najdi a prozkoumej" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} readOnly={isEditMode} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>

      <div className="mb-4">
        <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] mb-2 font-bold flex justify-between">
          <span>KROKY</span>
          <button onClick={addStep} className="text-[#9a9a9a] hover:text-[#f0f0f0]">+ přidat krok</button>
        </div>
        {steps.map((step, i) => (
          <div key={i} className="border border-white/10 p-3 mb-2 bg-black/30">
            <div className="grid grid-cols-3 gap-2">
              <div><div className="text-[9px] text-[#9a9a9a]/70 mb-1">ID</div><input className={inputCls} value={step.id} onChange={e => setStep(i, 'id', e.target.value)} /></div>
              <div><div className="text-[9px] text-[#9a9a9a]/70 mb-1">CAPABILITY</div><input className={inputCls} value={step.capabilityId} onChange={e => setStep(i, 'capabilityId', e.target.value)} placeholder="lubor-nehleda" /></div>
              <div><div className="text-[9px] text-[#9a9a9a]/70 mb-1">DEPENDS ON</div><input className={inputCls} value={step.dependsOn} onChange={e => setStep(i, 'dependsOn', e.target.value)} placeholder="step-1" /></div>
            </div>
          </div>
        ))}
      </div>

      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'workflow', displayName: form.displayName, version: orig?.version ?? '1.0.0', status: orig?.status ?? 'draft', description: form.description, runtime: 'composite', entrypoint: './manifest.json', steps: steps.map(s => { const o = orig?.steps?.find((x: any) => x.id === s.id); return { ...o, id: s.id, capabilityId: s.capabilityId, input: o?.input ?? {}, dependsOn: s.dependsOn.split(',').map(x => x.trim()).filter(Boolean), retryPolicy: o?.retryPolicy ?? 'none' } }), tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: orig?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#444] text-[#f0f0f0] font-black text-[12px] tracking-[0.3em] hover:bg-[#3a3a3a] transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
