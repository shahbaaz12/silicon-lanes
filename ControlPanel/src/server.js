import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 7012);

createApp().listen(port, "127.0.0.1", () => {
  console.log(`[control-panel] Open http://localhost:${port}`);
});
