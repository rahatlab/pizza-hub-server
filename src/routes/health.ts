import { Router } from "express";
import { sendSuccess } from "../lib/response.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  sendSuccess(res, { status: "ok", service: "pizzahub-server" }, "Server is running");
});
