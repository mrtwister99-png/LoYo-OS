// D:\dev\loyo-os\apps\api\src\routes\lootChecker.ts
// LOYO OS // LOOT CHECKER API - V5: behy bezi na POZADI (job), preziji zavreni okna
// POST /run a /sort jen zalozí job a hned vrátí jobId. Frontend pak polluje GET /jobs/:id.
// Po dokonceni job zapise: .md report do data/reports + job.json + zpravu do chatu + aktivitu.
import type { FastifyInstance } from 'fastify'
import { stat, readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { AGENTS_DIR } from '../lib/dataPaths.js'

const AGENT_DIR = join(AGENTS_DIR, 'loot-checker')
const JOBS_DIR = join(AGENT_DIR, 'jobs')

type JobStatus = 'running' | 'done' | 'error'
type LootJob = { id: string; kind: 'duplicity' | 'sort'; dryRun: boolean; status: JobStatus; startedAt: string; finishedAt: string | null; progress: { done: number; total: number; current: string }; message: string | null; result: any | null; reportPath: string | null; error: string | null }

async function writeJob(job: LootJob) { await mkdir(JOBS_DIR, { recursive: true }).catch(() => {}); await writeFile(join(JOBS_DIR, job.id + '.json'), JSON.stringify(job, null, 2), 'utf-8').catch(() => {}) }
async function readJob(id: string): Promise<LootJob | null> { try { return JSON.parse(await readFile(join(JOBS_DIR, id + '.json'), 'utf-8')) } catch { return null } }
async function listJobs(): Promise<LootJob[]> { try { const files = (await readdir(JOBS_DIR)).filter(f => f.endsWith('.json')); const jobs: LootJob[] = []; for (const f of files) { try { jobs.push(JSON.parse(await readFile(join(JOBS_DIR, f), 'utf-8'))) } catch {} } jobs.sort((a,b) => b.startedAt.localeCompare(a.startedAt)); return jobs.slice(0, 30) } catch { return [] } }

// Zprava do chatu - stejny kanal jako orchestrator (saveChatMessage 'mary')
async function notifyChat(text: string) { try { const m: any = await import('../services/chatHistory.js'); if (m.saveChatMessage) await m.saveChatMessage('mary', text) } catch {} }
// Aktivita - stejny kanal jako finder (logActivity)
async function notifyActivity(action: string, meta: any) { try { const m: any = await import('./activity.js'); if (m.logActivity) await m.logActivity({ agent: 'Loot_Checker', type: 'loot', action, meta }) } catch {} }

async function runJobInBackground(job: LootJob, opts: any) {
  try {
    const onProgress = (done: number, total: number, current: string) => { job.progress = { done, total, current }; writeJob(job).catch(() => {}) }
    if (job.kind === 'duplicity') {
      const { runLootChecker } = await import('../services/lootChecker.js')
      const { result, message } = await runLootChecker({ dryRun: job.dryRun, onProgress })
      job.status = 'done'; job.finishedAt = new Date().toISOString(); job.message = message; job.result = result; job.reportPath = result.reportPath || null; job.progress = { done: job.progress.total, total: job.progress.total, current: '' }
      await writeJob(job)
      const chatText = job.dryRun ? `Loot Checker - KONTROLA duplicit hotova (dry-run): ${message} Report: ${job.reportPath || 'neni'}` : `Loot Checker - duplicity hotove: ${message} Report: ${job.reportPath || 'neni'}`
      await notifyChat(chatText)
      await notifyActivity(job.dryRun ? `Loot Checker: kontrola duplicit (dry-run) - ${result.moved.length} k presunu, ponechano ${result.kept}` : `Loot Checker: duplicity - presunuto ${result.moved.length} do kose, ponechano ${result.kept}`, { jobId: job.id, kind: job.kind, dryRun: job.dryRun, moved: result.moved.length, kept: result.kept, reportPath: job.reportPath })
    } else {
      const { runPhase2Sort } = await import('../services/lootChecker.js')
      const { result, message } = await runPhase2Sort({ dryRun: job.dryRun, model: opts.model, threshold: opts.threshold, onProgress })
      job.status = 'done'; job.finishedAt = new Date().toISOString(); job.message = message; job.result = result; job.reportPath = result.reportPath || null; job.progress = { done: job.progress.total, total: job.progress.total, current: '' }
      await writeJob(job)
      const chatText = job.dryRun ? `Loot Checker - KONTROLA trideni hotova (dry-run): ${message} Report: ${job.reportPath || 'neni'}` : `Loot Checker - trideni hotove: ${message} Report: ${job.reportPath || 'neni'}`
      await notifyChat(chatText)
      await notifyActivity(job.dryRun ? `Loot Checker: kontrola trideni (dry-run) - ${result.sorted.length} by roztridil, ${result.lowConfidence.length} nechal` : `Loot Checker: trideni - roztrideno ${result.sorted.length}, nechano ${result.lowConfidence.length}, preskoceno ${result.skipped.length}`, { jobId: job.id, kind: job.kind, dryRun: job.dryRun, sorted: result.sorted.length, low: result.lowConfidence.length, skipped: result.skipped.length, model: result.model, reportPath: job.reportPath })
    }
  } catch (err: any) {
    job.status = 'error'; job.finishedAt = new Date().toISOString(); job.error = err?.message ?? String(err); job.message = `Chyba: ${job.error}`
    await writeJob(job)
    await notifyChat(`Loot Checker - CHYBA (${job.kind}): ${job.error}`)
    await notifyActivity(`Loot Checker: CHYBA ${job.kind} - ${job.error}`, { jobId: job.id, kind: job.kind, error: job.error })
  }
}

export default async function lootCheckerRoutes(app: FastifyInstance) {
  // GET /api/agents/loot-checker/config
  app.get('/agents/loot-checker/config', async () => {
    const { loadLootCheckerConfig, resolveLootCheckerDir } = await import('../services/lootChecker.js')
    const config = await loadLootCheckerConfig()
    const resolvedDir = resolveLootCheckerDir(config.dir)
    const dirExists = await stat(resolvedDir).then((s) => s.isDirectory()).catch(() => false)
    return { config, resolvedDir, dirExists, kosDir: 'data/kos' }
  })

  // POST /api/agents/loot-checker/config — uloží z UI (dir + targetFolders: Název + Popis)
  app.post('/agents/loot-checker/config', async (req, reply) => {
    const { loadLootCheckerConfig, saveLootCheckerConfig, resolveLootCheckerDir } = await import('../services/lootChecker.js')
    const body = (req.body as any) || {}
    const cur = await loadLootCheckerConfig()
    const folderOk = (f: unknown) => typeof f === 'string' && /^[^\\/:*?"<>|]+$/.test(f) && f !== '.' && f !== '..'

    const next = { ...cur }
    if (body.dir !== undefined) {
      if (typeof body.dir !== 'string' || !body.dir.trim()) { reply.code(400); return { error: 'Cesta je prázdná' } }
      const resolved = resolveLootCheckerDir(body.dir.trim())
      const ok = await stat(resolved).then((s) => s.isDirectory()).catch(() => false)
      if (!ok) { reply.code(400); return { error: `Složka neexistuje: ${resolved}` } }
      next.dir = body.dir.trim()
    }
    if (body.targetFolders !== undefined) {
      if (!Array.isArray(body.targetFolders)) { reply.code(400); return { error: 'targetFolders musí být pole' } }
      const cleaned: { name: string; path: string; description: string; belongs: string; notBelongs: string }[] = []
      for (const t of body.targetFolders) {
        if (!t || !folderOk(t.name)) { reply.code(400); return { error: `Neplatný název složky: ${t?.name}` } }
        const belongs = typeof t.belongs === 'string' ? t.belongs : ''
        const notBelongs = typeof t.notBelongs === 'string' ? t.notBelongs : ''
        const description = typeof t.description === 'string' ? t.description : (belongs ? `${belongs}${notBelongs ? ` Nepatří sem: ${notBelongs}` : ''}` : '')
        cleaned.push({ name: t.name, path: typeof t.path === 'string' ? t.path : '', description, belongs, notBelongs })
      }
      next.targetFolders = cleaned
    }
    if (body.visionModel !== undefined) {
      if (typeof body.visionModel !== 'string' || !body.visionModel.trim()) { reply.code(400); return { error: 'Vision model je prázdný' } }
      next.visionModel = body.visionModel.trim()
    }
    if (body.confidenceThreshold !== undefined) {
      const n = Number(body.confidenceThreshold)
      if (!Number.isFinite(n) || n < 0 || n > 100) { reply.code(400); return { error: 'Práh musí být 0-100' } }
      next.confidenceThreshold = n
    }
    if (body.belowThreshold !== undefined) {
      if (body.belowThreshold !== 'leave' && body.belowThreshold !== 'ostatni') { reply.code(400); return { error: 'belowThreshold musí být leave nebo ostatní' } }
      next.belowThreshold = body.belowThreshold
    }
    await saveLootCheckerConfig(next)
    // Hned při uložení v UI dovytvoř chybějící cílové složky — uživatel nemusí čekat až na běh
    const { ensureTargetFolders } = await import('../services/lootChecker.js')
    const ensured = await ensureTargetFolders(next).catch(() => ({ created: [] as string[], errors: [] as any[] }))
    return { config: next, resolvedDir: resolveLootCheckerDir(next.dir), dirExists: true, createdFolders: ensured.created, ensureErrors: ensured.errors }
  })

  // GET /api/agents/loot-checker/jobs - seznam behu (poslednich 30), prezije zavreni okna
  app.get('/agents/loot-checker/jobs', async () => { const jobs = await listJobs(); return { jobs } })

  // GET /api/agents/loot-checker/jobs/:jobId - jeden beh vcetne progress + vysledku
  app.get('/agents/loot-checker/jobs/:jobId', async (req, reply) => { const { jobId } = req.params as { jobId: string }; const job = await readJob(jobId); if (!job) { reply.code(404); return { error: 'Job nenalezen' } } return { job } })

  // POST /api/agents/loot-checker/run - FÁZE 1 na POZADI. Body: { dryRun?, sync? }
  // sync=true = stary synchronni rezim (pro CLI). Jinak hned vrati { jobId, status: 'running' }.
  app.post('/agents/loot-checker/run', async (req, reply) => {
    const { dryRun, sync } = (req.body as { dryRun?: boolean; sync?: boolean }) || {}
    if (sync) { try { const { runLootChecker } = await import('../services/lootChecker.js'); const { result, message } = await runLootChecker({ dryRun: !!dryRun }); return { message, dir: result.dir, kosDir: result.kosDir, dryRun: result.dryRun, kept: result.kept, moved: result.moved.length, movedFiles: result.moved.slice(0,200), skipped: result.skipped.length, errors: result.errors, txtPath: result.txtPath, reportPath: result.reportPath } } catch (err: any) { reply.code(500); return { error: err?.message ?? String(err) } } }
    const jobs = await listJobs(); const already = jobs.find(j => j.kind === 'duplicity' && j.status === 'running'); if (already) { reply.code(409); return { error: 'Loot Checker uz bezi na pozadi', jobId: already.id, job: already } }
    const id = `dup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0,19).replace('T','_')}_${Date.now().toString().slice(-4)}`
    const job: LootJob = { id, kind: 'duplicity', dryRun: !!dryRun, status: 'running', startedAt: new Date().toISOString(), finishedAt: null, progress: { done: 0, total: 0, current: '' }, message: null, result: null, reportPath: null, error: null }
    await writeJob(job)
    runJobInBackground(job, {}).catch(() => {})
    return { jobId: id, status: 'running', message: dryRun ? 'Kontrola duplicit spustena na pozadi - muzes zavrit okno, dobehne to samo.' : 'Presun do kose spusten na pozadi - muzes zavrit okno, dobehne to samo.' }
  })

  // POST /api/agents/loot-checker/sort - FÁZE 2 na POZADI. Body: { dryRun?, model?, threshold?, sync? }
  app.post('/agents/loot-checker/sort', async (req, reply) => {
    const { dryRun, model, threshold, sync } = (req.body as { dryRun?: boolean; model?: string; threshold?: number; sync?: boolean }) || {}
    if (sync) { try { const { runPhase2Sort } = await import('../services/lootChecker.js'); const { result, message } = await runPhase2Sort({ dryRun: !!dryRun, model, threshold }); return { message, dir: result.dir, model: result.model, threshold: result.threshold, dryRun: result.dryRun, sorted: result.sorted.length, sortedFiles: result.sorted.slice(0,200), lowConfidence: result.lowConfidence.slice(0,200), lowCount: result.lowConfidence.length, skipped: result.skipped.length, errors: result.errors, txtPath: result.txtPath, reportPath: result.reportPath } } catch (err: any) { reply.code(500); return { error: err?.message ?? String(err) } } }
    const jobs = await listJobs(); const already = jobs.find(j => j.kind === 'sort' && j.status === 'running'); if (already) { reply.code(409); return { error: 'FÁZE 2 uz bezi na pozadi', jobId: already.id, job: already } }
    const id = `sort_${new Date().toISOString().replace(/[:.]/g, '-').slice(0,19).replace('T','_')}_${Date.now().toString().slice(-4)}`
    const job: LootJob = { id, kind: 'sort', dryRun: !!dryRun, status: 'running', startedAt: new Date().toISOString(), finishedAt: null, progress: { done: 0, total: 0, current: '' }, message: null, result: null, reportPath: null, error: null }
    await writeJob(job)
    runJobInBackground(job, { model, threshold }).catch(() => {})
    return { jobId: id, status: 'running', message: dryRun ? 'Kontrola trideni spustena na pozadi - muzes zavrit okno, dobehne to samo.' : 'Trideni spusteno na pozadi - muzes zavrit okno, dobehne to samo.' }
  })
}
