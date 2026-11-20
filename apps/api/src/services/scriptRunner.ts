// apps/api/src/services/scriptRunner.ts
// LOYO OS // MARY JANE — skripty pro agenty: spuštění .py / .ps1 / .cmd / .bat / .mjs / .js,
// jednorázové příkazy v PowerShellu / cmd a psaní nových .py přes lokální LLM (Ollama).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { Ollama } from 'ollama'

const RUN_TIMEOUT_MS = 120_000
const MAX_OUTPUT = 12_000
export const CODE_MODEL = process.env.MARY_CODE_MODEL || 'qwen2.5-coder:32b'

export function desktopDir(): string {
  const candidates = [join(homedir(), 'Desktop'), join(homedir(), 'OneDrive', 'Desktop'), join(homedir(), 'Plocha')]
  return candidates.find((p) => existsSync(p)) ?? candidates[0]
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "plocha/x.py", "na plochu x.py", "~/x.py", "x.py" (→ plocha), absolutní cesta. */
export function resolveUserPath(input: string, baseDir?: string): string {
  let p = input.trim().replace(/^["']|["']$/g, '')
  const n = norm(p)
  const desk = n.match(/^(plocha|plochu|plose|plochy|desktop)[\\/ ]+(.+)$/)
  if (desk) return join(desktopDir(), p.slice(p.length - desk[2].length))
  if (p.startsWith('~')) return join(homedir(), p.slice(1).replace(/^[\\/]/, ''))
  if (isAbsolute(p)) return p
  return resolve(baseDir ?? desktopDir(), p)
}

export const SCRIPT_EXT = ['.py', '.ps1', '.cmd', '.bat', '.mjs', '.js']

function commandFor(file: string, args: string[]): [string, string[]] | null {
  switch (extname(file).toLowerCase()) {
    case '.py': return ['python', ['-X', 'utf8', file, ...args]]
    case '.ps1': return ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file, ...args]]
    case '.cmd':
    case '.bat': return ['cmd.exe', ['/d', '/c', file, ...args]]
    case '.mjs':
    case '.js': return [process.execPath, [file, ...args]]
    default: return null
  }
}

export type RunOutput = { code: number; output: string }

function run(cmd: string, args: string[], cwd: string, timeoutMs = RUN_TIMEOUT_MS): Promise<RunOutput> {
  return new Promise((done) => {
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    let output = ''
    let finished = false
    const finish = (code: number) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      let out = output.replace(/\r/g, '').trim()
      if (out.length > MAX_OUTPUT) out = `… (zkráceno)\n${out.slice(-MAX_OUTPUT)}`
      done({ code, output: out })
    }
    const timer = setTimeout(() => {
      output += `\n[timeout ${Math.round(timeoutMs / 1000)} s — ukončeno]`
      if (child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {})
      finish(124)
    }, timeoutMs)
    child.stdout.on('data', (c) => { output += c.toString('utf8') })
    child.stderr.on('data', (c) => { output += c.toString('utf8') })
    child.on('error', (err) => { output += `\n${err.message}`; finish(1) })
    child.on('close', (code) => finish(code ?? 1))
  })
}

/** Spustí soubor se skriptem podle přípony. */
export async function runScriptFile(file: string, args: string[] = []): Promise<RunOutput> {
  if (!existsSync(file)) return { code: 2, output: `Soubor neexistuje: ${file}` }
  const c = commandFor(file, args)
  if (!c) return { code: 2, output: `Neumím spustit ${extname(file) || 'soubor bez přípony'} — umím ${SCRIPT_EXT.join(', ')}` }
  return run(c[0], c[1], dirname(file))
}

/** Jednorázový příkaz v PowerShellu nebo cmd (pro agenty s "ps:" / "cmd:"). */
export async function runShellOnce(kind: 'ps' | 'cmd', command: string, cwd = homedir()): Promise<RunOutput> {
  if (kind === 'ps') {
    const wrapped = `[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; ${command}`
    const encoded = Buffer.from(wrapped, 'utf16le').toString('base64')
    return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], cwd)
  }
  // cmd: přes dočasný UTF-8 soubor, jinak se rozbije čeština
  const tmp = join(cwd === homedir() ? homedir() : cwd, `.loyo-agent-${Date.now()}.cmd`)
  await writeFile(tmp, `@echo off\r\nchcp 65001 >nul\r\n${command}\r\n`, 'utf8')
  try {
    return await run('cmd.exe', ['/d', '/c', tmp], cwd)
  } finally {
    spawn('cmd.exe', ['/d', '/c', 'del', '/q', tmp], { windowsHide: true }).on('error', () => {})
  }
}

const stripFences = (s: string) => {
  const m = s.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i)
  return (m ? m[1] : s).trim() + '\n'
}

/** Napíše Python skript podle zadání (lokální LLM). Když model selže, uloží kostru se zadáním. */
export async function writePythonScript(file: string, task: string): Promise<{ file: string; usedModel: string | null; note?: string }> {
  await mkdir(dirname(file), { recursive: true })
  let code = ''
  let note: string | undefined
  try {
    const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' })
    // 32b model bývá po probuzení pomalý; Telegram bot čeká na odpověď max 280 s
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('model neodpověděl do 240 s')), 240_000))
    const res: any = await Promise.race([
      ollama.chat({
        model: CODE_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Jsi zkušený Python programátor. Napiš JEDEN kompletní, spustitelný Python 3 skript podle zadání. ' +
              'Jen standardní knihovna, pokud zadání výslovně nechce jinou. Komentáře česky. Výsledek vypiš přes print(). ' +
              'Skript musí jít spustit bez interakce (žádné input()), argumenty ber z sys.argv, když dávají smysl. ' +
              'Vrať jen kód v jednom bloku ```python.',
          },
          { role: 'user', content: `Soubor: ${file}\nZadání: ${task}` },
        ],
        options: { temperature: 0.2, num_predict: 2000 },
      }),
      timeout,
    ])
    code = stripFences(String(res?.message?.content ?? ''))
  } catch (err: any) {
    note = `LLM (${CODE_MODEL}) selhal: ${err?.message ?? err} — uložila jsem kostru se zadáním.`
  }
  if (!code.trim()) {
    code = [
      '# -*- coding: utf-8 -*-',
      `"""${task.replace(/"""/g, "'''")}"""`,
      'import sys',
      '',
      '',
      'def main(args):',
      '    # TODO: doplň logiku podle zadání výše',
      "    print('Kostra od Mary Jane, argumenty:', args)",
      '',
      '',
      "if __name__ == '__main__':",
      '    main(sys.argv[1:])',
      '',
    ].join('\n')
  }
  await writeFile(file, code, 'utf8')
  return { file, usedModel: note ? null : CODE_MODEL, note }
}
