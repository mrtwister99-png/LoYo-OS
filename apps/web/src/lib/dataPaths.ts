// apps/web/src/lib/dataPaths.ts - frontend KONVENCE v3 + ÚKOL 19
export const JA_DIR = 'ja'
export const JA_POZNAMKY_DIR = `${JA_DIR}/poznamky`
export const JA_UKOLY_AKTIVNI_DIR = `${JA_DIR}/ukoly/aktivni`
export const JA_UKOLY_HOTOVE_DIR = `${JA_DIR}/ukoly/hotove`
export const JA_KALENDAR_DIR = `${JA_DIR}/kalendar`

// ÚKOL 19
export const HISTORY_DIR = `history`
export const HISTORY_NOTES_DIR = `${HISTORY_DIR}/notes`
export const HISTORY_TASKS_DIR = `${HISTORY_DIR}/tasks`

export function resolveDataPath(subPath: string): string {
  return subPath.replace(/^data\//, '').replace(/\\/g, '/')
}

export function getNotesPath(fileName: string): string {
  return `${JA_POZNAMKY_DIR}/${fileName}`
}

export function getTasksPath(fileName: string, done = false): string {
  const base = done ? JA_UKOLY_HOTOVE_DIR : JA_UKOLY_AKTIVNI_DIR
  return `${base}/${fileName}`
}

export function getCalendarPath(fileName: string): string {
  return `${JA_KALENDAR_DIR}/${fileName}`
}

export function getNotesAbsPath(fileName: string): string {
  return `data/${getNotesPath(fileName)}`
}

export function getTasksAbsPath(fileName: string, done = false): string {
  return `data/${getTasksPath(fileName, done)}`
}

// ÚKOL 19 helpers
export function getHistoryNotesPath(fileName: string, timestamp: string): string {
  return `${HISTORY_NOTES_DIR}/${fileName}/${timestamp}.md`
}
export function getHistoryTasksPath(fileName: string, timestamp: string): string {
  return `${HISTORY_TASKS_DIR}/${fileName}/${timestamp}.md`
}
export function getHistoryDir(fileType: 'notes' | 'tasks', fileName: string): string {
  return fileType === 'notes' ? `${HISTORY_NOTES_DIR}/${fileName}` : `${HISTORY_TASKS_DIR}/${fileName}`
}

export const DATA_PATHS = {
  poznamky: JA_POZNAMKY_DIR,
  ukolyAktivni: JA_UKOLY_AKTIVNI_DIR,
  ukolyHotove: JA_UKOLY_HOTOVE_DIR,
  kalendar: JA_KALENDAR_DIR,
  historyNotes: HISTORY_NOTES_DIR,
  historyTasks: HISTORY_TASKS_DIR,
} as const