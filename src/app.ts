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
import { healthRouter } from "./routes/health.js";

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

app.use((_req: Request, res: Response) => {
  sendError(res, "NOT_FOUND", "Route not found");
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const isPayloadTooLarge =
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: string }).type === "entity.too.large";

  if (isPayloadTooLarge) {
    sendError(res, "PAYLOAD_TOO_LARGE", "Payload too large");
    return;
  }

  console.error(err);
  sendError(res, "INTERNAL_SERVER_ERROR", "Something went wrong");
});
