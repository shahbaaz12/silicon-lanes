import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

export function createDatabase() {
  const databaseDirectory = path.resolve(process.env.DATABASE_DIR ?? path.join(repositoryRoot, "Database"));
  mkdirSync(databaseDirectory, { recursive: true });
  const databasePath = process.env.DATABASE_PATH === ":memory:"
    ? ":memory:"
    : path.resolve(process.env.DATABASE_PATH ?? path.join(databaseDirectory, "inventory.db"));
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      product_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL CHECK (quantity >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return database;
}

