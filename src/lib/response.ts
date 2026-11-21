import type { Response } from "express";

/** Every API response uses one envelope so the client can parse consistently. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: string[];
}

export function ok<T>(res: Response, data: T, message?: string, status = 200): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T, message?: string): Response {
  return ok(res, data, message, 201);
}

export function fail(
  res: Response,
  status: number,
  message: string,
  errors?: string[],
): Response {
  const body: ApiFailure = { success: false, message };
  if (errors?.length) body.errors = errors;
  return res.status(status).json(body);
}

/** 401 — no token, invalid token, or expired token. */
export const unauthorized = (res: Response, message = "Authentication required") =>
  fail(res, 401, message);

/** 403 — authenticated but wrong role / not the resource owner. */
export const forbidden = (res: Response, message = "You do not have access to this resource") =>
  fail(res, 403, message);

export const notFound = (res: Response, message = "Resource not found") =>
  fail(res, 404, message);

export const badRequest = (res: Response, message = "Invalid request", errors?: string[]) =>
  fail(res, 400, message, errors);

export const conflict = (res: Response, message = "Resource already exists") =>
  fail(res, 409, message);

export const serverError = (res: Response, message = "Something went wrong") =>
  fail(res, 500, message);
