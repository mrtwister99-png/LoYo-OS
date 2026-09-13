// D:\dev\loyo-os\apps\api\src\lib\dataPaths.ts - ROZŠÍŘENO PRO ÚKOL 19
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DEFAULT_DATA_DIR = resolve(__dirname, '../../../../data')
export const DATA_DIR = process.env.LOYO_DATA_DIR ? resolve(process.env.LOYO_DATA_DIR) : DEFAULT_DATA_DIR

// KONVENCE v3 - odvozené cesty, žádný D:/ hardcode, jediný zdroj DATA_DIR
export const CAPABILITIES_DIR = join(DATA_DIR, 'capabilities')
export const AGENTS_DIR = join(CAPABILITIES_DIR, 'agents')
export const REPORTS_DIR = join(DATA_DIR, 'reports')
export const JA_DIR = join(DATA_DIR, 'ja')
export const JA_POZNAMKY_DIR = join(JA_DIR, 'poznamky')
export const JA_UKOLY_DIR = join(JA_DIR, 'ukoly')
export const JA_UKOLY_AKTIVNI_DIR = join(JA_UKOLY_DIR, 'aktivni')
export const JA_UKOLY_HOTOVE_DIR = join(JA_UKOLY_DIR, 'hotove')
export const JA_KALENDAR_DIR = join(JA_DIR, 'kalendar')
export const LEADS_DIR = join(DATA_DIR, 'leads')
export const LOGS_RUNS_DIR = join(DATA_DIR, 'logs', 'runs')
export const QUEUE_DIR = join(DATA_DIR, 'queue')
export const QUEUE_PENDING_FILE = join(QUEUE_DIR, 'pending.json')
export const QUEUE_LOCK_FILE = join(QUEUE_DIR, '.lock')
export const TMP_DIR = join(DATA_DIR, 'tmp')


// ÚKOL 19: UNDO HISTORY
export const HISTORY_DIR = join(DATA_DIR, 'history')
export const HISTORY_NOTES_DIR = join(HISTORY_DIR, 'notes')
export const HISTORY_TASKS_DIR = join(HISTORY_DIR, 'tasks')


export function getHistoryNotesPath(fileName: string, timestamp: string): string {
  return join(HISTORY_NOTES_DIR, fileName, `${timestamp}.md`)
}
export function getHistoryTasksPath(fileName: string, timestamp: string): string {
  return join(HISTORY_TASKS_DIR, fileName, `${timestamp}.md`)
}
export function getHistoryDirForNote(fileName: string): string {
  return join(HISTORY_NOTES_DIR, fileName)
}
export function getHistoryDirForTask(fileName: string): string {
  return join(HISTORY_TASKS_DIR, fileName)
}
