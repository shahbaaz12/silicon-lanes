import pg from "pg";

const { Pool } = pg;

export async function createDatabase() {
  const database = new Pool({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "silicon_lanes",
    database: process.env.DATABASE_NAME ?? "silicon_lanes_payments",
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10)
  });
  const connection = await database.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        status TEXT NOT NULL DEFAULT 'authorized',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Replicas of a service start at the same time and share one logical database,
    // so the seed is locked and guarded rather than simply inserted.
    await connection.query("LOCK TABLE payments IN SHARE ROW EXCLUSIVE MODE");
    await connection.query(`
      INSERT INTO payments (order_id, amount_cents, status)
      SELECT seed.order_id, seed.amount_cents, seed.status
      FROM (VALUES
        (1, 24200, 'captured'),
        (2, 12900, 'authorized'),
        (3, 6400, 'captured')
      ) AS seed(order_id, amount_cents, status)
      WHERE NOT EXISTS (SELECT 1 FROM payments)
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
