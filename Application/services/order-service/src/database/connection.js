import pg from "pg";

const { Pool } = pg;

export async function createDatabase() {
  const database = new Pool({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "silicon_lanes",
    database: process.env.DATABASE_NAME ?? "silicon_lanes_orders",
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10)
  });
  const connection = await database.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Replicas of a service start at the same time and share one logical database,
    // so the seed is locked and guarded rather than simply inserted.
    await connection.query("LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE");
    await connection.query(`
      INSERT INTO orders (user_id, status, total_cents)
      SELECT seed.user_id, seed.status, seed.total_cents
      FROM (VALUES
        (1, 'paid', 24200),
        (2, 'pending', 12900),
        (3, 'shipped', 6400)
      ) AS seed(user_id, status, total_cents)
      WHERE NOT EXISTS (SELECT 1 FROM orders)
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
