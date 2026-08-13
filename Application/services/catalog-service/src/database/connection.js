import pg from "pg";

const { Pool } = pg;

export async function createDatabase() {
  const database = new Pool({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "silicon_lanes",
    database: process.env.DATABASE_NAME ?? "silicon_lanes_catalog",
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10)
  });
  const connection = await database.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await connection.query("LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE");
    await connection.query(`
      INSERT INTO products (name, description, price_cents)
      SELECT seed.name, seed.description, seed.price_cents
      FROM (VALUES
        ('Mechanical Keyboard', 'Low-profile wireless keyboard', 8900),
        ('Studio Headphones', 'Closed-back monitoring headphones', 12900),
        ('Desk Lamp', 'Adjustable warm-to-cool task light', 6400)
      ) AS seed(name, description, price_cents)
      WHERE NOT EXISTS (SELECT 1 FROM products)
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
