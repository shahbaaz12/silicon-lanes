import { createApp } from "./app.js";
import { config } from "./config.js";
import { createInventoryController } from "./controllers/inventory-controller.js";
import { createDatabase } from "./database/connection.js";
import { InventoryRepository } from "./repositories/inventory-repository.js";
import { InventoryService } from "./services/inventory-service.js";

const database = await createDatabase();
const repository = new InventoryRepository(database);
const service = new InventoryService(repository);
const controller = createInventoryController(service);
const app = createApp({ controller, serviceName: config.name });
const server = app.listen(config.port, () => console.log(`[${config.name}] Listening at http://localhost:${config.port}`));

function shutdown() {
  server.close(async () => { await database.end(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
