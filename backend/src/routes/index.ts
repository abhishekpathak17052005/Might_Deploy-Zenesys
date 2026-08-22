import { Router } from "express";
import { COLLECTIONS } from "../config/constants";
import { firestore, storage } from "../config/firebase";
import { verifyFirebaseToken } from "../middleware/auth.middleware";
import { anomalyRouter } from "../modules/anomaly";
import { auditRouter } from "../modules/audit/audit.routes";
import { invoiceRouter } from "../modules/invoices";
import { approvalRouter } from "../modules/approvals";
import { sendSuccess } from "../utils/apiResponse";

export const router = Router();

router.get("/health", (_req, res) => {
  return sendSuccess(res, {
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

router.get("/health/firebase", async (_req, res, next) => {
  try {
    await firestore.collection(COLLECTIONS.auditLogs).limit(1).get();

    return sendSuccess(res, {
      message: "Firebase connection is healthy",
      services: {
        firestore: "connected",
        storage: storage.bucket().name,
        auth: "configured"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", verifyFirebaseToken, (req, res) => {
  return sendSuccess(res, {
    user: req.user
  });
});

router.use("/audit", auditRouter);
router.use("/anomaly", anomalyRouter);
router.use("/invoices", invoiceRouter);
router.use("/finance", approvalRouter);
