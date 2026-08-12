import { createApp } from "./app.js";
import { config } from "./config.js";
import { createUserController } from "./controllers/user-controller.js";
import { createDatabase } from "./database/connection.js";
import { UserRepository } from "./repositories/user-repository.js";
import { UserService } from "./services/user-service.js";

const database = createDatabase();
const repository = new UserRepository(database);
const service = new UserService(repository);
const controller = createUserController(service);
const app = createApp({ controller, serviceName: config.name });

const server = app.listen(config.port, () => {
  console.log(`[${config.name}] Listening at http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

