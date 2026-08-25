import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env";
import { sendError } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return sendError(res, error.code, error.message, error.statusCode);
  }

  if (error instanceof ZodError) {
    return sendError(res, "VALIDATION_ERROR", "Request validation failed", 400);
  }

  const firebaseCode = typeof error?.code === "string" ? error.code : undefined;

  if (firebaseCode?.startsWith("auth/") || firebaseCode?.startsWith("firestore/") || firebaseCode?.startsWith("storage/")) {
    return sendError(res, "FIREBASE_ERROR", "Firebase operation failed", 502);
  }

  const message = isProduction ? "Internal server error" : error?.message ?? "Internal server error";

  return sendError(res, "INTERNAL_SERVER_ERROR", message, 500);
};
