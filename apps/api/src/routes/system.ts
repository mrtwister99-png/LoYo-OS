// LOYO OS // restart a vypnutí celého systému (tlačítka R a ⏻ vpravo nahoře)
// POST /api/system/power { mode: 'restart' | 'off' }
// Spustí tools/loyo-power.ps1 přes WMI — skript zabije i tohle API, takže nesmí být v jeho
// stromu procesů ani v jeho job objektu (jinak by umřel spolu s ním).
import { FastifyInstance } from 'fastify'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// apps/api/src/routes → kořen repa → tools/loyo-power.ps1
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'tools', 'loyo-power.ps1')

export default async function systemRoutes(app: FastifyInstance) {
  app.post('/system/power', async (req, reply) => {
    const mode = (req.body as { mode?: string } | undefined)?.mode
    if (mode !== 'restart' && mode !== 'off') { reply.code(400); return { error: 'mode musí být restart nebo off' } }
    setTimeout(() => {
      // Přes WMI: proces založí služba WMI, ne API → není v job objektu API (pnpm/tsx), který při
      // zavření okna API zabije všechny své procesy. Obyčejný detached spawn i `cmd start` to nepřežily.
      const cmdLine = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "${SCRIPT}" -Mode ${mode}`
      spawn('powershell.exe', ['-NoProfile', '-Command',
        `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmdLine.replace(/'/g, "''")}' } | Out-Null`,
      ], { windowsHide: true, stdio: 'ignore' }).on('error', (e) => console.error('[system] power spawn fail', e))
    }, 200)
    return { ok: true, mode, message: mode === 'restart' ? 'LoYo OS se restartuje…' : 'LoYo OS se vypíná…' }
  })
}
