import { createServer } from "node:http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { initSocket } from "./lib/socket.js";

const server = createServer(app);

initSocket(server);

server.listen(env.port, () => {
  console.log(`🍕 PizzaHub server listening on http://localhost:${env.port}`);
});
