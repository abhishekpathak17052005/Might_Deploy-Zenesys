import { Request, Response, NextFunction } from "express";

/**
 * Request logging middleware
 * Logs all HTTP requests for monitoring and debugging
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach request ID to response for tracking
  res.setHeader("X-Request-ID", requestId);
  (req as any).requestId = requestId;

  // Log request
  console.log(`[${requestId}] ${req.method} ${req.path} - Started`);

  // Hook response end to log completion
  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusColor =
      statusCode >= 500
        ? "\x1b[31m" // red
        : statusCode >= 400
          ? "\x1b[33m" // yellow
          : statusCode >= 300
            ? "\x1b[36m" // cyan
            : "\x1b[32m"; // green

    console.log(
      `[${requestId}] ${statusColor}${statusCode}\x1b[0m ${req.method} ${req.path} - ${duration}ms`
    );

    return originalEnd.apply(res, args);
  };

  next();
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
