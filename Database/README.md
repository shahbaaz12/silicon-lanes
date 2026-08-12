# Database

Runtime SQLite files are created here when the services start. Each service
owns a separate database and must communicate with other services through APIs,
never by opening another service's database.

For multiple Docker instances, give each instance its own database filename.
SQLite files must not be shared by multiple writing containers. A later shared
database server is required when horizontally scaled instances need consistent
state.

Database files are intentionally ignored by Git. Schema creation lives in each
service's `src/database/connection.js` module. Set `DATABASE_PATH=:memory:` when
starting one service to use an in-memory database for tests.
