import { statfs, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import { DATA_DIR } from '../lib/dataPaths.js'
import { Ollama } from 'ollama'

const ollama = new Ollama({ host: 'http://localhost:11434' })

export async function getHealth() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  let disk = { total: 0, free: 0, used: 0, path: DATA_DIR, usedPercent: 0 }
  try {
    const s: any = await statfs(DATA_DIR)
    disk.total = s.bsize * s.blocks
    disk.free = s.bsize * s.bfree
    disk.used = disk.total - disk.free
    disk.usedPercent = Math.round((disk.used / disk.total) * 100)
  } catch {}

  let models: any[] = []
  let running: any[] = []
  let qwenStatus = 'unknown'
  try {
    const list: any = await ollama.list()
    models = list.models || []
    try {
      const ps = await fetch('http://localhost:11434/api/ps').then(r=>r.json()).catch(()=>null)
      running = ps?.models || []
      const hasQwen = [...running,...models].some((m:any)=> (m.name||m.model||'').includes('qwen3:8b'))
      qwenStatus = hasQwen? (running.length>0? 'loaded' : 'available') : 'not_found'
    } catch {
      qwenStatus = models.some((m:any)=>m.name?.includes('qwen3:8b'))? 'available' : 'not_found'
    }
  } catch {
    qwenStatus = 'ollama_offline'
  }

  let lastBackup: any = null
  const candidates = [join(DATA_DIR,'backups'), join(DATA_DIR,'.backup'), join(DATA_DIR,'history'), join(DATA_DIR,'activity')]
  for (const dir of candidates) {
    try {
      const files = await readdir(dir)
      const withStat = await Promise.all(files.map(async f=>{
        try { const st = await stat(join(dir,f)); return { f, mtime: st.mtime } } catch { return null }
      }))
      const valid = (withStat.filter(Boolean) as any[]).sort((a,b)=>b.mtime-a.mtime)
      if (valid[0]) {
        lastBackup = { dir, file: valid[0].f, at: valid[0].mtime.toISOString(), ageHours: Math.round((Date.now()-valid[0].mtime.getTime())/3600000) }
        break
      }
    } catch {}
  }

  return {
    ok: true,
    ts: new Date().toISOString(),
    vram: { total: totalMem, free: freeMem, used: usedMem, usedPercent: Math.round((usedMem/totalMem)*100), load: os.loadavg(), uptime: os.uptime() },
    models: { all: models.map((m:any)=>({ name:m.name, size:m.size })), running, qwen3_8b: qwenStatus },
    disk,
    backup: lastBackup || { status:'no_backup_found', at:null },
  }
}