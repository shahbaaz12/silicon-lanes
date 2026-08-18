import pg from "pg";

const { Pool } = pg;

export async function createDatabase() {
  const database = new Pool({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "silicon_lanes",
    database: process.env.DATABASE_NAME ?? "silicon_lanes_inventory",
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10)
  });
  const connection = await database.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        product_id BIGINT PRIMARY KEY,
        quantity INTEGER NOT NULL CHECK (quantity >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Replicas start concurrently and share one logical database, so the seed is
    // written with ON CONFLICT DO NOTHING: it cannot duplicate, and unlike an
    // all-or-nothing guard it still fills in rows a partially-populated table lacks.
    await connection.query("LOCK TABLE inventory IN SHARE ROW EXCLUSIVE MODE");
    await connection.query(`
      INSERT INTO inventory (product_id, quantity)
      SELECT seed.product_id, seed.quantity
      FROM (VALUES
        (1, 42),
        (2, 18),
        (3, 7)
      ) AS seed(product_id, quantity)
      ON CONFLICT (product_id) DO NOTHING
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
