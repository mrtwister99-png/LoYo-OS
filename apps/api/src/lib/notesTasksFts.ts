import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { DATA_DIR } from './dataPaths.js'
const dbPath = join(DATA_DIR, 'index.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('temp_store = MEMORY')
db.pragma('cache_size = -64000')
db.pragma('mmap_size = 268435456')
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(file_name, title, content)`)
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(file_name, title, content, done)`)

export function reindexAll(): { notes: number, tasks: number } {
  let notes = 0, tasks = 0;
  const notesDir = join(DATA_DIR, 'ja', 'poznamky');
  const tasksDir = join(DATA_DIR, 'ja', 'ukoly', 'aktivni');
  if (existsSync(notesDir)) {
    for (const f of readdirSync(notesDir).filter(x=>x.endsWith('.md'))) {
      try {
        const c = readFileSync(join(notesDir,f),'utf-8');
        const title = f.replace('.md','');
        indexNote(f, title, c.slice(0,5000));
        notes++;
      } catch {}
    }
  }
  if (existsSync(tasksDir)) {
    for (const f of readdirSync(tasksDir).filter(x=>x.endsWith('.md'))) {
      try {
        const c = readFileSync(join(tasksDir,f),'utf-8');
        const title = f.replace('.md','');
        indexTask(f, title, c.slice(0,5000), 0);
        tasks++;
      } catch {}
    }
  }
  return { notes, tasks };
}

export function indexNote(file_name: string, title: string, content: string) {
  db.prepare(`DELETE FROM notes_fts WHERE file_name = ?`).run(file_name)
  db.prepare(`INSERT INTO notes_fts(file_name, title, content) VALUES (?,?,?)`).run(file_name, title, content)
}
export function searchNotes(q: string) {
  return db.prepare(`SELECT *, bm25(notes_fts) as rank FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 20`).all(q)
}

export function indexTask(file_name: string, title: string, content: string, done: number) {
  // FTS5 nemá REPLACE, takže delete + insert
  db.prepare(`DELETE FROM tasks_fts WHERE file_name = ?`).run(file_name)
  db.prepare(`INSERT INTO tasks_fts(file_name, title, content, done) VALUES (?,?,?,?)`).run(file_name, title, content, done)
}

export function searchTasks(q: string) {
  return db.prepare(`SELECT *, bm25(tasks_fts) as rank FROM tasks_fts WHERE tasks_fts MATCH ? ORDER BY rank LIMIT 20`).all(q)
}

export function searchAll(q: string) {
  const notes = db.prepare(`SELECT 'note' as type, file_name, title, content, bm25(notes_fts) as rank FROM notes_fts WHERE notes_fts MATCH? ORDER BY rank LIMIT 10`).all(q) as any[]
  const tasks = db.prepare(`SELECT 'task' as type, file_name, title, content, bm25(tasks_fts) as rank FROM tasks_fts WHERE tasks_fts MATCH? ORDER BY rank LIMIT 10`).all(q) as any[]
  return [...notes,...tasks].sort((a,b)=>a.rank-b.rank).slice(0,20)
}

export function getFtsStats() {
  const notes = db.prepare(`SELECT COUNT(*) as c FROM notes_fts`).get() as {c:number};
  const tasks = db.prepare(`SELECT COUNT(*) as c FROM tasks_fts`).get() as {c:number};
  return { notes: notes.c, tasks: tasks.c };
}