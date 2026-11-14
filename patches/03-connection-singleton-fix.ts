import Database from 'better-sqlite3';
import type { Database as BetterDB } from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { DATA_DIR } from './dataPaths.js';

// FIX F3-3: DB race - manifestDb.ts, notesTasksFts.ts a search.ts si každý dělal new Database()
// Na Windows WAL to zamrzá. Potřebuješ singleton getDb() - 10 minut práce a zachrání Fázi 1.

const DB_PATH = join(DATA_DIR, 'index.db');
let db: BetterDB | null = null;

export function getDb(): BetterDB {
  if (db) return db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  // WAL + optimalizace pro Windows - musí být jen jednou, ne v každém modulu
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('journal_size_limit = 67108864');
  db.pragma('cache_size = -64000');
  db.pragma('wal_autocheckpoint = 1000');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');
  // ochrana proti busy na Windows
  db.pragma('busy_timeout = 5000');
  return db;
}

export function closeDb(): void {
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
}
