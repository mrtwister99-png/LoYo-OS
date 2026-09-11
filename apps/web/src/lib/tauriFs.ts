// apps/web/src/lib/tauriFs.ts
// KONVENCE v3 + ÚKOL 18 - jednotný FS wrapper s try/catch + Tauri fallback
import { mkdir, writeTextFile, remove, readDir } from '@tauri-apps/plugin-fs'

const isTauri = typeof window!== 'undefined' && (window as any).__TAURI__!== undefined

export async function ensureDir(dir: string): Promise<void> {
  try {
    if (isTauri) {
      await mkdir(dir, { recursive: true })
    }
  } catch (e) {
    console.warn('[tauriFs] ensureDir failed', dir, e)
  }
}

export async function saveFile(path: string, content: string): Promise<void> {
  try {
    if (isTauri) {
      const parent = path.split('/').slice(0, -1).join('/')
      if (parent) await ensureDir(parent)
      await writeTextFile(path, content)
    }
  } catch (e) {
    console.warn('[tauriFs] saveFile failed', path, e)
    throw e
  }
}

export async function deleteFile(path: string): Promise<void> {
  try {
    if (isTauri) {
      await remove(path)
    }
  } catch (e) {
    console.warn('[tauriFs] deleteFile failed', path, e)
  }
}

export async function listFiles(dir: string): Promise<string[]> {
  try {
    if (!isTauri) return []
    const entries = await readDir(dir)
    return entries.filter(e =>!e.isDirectory).map(e => e.name)
  } catch {
    return []
  }
}

// listMulti - použito v useFileBackedList / Tasks / Notes
export async function listMulti(dirs: string[]): Promise<{ dir: string; files: string[] }[]> {
  const out: { dir: string; files: string[] }[] = []
  for (const dir of dirs) {
    try {
      const files = await listFiles(dir)
      out.push({ dir, files })
    } catch {
      out.push({ dir, files: [] })
    }
  }
  return out
}

export const tauriFs = { ensureDir, saveFile, deleteFile, listFiles, listMulti, isTauri }