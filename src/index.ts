import "dotenv/config";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { initSocket } from "./lib/socket.js";
import { connectDB } from "./lib/db.js";

const server = createServer(app);

initSocket(server);

connectDB().then(() => {
  server.listen(env.port, () => {
    console.log(`🍕 PizzaHub server listening on http://localhost:${env.port}`);
  });
}).catch((err) => {
  console.error("Failed to connect to MongoDB:", err);
  process.exit(1);
});
