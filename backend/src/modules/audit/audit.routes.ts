import { Router, Request, Response, NextFunction } from "express";
import { verifyJWTToken, requireRole } from "../../middleware/auth.middleware";
import { sendSuccess, sendError } from "../../utils/apiResponse";
import { auditService } from "./audit.service";

export const auditRouter = Router();

auditRouter.post("/test", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogId = await auditService.createAuditLog({
      userId: req.user?.uid ?? "unknown",
      action: "TEST_AUDIT_LOG",
      entityType: "SYSTEM",
      entityId: "phase-1",
      details: {
        source: "phase-1-connectivity-test"
      }
    });

    const savedAuditLog = await auditService.getAuditLogById(auditLogId);

    return sendSuccess(res, {
      message: "Audit log write/read successful",
      auditLog: savedAuditLog
    });
  } catch (error) {
    next(error);
  }
});

auditRouter.get(
  "/entity/:type/:id",
  verifyJWTToken,
  requireRole("ORGANIZATION_ADMIN", "FINANCE_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, id } = req.params;
      const logs = await auditService.getAuditLogsForEntity(type, id);
      return sendSuccess(res, { logs });
    } catch (error) {
      next(error);
    }
  }
);

auditRouter.get(
  "/:id",
  verifyJWTToken,
  requireRole("ORGANIZATION_ADMIN", "FINANCE_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const log = await auditService.getAuditLogById(req.params.id);
      if (!log) {
        return sendError(res, "NOT_FOUND", "Audit log not found", 404);
      }
      return sendSuccess(res, { log });
    } catch (error) {
      next(error);
    }
  }
);
