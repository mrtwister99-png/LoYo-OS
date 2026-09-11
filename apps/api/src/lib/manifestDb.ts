import Database from 'better-sqlite3';
import type { Database as BetterDB } from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { DATA_DIR } from './dataPaths.js';
import type { CapabilityManifest } from '@loyo/core';

const DB_PATH = join(DATA_DIR, 'index.db');
let db: BetterDB | null = null;

export function initDb(): BetterDB {
  if (db) return db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('journal_size_limit = 67108864');
  db.pragma('cache_size = -64000');
  db.pragma('wal_autocheckpoint = 1000');
  db.pragma('temp_store = MEMORY');
  db.exec(`
    CREATE TABLE IF NOT EXISTS capabilities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      displayName TEXT,
      version TEXT,
      status TEXT,
      description TEXT,
      manifest_json TEXT NOT NULL,
      file_path TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_capabilities_type ON capabilities(type);
    CREATE INDEX IF NOT EXISTS idx_capabilities_status ON capabilities(status);
    CREATE VIRTUAL TABLE IF NOT EXISTS capabilities_fts USING fts5(
      id, displayName, description, type
    );
    CREATE TRIGGER IF NOT EXISTS capabilities_ai AFTER INSERT ON capabilities BEGIN
      INSERT INTO capabilities_fts(id, displayName, description, type) VALUES (new.id, new.displayName, new.description, new.type);
    END;
    CREATE TRIGGER IF NOT EXISTS capabilities_ad AFTER DELETE ON capabilities BEGIN
      DELETE FROM capabilities_fts WHERE id = old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS capabilities_au AFTER UPDATE ON capabilities BEGIN
      DELETE FROM capabilities_fts WHERE id = old.id;
      INSERT INTO capabilities_fts(id, displayName, description, type) VALUES (new.id, new.displayName, new.description, new.type);
    END;
  `);
  return db;
}

export function getDb(): BetterDB {
  return db ?? initDb();
}

export function upsertCapabilities(capabilities: CapabilityManifest[]): void {
  const instance = getDb();
  const stmt = instance.prepare(`
    INSERT OR REPLACE INTO capabilities
    (id, type, displayName, version, status, description, manifest_json, file_path, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const upsertMany = instance.transaction((caps: CapabilityManifest[]) => {
    for (const m of caps) {
      stmt.run(
        m.id,
        (m as any).type?? 'unknown',
        (m as any).displayName?? m.id,
        (m as any).version?? '0.0.0',
        (m as any).status?? 'active',
        (m as any).description?? '',
        JSON.stringify(m),
        (m as any)._filePath?? (m as any).file_path?? '',
        Date.now()
      );
    }
  });
  upsertMany(capabilities);
}

export function syncDbWithIds(currentIds: string[]): void {
  const instance = getDb();
  if (currentIds.length === 0) {
    instance.exec(`DELETE FROM capabilities; DELETE FROM capabilities_fts;`);
    return;
  }
  const placeholders = currentIds.map(() => '?').join(',');
  instance.prepare(`DELETE FROM capabilities WHERE id NOT IN (${placeholders})`).run(...currentIds);
}

export function getAgentsFromDb(): CapabilityManifest[] {
  const instance = getDb();
  const rows = instance.prepare(`SELECT manifest_json FROM capabilities WHERE type = 'agent'`).all() as { manifest_json: string }[];
  return rows.map(r => JSON.parse(r.manifest_json));
}

export function getByTypeFromDb(type: string): CapabilityManifest[] {
  const instance = getDb();
  const rows = instance.prepare(`SELECT manifest_json FROM capabilities WHERE type = ?`).all(type) as { manifest_json: string }[];
  return rows.map(r => JSON.parse(r.manifest_json));
}

export function getByIdFromDb(id: string): CapabilityManifest | null {
  const instance = getDb();
  const row = instance.prepare(`SELECT manifest_json FROM capabilities WHERE id = ?`).get(id) as { manifest_json: string } | undefined;
  return row ? JSON.parse(row.manifest_json) : null;
}

export function getAllFromDb(): CapabilityManifest[] {
  const instance = getDb();
  const rows = instance.prepare(`SELECT manifest_json FROM capabilities`).all() as { manifest_json: string }[];
  return rows.map(r => JSON.parse(r.manifest_json));
}

export function countFromDb(): number {
  const instance = getDb();
  const row = instance.prepare(`SELECT COUNT(*) as c FROM capabilities`).get() as { c: number };
  return row.c;
}

export function searchFromDb(query: string, type?: string): CapabilityManifest[] {
  const instance = getDb();
  if (!query?.trim()) return type ? getByTypeFromDb(type) : getAllFromDb();
  try {
    const sql = type
      ? `SELECT DISTINCT c.manifest_json FROM capabilities_fts f JOIN capabilities c ON c.id = f.id WHERE capabilities_fts MATCH ? AND c.type = ?`
      : `SELECT DISTINCT c.manifest_json FROM capabilities_fts f JOIN capabilities c ON c.id = f.id WHERE capabilities_fts MATCH ?`;
    const rows = type
      ? (instance.prepare(sql).all(query, type) as { manifest_json: string }[])
      : (instance.prepare(sql).all(query) as { manifest_json: string }[]);
    return rows.map(r => JSON.parse(r.manifest_json));
  } catch {
    return getAllFromDb().filter(m =>
      (m as any).displayName?.toLowerCase().includes(query.toLowerCase()) ||
      (m as any).description?.toLowerCase().includes(query.toLowerCase())
    );
  }
}

export function vacuumDb(): void {
  getDb().exec(`VACUUM`);
}

export function getDbStats() {
  const instance = getDb();
  const total = countFromDb();
  const byType = instance.prepare(`SELECT type, COUNT(*) as c FROM capabilities GROUP BY type`).all() as { type: string, c: number }[];
  return { total, byType, dbPath: join(DATA_DIR, 'index.db') };
}