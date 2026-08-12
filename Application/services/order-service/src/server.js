import { createApp } from "./app.js";
import { config } from "./config.js";
import { createOrderController } from "./controllers/order-controller.js";
import { createDatabase } from "./database/connection.js";
import { OrderRepository } from "./repositories/order-repository.js";
import { OrderService } from "./services/order-service.js";

const database = await createDatabase();
const repository = new OrderRepository(database);
const service = new OrderService(repository);
const controller = createOrderController(service);
const app = createApp({ controller, serviceName: config.name });
const server = app.listen(config.port, () => console.log(`[${config.name}] Listening at http://localhost:${config.port}`));

function shutdown() {
  server.close(async () => { await database.end(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
