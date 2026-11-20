// apps/api/src/services/shellSession.ts
// LOYO OS // MARY JANE — perzistentní terminál (/terminal = cmd, /ps = PowerShell).
// Jeden shell pro celý systém (UI chat i Telegram). Každá zpráva = jeden příkaz,
// stav (cd, proměnné) zůstává mezi zprávami. Po 30 min nečinnosti se sám zavře.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

export type ShellKind = 'cmd' | 'ps'

const IDLE_CLOSE_MS = 30 * 60_000
const COMMAND_TIMEOUT_MS = 90_000
const MAX_OUTPUT = 12_000
const CMD_FILE = join(tmpdir(), `loyo-mary-${process.pid}.cmd`)
const PS_FILE = join(tmpdir(), `loyo-mary-${process.pid}.ps1`)

type Session = {
  kind: ShellKind
  child: ChildProcessWithoutNullStreams
  buffer: string
  seq: number
  busy: boolean
  idleTimer: ReturnType<typeof setTimeout> | null
  startedAt: number
}

let session: Session | null = null

export const SHELL_LABEL: Record<ShellKind, string> = { cmd: 'Terminál (cmd)', ps: 'PowerShell' }

export function shellStatus(): { kind: ShellKind; pid: number | undefined; since: number } | null {
  if (!session) return null
  return { kind: session.kind, pid: session.child.pid, since: session.startedAt }
}

function touch(s: Session) {
  if (s.idleTimer) clearTimeout(s.idleTimer)
  s.idleTimer = setTimeout(() => { if (session === s) stopShell() }, IDLE_CLOSE_MS)
}

export function stopShell(): boolean {
  const s = session
  if (!s) return false
  session = null
  if (s.idleTimer) clearTimeout(s.idleTimer)
  try { s.child.stdin.end() } catch {}
  // i s potomky (spuštěné programy v shellu)
  if (s.child.pid) spawn('taskkill.exe', ['/PID', String(s.child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {})
  return true
}

export async function startShell(kind: ShellKind): Promise<{ started: boolean; cwd: string }> {
  if (session?.kind === kind && session.child.exitCode === null) return { started: false, cwd: await currentDir() }
  stopShell()

  const cwd = homedir()
  const child = kind === 'cmd'
    ? spawn('cmd.exe', ['/Q', '/K', 'chcp 65001 >nul & prompt $_'], { cwd, windowsHide: true })
    : spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', '-'], { cwd, windowsHide: true })

  const s: Session = { kind, child, buffer: '', seq: 0, busy: false, idleTimer: null, startedAt: Date.now() }
  child.stdout.on('data', (c) => { s.buffer += c.toString('utf8') })
  child.stderr.on('data', (c) => { s.buffer += c.toString('utf8') })
  child.on('exit', () => { if (session === s) { session = null; if (s.idleTimer) clearTimeout(s.idleTimer) } })
  child.on('error', (err) => { s.buffer += `\n[shell error] ${err.message}` })
  session = s
  touch(s)

  if (kind === 'ps') {
    await runInShell('[Console]::OutputEncoding = [Text.Encoding]::UTF8; $OutputEncoding = [Text.Encoding]::UTF8; $ProgressPreference = "SilentlyContinue"', 15_000)
  }
  return { started: true, cwd: await currentDir() }
}

async function currentDir(): Promise<string> {
  if (!session) return ''
  const out = await runInShell(session.kind === 'cmd' ? 'cd' : '(Get-Location).Path', 10_000).catch(() => '')
  return out.trim().split(/\r?\n/).pop() ?? ''
}

function clean(raw: string, kind: ShellKind): string {
  let lines = raw.replace(/\r/g, '').split('\n')
  if (kind === 'ps') lines = lines.filter((l) => !/^PS [^>]*>\s*$/.test(l) && !/^>>\s*$/.test(l))
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length > MAX_OUTPUT) text = `… (zkráceno, ${text.length} znaků)\n` + text.slice(-MAX_OUTPUT)
  return text
}

// Pošle příkaz a počká na značku konce. Když příkaz běží déle, vrátí, co zatím má.
export async function runInShell(command: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<string> {
  const s = session
  if (!s) throw new Error('Žádný terminál neběží.')
  if (s.busy) return '⏳ Předchozí příkaz ještě běží — počkej, nebo ho ukonči přes /exit.'
  s.busy = true
  touch(s)

  const marker = `__MJ_END_${Date.now().toString(36)}_${++s.seq}__`
  const start = s.buffer.length
  // cmd čte z roury vstup v kódové stránce systému a čeština se rozbije → příkaz jde
  // přes dočasný UTF-8 .cmd soubor (po chcp 65001 ho cmd přečte správně); call drží cd i set.
  let line: string
  if (s.kind === 'cmd') {
    await writeFile(CMD_FILE, `@echo off\r\n${command.replace(/\r?\n/g, '\r\n')}\r\n`, 'utf8')
      .catch((err) => { s.busy = false; throw err })
    line = `call "${CMD_FILE}"\r\necho ${marker} %errorlevel%\r\n`
  } else {
    // stejný problém v PowerShellu → .ps1 s BOM, dot-source drží proměnné i Set-Location
    await writeFile(PS_FILE, '﻿' + command, 'utf8').catch((err) => { s.busy = false; throw err })
    line = `. '${PS_FILE}'\nWrite-Output "${marker} $(if ($?) {0} else {1})"\n`
  }

  try {
    s.child.stdin.write(line, 'utf8')
  } catch (err: any) {
    s.busy = false
    throw new Error(`Do terminálu nejde zapisovat: ${err?.message ?? err}`)
  }

  const deadline = Date.now() + timeoutMs
  let markerAt = -1
  while (Date.now() < deadline && session === s) {
    markerAt = s.buffer.indexOf(marker, start)
    if (markerAt >= 0) break
    await new Promise((r) => setTimeout(r, 120))
  }
  if (markerAt >= 0) await new Promise((r) => setTimeout(r, 150)) // stderr chodí o chlup později

  s.busy = false
  if (session !== s) return clean(s.buffer.slice(start), s.kind) + '\n[terminál skončil]'

  if (markerAt < 0) {
    const partial = clean(s.buffer.slice(start), s.kind)
    return `${partial || '(zatím bez výstupu)'}\n\n⏳ Příkaz běží déle než ${Math.round(timeoutMs / 1000)} s — výstup jsem utnula, běží dál. /exit ho zabije.`
  }

  const endOfMarkerLine = s.buffer.indexOf('\n', markerAt)
  const markerLine = s.buffer.slice(markerAt, endOfMarkerLine < 0 ? undefined : endOfMarkerLine)
  const code = markerLine.split(/\s+/)[1]?.trim()
  const before = s.buffer.slice(start, markerAt)
  const after = endOfMarkerLine < 0 ? '' : s.buffer.slice(endOfMarkerLine + 1)
  // buffer nenecháme růst donekonečna
  s.buffer = after
  const out = clean(before + after, s.kind)
  return code && code !== '0' ? `${out || '(bez výstupu)'}\n\n⚠ exit ${code}` : out || '✓ (bez výstupu)'
}
