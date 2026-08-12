export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async list() {
    const result = await this.database.query("SELECT * FROM users ORDER BY id");
    return result.rows;
  }

  async findById(id) {
    const result = await this.database.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0];
  }

  async create({ name, email }) {
    const result = await this.database.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );
    return result.rows[0];
  }
}

