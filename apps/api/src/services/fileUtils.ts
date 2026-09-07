// D:\dev\loyo-os\apps\api\src\services\fileUtils.ts
// LOYO OS // FILE UTILS — sdílené pomocné funkce pro /note, /task, /kalendar, /status
import { readdir } from 'node:fs/promises'

export function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'bez-nazvu'
  )
}

export function safeName(s: string): string {
  return s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 60)
}

export async function nextFileNumber(dir: string): Promise<number> {
  try {
    const files = await readdir(dir)
    return files.filter(f => f.endsWith('.md')).length + 1
  } catch {
    return 1
  }
}

// bezpečné čtení obsahu adresáře — nikdy nespadne, jen vrátí prázdné pole
export async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}
