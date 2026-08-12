import { createApp } from "./app.js";
import { config } from "./config.js";
import { createProductController } from "./controllers/product-controller.js";
import { createDatabase } from "./database/connection.js";
import { ProductRepository } from "./repositories/product-repository.js";
import { ProductService } from "./services/product-service.js";

const database = await createDatabase();
const repository = new ProductRepository(database);
const service = new ProductService(repository);
const controller = createProductController(service);
const app = createApp({ controller, serviceName: config.name });
const server = app.listen(config.port, () => console.log(`[${config.name}] Listening at http://localhost:${config.port}`));

function shutdown() {
  server.close(async () => { await database.end(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
