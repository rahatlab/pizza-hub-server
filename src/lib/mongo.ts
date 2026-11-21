import mongoose from "mongoose";
import type { Db } from "mongodb";
import { env } from "../config/env.js";

/**
 * Better Auth's MongoDB adapter expects a `Db` instance the moment the
 * config is built — which happens at import time, long before a request
 * has opened a connection.
 *
 * This proxy defers every driver call until the first real query, so the
 * adapter can be constructed statically while the connection itself stays
 * lazy (keeping `npm run build` and unit tests free of a running MongoDB).
 */
export const dbProxy = new Proxy({} as Db, {
  get(_target, property) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error(
        "MongoDB is not connected yet — call connectDB() before using the database",
      );
    }
    const value = Reflect.get(db as object, property, db);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

/** Name of the database PizzaHub writes to. */
export const mongoDbName = env.MONGODB_DB_NAME;
