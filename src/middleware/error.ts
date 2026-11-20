import {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { sendError } from "../lib/response.js";
import { ErrorCodes } from "../lib/response.js";

/** Custom API error with HTTP status + error code. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodes;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: ErrorCodes = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Wrap an async route handler so rejections flow to Express error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Centralized error middleware — every error maps to the standard envelope. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    sendError(res, err.code, err.message, err.statusCode);
    return;
  }

  // Multer / express payload too large
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "LIMIT_FILE_SIZE"
  ) {
    sendError(res, "PAYLOAD_TOO_LARGE", "File too large");
    return;
  }

  console.error(err);
  sendError(res, "INTERNAL_SERVER_ERROR", "Something went wrong");
}
