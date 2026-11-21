import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./lib/db.js";

async function bootstrap(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`\n🍕 PizzaHub API listening on http://localhost:${env.PORT}`);
    console.log(`   env: ${env.NODE_ENV}`);
    console.log(`   cors origins: ${clientOriginsLabel()}\n`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down…`);
    server.close(() => {
      void disconnectDB().finally(() => process.exit(0));
    });
    // Force exit if connections hang
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    console.error("✖ Unhandled rejection:", reason);
  });
}

function clientOriginsLabel(): string {
  // Imported lazily to keep the boot log readable
  const raw = process.env.CLIENT_ORIGIN ?? "";
  return raw || "(none set)";
}

void bootstrap().catch((error: unknown) => {
  console.error("✖ Failed to start server:", error);
  process.exit(1);
});
