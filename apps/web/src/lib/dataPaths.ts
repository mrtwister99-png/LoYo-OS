// apps/web/src/lib/dataPaths.ts - frontend KONVENCE v3
// Frontend nesmí sahat na absolutní FS, cesty jsou relativní vůči DATA_DIR
// Tauri Rust backend je joinuje s LOYO_DATA_DIR env (viz src-tauri/src/main.rs)

export const JA_DIR = 'ja'
export const JA_POZNAMKY_DIR = `${JA_DIR}/poznamky`
export const JA_UKOLY_AKTIVNI_DIR = `${JA_DIR}/ukoly/aktivni`
export const JA_UKOLY_HOTOVE_DIR = `${JA_DIR}/ukoly/hotove`
export const JA_KALENDAR_DIR = `${JA_DIR}/kalendar`

export function resolveDataPath(subPath: string): string {
  return subPath.replace(/^data\//, '').replace(/\\/g, '/')
}

export function getNotesPath(fileName: string): string {
  return `${JA_POZNAMKY_DIR}/${fileName}`
}

export function getTasksPath(fileName: string, done = false): string {
  const base = done? JA_UKOLY_HOTOVE_DIR : JA_UKOLY_AKTIVNI_DIR
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

export const DATA_PATHS = {
  poznamky: JA_POZNAMKY_DIR,
  ukolyAktivni: JA_UKOLY_AKTIVNI_DIR,
  ukolyHotove: JA_UKOLY_HOTOVE_DIR,
  kalendar: JA_KALENDAR_DIR,
} as const