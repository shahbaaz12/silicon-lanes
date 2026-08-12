# Database

Runtime SQLite files are created here when the services start. Each service
owns a separate database and must communicate with other services through APIs,
never by opening another service's database.

Database files are intentionally ignored by Git. Schema creation lives in each
service's `src/database/connection.js` module. Set `DATABASE_PATH=:memory:` when
starting one service to use an in-memory database for tests.

