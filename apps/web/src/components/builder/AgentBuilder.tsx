import { useState } from 'react'
import type { BuilderProps } from '../Builder'

const MODELS = ['qwen3:8b', 'qwen2.5-coder:3b'] as const
const RUNTIMES = ['prompt', 'node', 'python', 'rust'] as const
const STATUSES = ['draft', 'testing', 'active'] as const

export default function AgentBuilder({ onComplete }: BuilderProps) {
  const [form, setForm] = useState({
    displayName: '',
    id: '',
    description: '',
    model: 'qwen3:8b' as typeof MODELS[number],
    runtime: 'prompt' as typeof RUNTIMES[number],
    entrypoint: './01_CORE_IDENTITY.md',
    status: 'draft' as typeof STATUSES[number],
    systemPrompt: '',
    commands: '',
    specialization: '',
    tags: '',
    mcp_expose: false,
    permissions: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const toKebab = (s: string) =>
    s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const set = (key: string, val: any) => {
    setForm(f => {
      const next = { ...f, [key]: val }
      if (key === 'displayName') next.id = toKebab(val)
      return next
    })
    setErrors(e => ({ ...e, [key]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.displayName.trim()) e.displayName = 'Povinné'
    if (!form.id.match(/^[a-z0-9-]+$/)) e.id = 'Jen kebab-case (a-z, 0-9, -)'
    if (!form.description.trim()) e.description = 'Povinné'
    if (form.runtime === 'prompt' && !form.systemPrompt.trim()) e.systemPrompt = 'Prompt agent potřebuje systemPrompt'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    const manifest = {
      id: form.id,
      type: 'agent',
      displayName: form.displayName,
      version: '1.0.0',
      status: form.status,
      description: form.description,
      runtime: form.runtime,
      entrypoint: form.entrypoint,
      model: form.model,
      systemPrompt: form.systemPrompt || undefined,
      commands: form.commands.split(',').map(s => s.trim()).filter(Boolean),
      specialization: form.specialization.split(',').map(s => s.trim()).filter(Boolean),
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      permissions: form.permissions.split('\n').map(s => s.trim()).filter(Boolean),
      mcp_expose: form.mcp_expose,
      inputs: { message: 'string' },
      outputs: { response: 'string' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onComplete(manifest)
  }

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <label className="block text-[10px] tracking-[0.2em] text-white/50 mb-1 font-bold">{label}</label>
      {children}
      {error && <div className="text-[#ae1710] text-[10px] mt-1">{error}</div>}
    </div>
  )

  const inputCls = "w-full bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-2 outline-none focus:border-[#f5c518]/60 transition-colors"
  const selectCls = inputCls + " cursor-pointer"

  return (
    <div className="text-white">
      <p className="text-[11px] text-white/40 mb-6 font-mono">
        Vyplň formulář → Koštěrad vygeneruje <code className="text-[#f5c518]">manifest.json</code> a zapíše ho na disk.
      </p>

      <Field label="DISPLAY NAME *" error={errors.displayName}>
        <input className={inputCls} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Mary Jane" />
      </Field>

      <Field label="ID (kebab-case) *" error={errors.id}>
        <input className={inputCls} value={form.id} onChange={e => set('id', e.target.value)} placeholder="mary-jane" />
      </Field>

      <Field label="DESCRIPTION *" error={errors.description}>
        <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Co agent dělá..." />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="MODEL">
          <select className={selectCls} value={form.model} onChange={e => set('model', e.target.value)}>
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="RUNTIME">
          <select className={selectCls} value={form.runtime} onChange={e => set('runtime', e.target.value)}>
            {RUNTIMES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ENTRYPOINT">
          <input className={inputCls} value={form.entrypoint} onChange={e => set('entrypoint', e.target.value)} placeholder="./01_CORE_IDENTITY.md" />
        </Field>
        <Field label="STATUS">
          <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <Field label="SYSTEM PROMPT" error={errors.systemPrompt}>
        <textarea className={inputCls} rows={4} value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} placeholder="Jsi agent XY. Tvůj úkol je..." />
      </Field>

      <Field label="COMMANDS (čárkou)">
        <input className={inputCls} value={form.commands} onChange={e => set('commands', e.target.value)} placeholder="/note, /task, /status" />
      </Field>

      <Field label="SPECIALIZATION (čárkou)">
        <input className={inputCls} value={form.specialization} onChange={e => set('specialization', e.target.value)} placeholder="routing, secretary" />
      </Field>

      <Field label="TAGS (čárkou)">
        <input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="router, core" />
      </Field>

      <Field label="PERMISSIONS (každá na nový řádek)">
        <textarea className={inputCls} rows={3} value={form.permissions} onChange={e => set('permissions', e.target.value)} placeholder={"fs:read:data/ja/*\nfs:write:data/chat_history/*"} />
      </Field>

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => set('mcp_expose', !form.mcp_expose)}
          className={`w-10 h-5 rounded-full transition-colors relative ${form.mcp_expose ? 'bg-[#f5c518]' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${form.mcp_expose ? 'left-5' : 'left-0.5'}`} />
        </button>
        <span className="text-[11px] text-white/60 tracking-[0.1em]">MCP EXPOSE</span>
      </div>

      {/* Preview */}
      <div className="mb-6 border border-white/10 bg-black/40 p-4">
        <div className="text-[10px] tracking-[0.3em] text-white/30 mb-2">PREVIEW manifest.json</div>
        <pre className="text-[10px] text-[#f5c518]/80 font-mono overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify({
            id: form.id || '…',
            type: 'agent',
            displayName: form.displayName || '…',
            model: form.model,
            runtime: form.runtime,
            status: form.status,
            mcp_expose: form.mcp_expose,
          }, null, 2)}
        </pre>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-3 bg-[#f5c518] text-black font-black text-[12px] tracking-[0.3em] hover:bg-white transition-colors"
      >
        VYGENEROVAT MANIFEST
      </button>
    </div>
  )
}
