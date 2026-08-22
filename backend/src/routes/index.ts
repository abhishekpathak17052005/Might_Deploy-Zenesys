import { Router } from "express";
import { COLLECTIONS } from "../config/constants";
import { isFirebaseConfigured } from "../config/env";
import { firestore, storage } from "../config/firebase";
import { verifyFirebaseToken } from "../middleware/auth.middleware";
import { anomalyRouter } from "../modules/anomaly";
import { auditRouter } from "../modules/audit/audit.routes";
import { invoiceRouter } from "../modules/invoices";
import { approvalRouter } from "../modules/approvals";
import { sendError, sendSuccess } from "../utils/apiResponse";

export const router = Router();

router.get("/health", (_req, res) => {
  return sendSuccess(res, {
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

router.get("/health/firebase", async (_req, res, next) => {
  if (!isFirebaseConfigured) {
    return sendError(
      res,
      "FIREBASE_NOT_CONFIGURED",
      "Firebase credentials are not configured for this environment.",
      503
    );
  }

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
