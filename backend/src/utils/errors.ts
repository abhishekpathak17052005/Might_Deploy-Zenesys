export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const unauthorized = (message = "Authentication required") =>
  new AppError("UNAUTHORIZED", message, 401);

export const forbidden = (message = "Insufficient permissions") =>
  new AppError("FORBIDDEN", message, 403);

export const badRequest = (message = "Bad request", details?: unknown) =>
  new AppError("BAD_REQUEST", message, 400, details);

export const notFound = (message = "Resource not found") =>
  new AppError("NOT_FOUND", message, 404);
