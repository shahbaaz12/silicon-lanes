import { createApp } from "./app.js";
import { config } from "./config.js";
import { createCartController } from "./controllers/cart-controller.js";
import { createDatabase } from "./database/connection.js";
import { CartRepository } from "./repositories/cart-repository.js";
import { CartService } from "./services/cart-service.js";

const database = createDatabase();
const repository = new CartRepository(database);
const service = new CartService(repository);
const controller = createCartController(service);
const app = createApp({ controller, serviceName: config.name });
const server = app.listen(config.port, () => console.log(`[${config.name}] Listening at http://localhost:${config.port}`));

function shutdown() {
  server.close(() => { database.close(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

