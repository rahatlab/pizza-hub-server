import { Router } from "express";
import { env } from "../config/env.js";
import { badRequest, ok, serverError } from "../lib/response.js";
import { asyncHandler } from "../middleware/error.js";

export const uploadRouter = Router();

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";
const MAX_BYTES = 5 * 1024 * 1024;

/** Very small in-memory guard so a public endpoint cannot be hammered. */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;

function limited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

interface ImgBbResponse {
  success: boolean;
  status?: number;
  error?: { message?: string };
  data?: {
    url?: string;
    display_url?: string;
    delete_url?: string;
    thumb?: { url?: string };
  };
}

/**
 * POST /api/upload
 *
 * The browser sends the file as a base64 data URI (it never touches a disk
 * on this server) and ImgBB returns the hosted URL that gets saved on the
 * menu item or user profile. The API key stays server-side.
 */
uploadRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!env.IMGBB_API_KEY) {
      serverError(res, "Image hosting is not configured on this server");
      return;
    }

    if (limited(req.ip ?? "unknown")) {
      badRequest(res, "Too many uploads, please try again later");
      return;
    }

    const raw = (req.body as { image?: unknown } | undefined)?.image;
    if (typeof raw !== "string" || raw.length === 0) {
      badRequest(res, "An image is required");
      return;
    }

    const base64 = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
      badRequest(res, "That file is not a valid image");
      return;
    }
    if (base64.length * 0.75 > MAX_BYTES) {
      badRequest(res, "Images must be 5MB or smaller");
      return;
    }

    const form = new URLSearchParams();
    form.set("key", env.IMGBB_API_KEY);
    form.set("image", base64);

    const response = await fetch(IMGBB_ENDPOINT, { method: "POST", body: form });
    const payload = (await response.json()) as ImgBbResponse;

    if (!payload.success || !payload.data?.url) {
      badRequest(res, payload.error?.message || "ImgBB rejected the upload");
      return;
    }

    return ok(
      res,
      {
        url: payload.data.url,
        displayUrl: payload.data.display_url ?? payload.data.url,
        thumb: payload.data.thumb?.url ?? payload.data.url,
        deleteUrl: payload.data.delete_url ?? "",
      },
      "Image uploaded",
    );
  }),
);
