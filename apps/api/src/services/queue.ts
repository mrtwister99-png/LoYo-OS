// apps/api/src/services/queue.ts
// ÚKOL 10: Fronta úkolů file-based - data/queue/pending.json - bez Redis
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { QUEUE_DIR, QUEUE_PENDING_FILE } from '../lib/dataPaths'

export type JobStatus = 'pending' | 'running' | 'done' | 'failed'
export interface QueuedJob {
  id: string
  message: string
  priority: number
  createdAt: string
  status: JobStatus
  runId?: string
}

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
  const jobs = await loadQueue()
  return jobs.filter(j => j.status === 'pending').length
}

export async function cleanupDoneJobs(): Promise<void> {
  const jobs = await loadQueue()
  const filtered = jobs.filter(j => j.status!== 'done' && j.status!== 'failed')
  if (filtered.length!== jobs.length) await saveQueue(filtered)
}

// in-memory lock - file je jen persistence
let _isProcessing = false
export function isQueueBusy(): boolean { return _isProcessing }
export function setQueueBusy(v: boolean) { _isProcessing = v }