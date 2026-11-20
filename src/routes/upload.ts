import { Router } from "express";
import { verifyJWT, loadUserFresh, blockCheck } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { ErrorCodes } from "../lib/response.js";
import { env } from "../config/env.js";

const router = Router();

/** POST /api/upload — ImgBB proxy (server key never exposed to client) */
router.post(
  "/",
  verifyJWT,
  loadUserFresh,
  blockCheck,
  asyncHandler(async (req, res) => {
    const { imageBase64, name } = req.body;

    if (!imageBase64) {
      sendError(res, "VALIDATION_ERROR", "Image data required");
      return;
    }

    // Base64 size guard (~2MB)
    const base64Len = Buffer.byteLength(imageBase64, "base64");
    if (base64Len > 2 * 1024 * 1024) {
      sendError(res, "PAYLOAD_TOO_LARGE", "Image too large (max 2MB)");
      return;
    }

    if (!env.imgbbApiKey) {
      sendError(res, "INTERNAL_SERVER_ERROR", "ImgBB not configured on server");
      return;
    }

    const formData = new FormData();
    formData.append("image", imageBase64);
    if (name) formData.append("name", name);

    const imgbbRes = await fetch(
      `https://api.imgbb.com/1/upload?key=${env.imgbbApiKey}`,
      { method: "POST", body: formData }
    );

    if (!imgbbRes.ok) {
      sendError(res, "INTERNAL_SERVER_ERROR", "Image upload failed");
      return;
    }

    const data = await imgbbRes.json();
    if (!data.success || !data.data?.url) {
      sendError(res, "INTERNAL_SERVER_ERROR", "ImgBB returned invalid response");
      return;
    }

    sendSuccess(res, { url: data.data.url, deleteUrl: data.data.delete_url }, "Image uploaded");
  })
);

export default router;
