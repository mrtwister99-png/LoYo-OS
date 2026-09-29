import Database from 'better-sqlite3';
import type { Database as BetterDB } from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { DATA_DIR } from './dataPaths.js';

const DB_PATH = join(DATA_DIR, 'index.db');
let db: BetterDB | null = null;

export function getDb(): BetterDB {
  if (db) return db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('journal_size_limit = 67108864');
  db.pragma('cache_size = -64000');
  db.pragma('wal_autocheckpoint = 1000');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');
  return db;
}

export function closeDb(): void {
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
}