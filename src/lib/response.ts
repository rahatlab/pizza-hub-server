import type { Response } from "express";

export type ErrorCodes =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_SERVER_ERROR";

export const STATUS_BY_CODE: Record<ErrorCodes, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
};

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode = 200
): void {
  res.status(statusCode).json({ success: true, message, data });
}

export function sendError(
  res: Response,
  code: ErrorCodes,
  message: string,
  details?: unknown
): void {
  const statusCode = STATUS_BY_CODE[code];
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    error: { code, ...(details !== undefined ? { details } : {}) },
  });
}
