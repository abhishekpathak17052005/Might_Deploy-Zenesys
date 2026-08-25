import { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiting middleware
 * Production: Use redis-based rate limiter
 */

interface RateLimitStore {
  [userId: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export function rateLimitMiddleware(
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100 // requests per window
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.uid || req.ip || "anonymous";
    const now = Date.now();

    if (!store[userId]) {
      store[userId] = { count: 0, resetTime: now + windowMs };
    }

    const userLimit = store[userId];

    // Reset if window expired
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + windowMs;
    }

    // Check limit
    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      res.set("Retry-After", retryAfter.toString());
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Too many requests. Try again in ${retryAfter} seconds.`,
          retryAfter
        }
      });
    }

    userLimit.count++;
    res.set("X-RateLimit-Limit", maxRequests.toString());
    res.set("X-RateLimit-Remaining", (maxRequests - userLimit.count).toString());

    next();
  };
}

/**
 * Cleanup old entries (run periodically)
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const userId in store) {
    if (now > store[userId].resetTime) {
      delete store[userId];
    }
  }
}

// Clean up every hour
setInterval(cleanupRateLimitStore, 60 * 60 * 1000);
