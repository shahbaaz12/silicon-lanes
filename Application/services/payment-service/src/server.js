import { createApp } from "./app.js";
import { config } from "./config.js";
import { createPaymentController } from "./controllers/payment-controller.js";
import { createDatabase } from "./database/connection.js";
import { PaymentRepository } from "./repositories/payment-repository.js";
import { PaymentService } from "./services/payment-service.js";

const database = createDatabase();
const repository = new PaymentRepository(database);
const service = new PaymentService(repository);
const controller = createPaymentController(service);
const app = createApp({ controller, serviceName: config.name });
const server = app.listen(config.port, () => console.log(`[${config.name}] Listening at http://localhost:${config.port}`));

function shutdown() {
  server.close(() => { database.close(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

