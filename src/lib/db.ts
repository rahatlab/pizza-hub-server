import mongoose from "mongoose";
import { env } from "../config/env.js";

mongoose.set("strictQuery", true);

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Lazily connects on first use instead of at import time.
 * Keeps `npm run build` (type-check) and unit tests from
 * requiring a running MongoDB instance.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  connecting = mongoose
    .connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000,
    })
    .then((m) => {
      console.log(`→ MongoDB connected: ${m.connection.host}/${m.connection.name}`);
      return m;
    })
    .catch((error: unknown) => {
      connecting = null;
      throw error;
    });

  return connecting;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  connecting = null;
}
