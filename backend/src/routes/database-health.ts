import { Router, Request, Response } from "express";
import { isDatabaseConnected, getDatabaseStats } from "../config/database";
import { sendError, sendSuccess } from "../utils/apiResponse";

export const databaseHealthRouter = Router();

/**
 * GET /api/database/health
 * Check MongoDB connection status
 */
databaseHealthRouter.get("/health", async (req: Request, res: Response) => {
  try {
    const isConnected = isDatabaseConnected();
    const stats = getDatabaseStats();

    if (!isConnected) {
      return sendError(
        res,
        "DATABASE_DISCONNECTED",
        "MongoDB is not connected",
        503
      );
    }

    return sendSuccess(res, {
      status: "healthy",
      message: "MongoDB connection is healthy",
      database: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(
      res,
      "DATABASE_ERROR",
      `Database health check failed: ${message}`,
      503
    );
  }
});

/**
 * GET /api/database/stats
 * Get detailed database statistics
 */
databaseHealthRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = getDatabaseStats();

    return sendSuccess(res, {
      database: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(res, "DATABASE_ERROR", message, 500);
  }
});

/**
 * POST /api/database/test
 * Test database read/write operations
 */
databaseHealthRouter.post("/test", async (req: Request, res: Response) => {
  try {
    const isConnected = isDatabaseConnected();

    if (!isConnected) {
      return sendError(res, "DATABASE_DISCONNECTED", "MongoDB is not connected", 503);
    }

    // Test database connection with a ping-like operation
    const adminDb = require("mongoose").connection.db?.admin();
    
    if (!adminDb) {
      throw new Error("Unable to access admin database");
    }

    const pingResult = await adminDb.ping();

    return sendSuccess(res, {
      message: "Database test successful",
      ping: pingResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(res, "DATABASE_TEST_FAILED", message, 500);
  }
});

export default databaseHealthRouter;
