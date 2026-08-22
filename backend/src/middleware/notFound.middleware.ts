import type { RequestHandler } from "express";
import { sendError } from "../utils/apiResponse";

export const notFoundMiddleware: RequestHandler = (req, res) => {
  return sendError(res, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} not found`, 404);
};
