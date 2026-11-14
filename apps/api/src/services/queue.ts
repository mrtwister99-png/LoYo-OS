// apps/api/src/services/queue.ts
// ÚKOL 10 + 11: Fronta s p-queue (concurrency 1) + file persistence pro recovery
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { QUEUE_DIR, QUEUE_PENDING_FILE } from '../lib/dataPaths.js'
import PQueue from 'p-queue'

export type JobStatus = 'pending' | 'running' | 'done' | 'failed'
export interface QueuedJob {
  id: string
  message: string
  priority: number
  createdAt: string
  status: JobStatus
  runId?: string
}

export const jobQueue = new PQueue({ concurrency: 1, autoStart: true })

async function ensureDir() { await mkdir(QUEUE_DIR, { recursive: true }) }

export async function loadQueue(): Promise<QueuedJob[]> {
  try {
    const raw = await readFile(QUEUE_PENDING_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)? parsed : []
  } catch { return [] }
}

export async function saveQueue(jobs: QueuedJob[]): Promise<void> {
  await ensureDir()
  await writeFile(QUEUE_PENDING_FILE, JSON.stringify(jobs, null, 2), 'utf-8')
}

export async function enqueueJob(message: string, priority: number): Promise<QueuedJob> {
  const jobs = await loadQueue()
  const job: QueuedJob = { id: randomUUID(), message, priority, createdAt: new Date().toISOString(), status: 'pending' }
  jobs.push(job)
  await saveQueue(jobs)
  return job
}

export async function getNextPendingJob(): Promise<QueuedJob | undefined> {
  const jobs = await loadQueue()
  const pending = jobs.filter(j => j.status === 'pending').sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))
  return pending[0]
}

export async function markJobStatus(id: string, status: JobStatus, runId?: string): Promise<void> {
  const jobs = await loadQueue()
  const idx = jobs.findIndex(j => j.id === id)
  if (idx!== -1) { jobs[idx].status = status; if (runId) jobs[idx].runId = runId; await saveQueue(jobs) }
}

export async function getQueueLength(): Promise<number> {
  return jobQueue.size + jobQueue.pending
}

export async function cleanupDoneJobs(): Promise<void> {
  const jobs = await loadQueue()
  const filtered = jobs.filter(j => j.status!== 'done' && j.status!== 'failed')
  if (filtered.length!== jobs.length) await saveQueue(filtered)
}

export function isQueueBusy(): boolean { return jobQueue.pending > 0 }
export function setQueueBusy(_v: boolean) {}
export function getQueueStats() { return { size: jobQueue.size, pending: jobQueue.pending, isIdle: jobQueue.size === 0 && jobQueue.pending === 0 } }

export async function rehydrateQueueFromDisk(runCore: (msg: string, runId: string, steps: string[]) => Promise<any>) {
  const jobs = (await loadQueue()).filter(j => j.status === 'pending')
  for (const job of jobs) {
    jobQueue.add(async () => {
      const runId = job.runId || `${new Date().toISOString()}_${job.id.slice(0,8)}`
      try {
        await markJobStatus(job.id, 'running', runId)
        await runCore(job.message, runId, [])
        await markJobStatus(job.id, 'done', runId)
      } catch {
        await markJobStatus(job.id, 'failed', runId)
      }
    }, { priority: 10 - job.priority })
  }
}
