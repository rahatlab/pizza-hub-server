import mongoose from "mongoose";
import { env } from "../config/env.js";

let cached: mongoose.Mongoose | null = null;

/** Singleton connection for serverless-safe dev hot-reloads. */
export async function connectDB(): Promise<mongoose.Mongoose> {
  if (cached) return cached;
  cached = await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDbName,
  });
  console.log("🗄️  MongoDB connected:", env.mongodbUri);
  return cached;
}

export async function closeDB(): Promise<void> {
  if (cached) {
    await cached.disconnect();
    cached = null;
  }
}
