import { Router } from "express";
import { verifyFirebaseToken } from "../../middleware/auth.middleware";
import { sendSuccess } from "../../utils/apiResponse";
import { auditService } from "./audit.service";

export const auditRouter = Router();

auditRouter.post("/test", verifyFirebaseToken, async (req, res, next) => {
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
