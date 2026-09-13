import { useState, useEffect } from 'react'
import type { BuilderProps } from '../Builder'

type ExtendedProps = BuilderProps & { initialData?: any; prefill?: any }
export default function CliBuilder({ onComplete, initialData, prefill }: ExtendedProps) {
  const editSource = (prefill as any) || (initialData as any) || {}
  const [form, setForm] = useState({ displayName: '', id: '', description: '', entrypoint: './dist/index.js', packageDir: '', tags: '' })
  const [isEditMode, setIsEditMode] = useState(false)
  const toKebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const set = (k: string, v: any) => setForm(f => { const n = {...f, [k]: v }; if (k === 'displayName') n.id = toKebab(v); return n })

  useEffect(() => {
    const raw = editSource?._extra || editSource?._editId
    if (!raw) return
    const numberMap: Record<string,string> = { '30': 'firmy' }
    let targetId = typeof raw === 'string'? raw : null
    if (raw && numberMap[String(raw)]) targetId = numberMap[String(raw)]
    if (!targetId) return
    const load = async () => {
      try {
        let data: any = null
        try { const r = await fetch(`http://localhost:3001/api/cli/${targetId}`); if (r.ok) data = await r.json() } catch {}
        if (!data) { const r2 = await fetch(`http://localhost:3001/api/cli`); if (r2.ok) { const list = await r2.json(); const arr = Array.isArray(list)? list : list.items || []; data = arr.find((a:any)=>a.id===targetId||String(a.number)===String(raw)) } }
        if (data) { setForm({ displayName: data.displayName||data.name||targetId, id: data.id||targetId, description: data.description||'', entrypoint: data.entrypoint||'./dist/index.js', packageDir: data.packageDir||'', tags: (data.tags||[]).join(', ') }); setIsEditMode(true) }
      } catch {}
    }; load()
  }, [editSource?._extra, editSource?._editId])

  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const Field = ({ label, children }: any) => <div className="mb-4"><label className="block text- tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>{children}</div>

  return (
    <div className="text-white">
      {isEditMode && <div className="mb-4 px-3 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text- tracking-[0.2em] text-[#f5c518] font-bold">EDIT MÓD: #{editSource?._editId} {editSource?._extra}</div>}
      <Field label="DISPLAY NAME"><input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Firmy CLI" /></Field>
      <Field label="ID"><input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} /></Field>
      <Field label="DESCRIPTION"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="ENTRYPOINT"><input className={inputCls} value={form.entrypoint} onChange={e => set('entrypoint', e.target.value)} /></Field>
      <Field label="PACKAGE DIR (volitelné)"><input className={inputCls} value={form.packageDir} onChange={e => set('packageDir', e.target.value)} placeholder="tools/cli/firmy" /></Field>
      <Field label="TAGS"><input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} /></Field>
      <button onClick={() => onComplete({ id: form.id, type: 'cli', displayName: form.displayName, version: '1.0.0', status: 'draft', description: form.description, runtime: 'node', entrypoint: form.entrypoint, packageDir: form.packageDir || undefined, subcommands: [], tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors">VYGENEROVAT MANIFEST</button>
    </div>
  )
}
