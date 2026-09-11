// KONVENCE v3 - jediný wrapper pro Tauri FS
export async function ensureDir(path: string) {
  if (typeof window === 'undefined' || !(window as any).__TAURI__) return
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('ensure_dir', { path })
}
export async function saveFile(path: string, content: string) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('save_task', { path, content })
}
export async function deleteFile(path: string) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('delete_task', { path })
}
export async function listMulti(dirs: string[]) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<any[]>('list_tasks_multi', { dirs })
}