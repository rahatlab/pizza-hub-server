import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { sendError } from "./lib/response.js";
import { errorMiddleware } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import authRouter from "./routes/auth.js";
import menuRouter from "./routes/menu.js";
import vendorMenuRouter from "./routes/vendor-menu.js";
import uploadRouter from "./routes/upload.js";
import orderRouter from "./routes/orders.js";
import vendorOrderRouter from "./routes/vendor-orders.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.clientUrl],
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/health", healthRouter);

/** better-auth + custom JWT issue at /api/auth/* */
app.use("/api/auth", authRouter);

/** Public menu */
app.use("/api/menu", menuRouter);

/** Vendor menu (role: vendor + ownership) */
app.use("/api/vendor/menu", vendorMenuRouter);

/** Image upload → ImgBB (server proxy) */
app.use("/api/upload", uploadRouter);

/** Customer orders */
app.use("/api", orderRouter);

/** Vendor orders */
app.use("/api/vendor/orders", vendorOrderRouter);

/** Raw body route(s) must come before express.json() — none yet (Stripe webhook in Part 8). */

app.use((_req: Request, res: Response) => {
  sendError(res, "NOT_FOUND", "Route not found");
});

app.use(errorMiddleware);
