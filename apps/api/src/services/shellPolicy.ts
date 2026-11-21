// apps/api/src/services/shellPolicy.ts
// LOYO OS // skill „Bezpečný shell“ — co smí /terminal, /ps a agenti (ps:/cmd:) spustit sami,
// co jen po /ano a co nikdy. Pravidla: data/capabilities/skills/bezpecny-shell/rules.json.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths.js'

type Rule = { re: string; why: string }
type Rules = { deny: Rule[]; confirm: Rule[] }
export type Verdict = { level: 'allow' | 'confirm' | 'deny'; why?: string }

const RULES_FILE = join(DATA_DIR, 'capabilities', 'skills', 'bezpecny-shell', 'rules.json')
const CONFIRM_TTL_MS = 10 * 60_000

// když soubor chybí nebo je rozbitý, platí aspoň tohle
const FALLBACK: Rules = {
  deny: [
    { re: String.raw`\bformat(\.com)?\s+[a-z]:|\bdiskpart\b|\bbcdedit\b`, why: 'disk / zavaděč' },
    { re: String.raw`(iwr|irm|Invoke-WebRequest|curl|wget)[^|]*\|\s*(iex|Invoke-Expression)`, why: 'kód z internetu' },
  ],
  confirm: [{ re: String.raw`\b(del|erase|rd|rmdir|Remove-Item|rm|move|Move-Item|taskkill|Stop-Process|shutdown)\b`, why: 'nevratná akce' }],
}

let cache: { at: number; rules: Rules } | null = null
async function loadRules(): Promise<Rules> {
  if (cache && Date.now() - cache.at < 10_000) return cache.rules
  let rules = FALLBACK
  try {
    const raw = JSON.parse(await readFile(RULES_FILE, 'utf8'))
    if (Array.isArray(raw.deny) && Array.isArray(raw.confirm)) rules = raw
  } catch {}
  cache = { at: Date.now(), rules }
  return rules
}

export async function checkCommand(command: string): Promise<Verdict> {
  const rules = await loadRules()
  const text = command.replace(/\s+/g, ' ')
  const hit = (list: Rule[]) => list.find((r) => { try { return new RegExp(r.re, 'i').test(text) } catch { return false } })
  const deny = hit(rules.deny)
  if (deny) return { level: 'deny', why: deny.why }
  const confirm = hit(rules.confirm)
  if (confirm) return { level: 'confirm', why: confirm.why }
  return { level: 'allow' }
}

// ---------- čekající potvrzení (/ano <kód>) ----------
type Pending = { code: string; label: string; why: string; run: () => Promise<string>; at: number; ttl: number }
const pending = new Map<string, Pending>()

// oznámení KE SCHVÁLENÍ v horní liště (dynamický import = bez kruhových závislostí)
function notifyApproval(code: string, why: string, label: string) {
  import('./scheduler.js').then((s) => s.pushNotification('approval', `/ano ${code}`, `${why}: ${label.split('\n')[0]}`.slice(0, 300), { code })).catch(() => {})
}
function resolveNotif(code: string) {
  import('./scheduler.js').then((s) => s.resolveApproval(code)).catch(() => {})
}

function prune() {
  for (const [k, p] of pending) if (Date.now() - p.at > p.ttl) { pending.delete(k); resolveNotif(k) }
}

export function askConfirm(label: string, why: string, run: () => Promise<string>, ttlMs = CONFIRM_TTL_MS): string {
  prune()
  let code = ''
  do code = Math.random().toString(36).slice(2, 6); while (pending.has(code))
  pending.set(code, { code, label, why, run, at: Date.now(), ttl: ttlMs })
  notifyApproval(code, why, label)
  return [
    `⚠ Tohle chce potvrzení (${why}):`,
    label,
    '',
    `Spustit: /ano ${code} · zrušit: /ne ${code} (platí ${ttlMs >= 3_600_000 ? `${Math.round(ttlMs / 3_600_000)} h` : `${Math.round(ttlMs / 60_000)} min`}) — nebo klikni na tlačítko / napiš „ano“`,
  ].join('\n')
}

export function denyMessage(label: string, why: string): string {
  return `⛔ Tohle nespustím (${why}):\n${label}\n\nPravidla: skill Bezpečný shell (data/capabilities/skills/bezpecny-shell/rules.json).`
}

export async function confirmPending(code: string): Promise<string> {
  prune()
  if (!code) {
    if (!pending.size) return 'Nic nečeká na potvrzení.'
    return ['⏳ Čeká na potvrzení:', ...[...pending.values()].map((p) => `/ano ${p.code} — ${p.why}: ${p.label.split('\n')[0]}`)].join('\n')
  }
  const p = pending.get(code.trim().toLowerCase())
  if (!p) return `Kód „${code}“ neznám nebo už vypršel. Čekající: /ano`
  pending.delete(p.code)
  resolveNotif(p.code)
  return `✅ Potvrzeno: ${p.label.split('\n')[0]}\n\n${await p.run()}`
}

/** Kódy čekajících potvrzení (nejnovější poslední) — pro „ano“ bez kódu. */
export function pendingCodes(): string[] {
  prune()
  return [...pending.values()].sort((a, b) => a.at - b.at).map((p) => p.code)
}

export function cancelPending(code: string): string {
  if (!code) {
    const n = pending.size
    for (const k of pending.keys()) resolveNotif(k)
    pending.clear()
    return n ? `🗑 Zrušeno ${n} čekajících potvrzení.` : 'Nic nečeká na potvrzení.'
  }
  const c = code.trim().toLowerCase()
  if (!pending.delete(c)) return `Kód „${code}“ neznám.`
  resolveNotif(c)
  return `🗑 Zrušeno: ${code}`
}

/** Projde příkaz pravidly: povolené spustí hned, potvrzované odloží na /ano, zakázané odmítne. */
export async function guarded(label: string, command: string, run: () => Promise<string>): Promise<string> {
  const v = await checkCommand(command)
  if (v.level === 'deny') return denyMessage(label, v.why ?? 'zakázaný příkaz')
  if (v.level === 'confirm') return askConfirm(label, v.why ?? 'riskantní příkaz', run)
  return run()
}
