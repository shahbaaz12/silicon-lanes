import pg from "pg";

const { Pool } = pg;

export async function createDatabase() {
  const database = new Pool({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "silicon_lanes",
    database: process.env.DATABASE_NAME ?? "silicon_lanes_users",
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10)
  });
  const connection = await database.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Replicas start concurrently and share one logical database, so the seed is
    // written with ON CONFLICT DO NOTHING: it cannot duplicate, and unlike an
    // all-or-nothing guard it still fills in rows a partially-populated table lacks.
    await connection.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    await connection.query(`
      INSERT INTO users (name, email)
      SELECT seed.name, seed.email
      FROM (VALUES
        ('Ada Lovelace', 'ada@example.com'),
        ('Grace Hopper', 'grace@example.com'),
        ('Alan Turing', 'alan@example.com')
      ) AS seed(name, email)
      ON CONFLICT (email) DO NOTHING
    `);
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
  return database;
}
