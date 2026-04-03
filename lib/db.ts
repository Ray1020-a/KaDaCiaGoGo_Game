import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const globalForDb = globalThis as unknown as { sqlite?: Database.Database };

function getDbPath() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "game.db");
}

export function getDb(): Database.Database {
  if (globalForDb.sqlite) return globalForDb.sqlite;
  const db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_code TEXT NOT NULL,
      spot_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      checked_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      UNIQUE(user_code, spot_id)
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_code);
    CREATE INDEX IF NOT EXISTS idx_checkins_time ON checkins(checked_at);
  `);
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "real_name")) {
    db.exec("ALTER TABLE users ADD COLUMN real_name TEXT");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_code TEXT NOT NULL,
      spot_id TEXT NOT NULL,
      body TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      UNIQUE(user_code, spot_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_code);
  `);
  globalForDb.sqlite = db;
  return db;
}
