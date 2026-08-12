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
    : path.resolve(process.env.DATABASE_PATH ?? path.join(databaseDirectory, "carts.db"));
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, product_id)
    )
  `);
  return database;
}

