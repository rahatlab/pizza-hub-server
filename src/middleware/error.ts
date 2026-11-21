import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env.js";
import { badRequest, serverError } from "../lib/response.js";

/** Wraps an async route so rejected promises reach the error handler. */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(handler(req as T, res, next)).catch(next);
  };
}

/** 404 for any route that was not matched. */
export function notFoundHandler(req: Request, res: Response): void {
  void badRequest(res, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Central error handler. Zod validation errors become a 400 with field
 * messages; everything else becomes a 500 without leaking internals.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    const errors = error.issues.map(
      (issue) => `${issue.path.join(".") || "value"}: ${issue.message}`,
    );
    void badRequest(res, "Validation failed", errors);
    return;
  }

  // Mongoose duplicate key
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    void badRequest(res, "That record already exists");
    return;
  }

  if (!isProduction) {
    console.error("✖ Unhandled error:", error);
  }

  void serverError(res, isProduction ? "Something went wrong" : describe(error));
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
