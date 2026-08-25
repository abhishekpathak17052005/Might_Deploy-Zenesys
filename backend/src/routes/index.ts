import { Router } from "express";
import { sendSuccess } from "../utils/apiResponse";
import { verifyJWTToken } from "../middleware/auth.middleware";
import authRouter from "./auth.routes";
import invoiceRouter from "./invoice.routes";
import organizationRouter from "./organization.routes";
import vendorRouter from "./vendor.routes";
// import { anomalyRouter } from "../modules/anomaly";
// import { auditRouter } from "../modules/audit/audit.routes";
// import { approvalRouter } from "../modules/approvals";

export const router = Router();

router.get("/health", (_req, res) => {
  return sendSuccess(res, {
    message: "Backend is running (Firebase removed - MongoDB mode)",
    timestamp: new Date().toISOString()
  });
});

// MongoDB Authentication Routes
router.use("/auth", authRouter);

// Organization Management Routes
router.use("/organizations", organizationRouter);

// Invoice Management Routes
router.use("/invoices", invoiceRouter);

// Vendor Routes (Phase 3)
router.use("/vendor", vendorRouter);

// Modules temporarily disabled while removing Firebase
// router.use("/audit", auditRouter);
// router.use("/anomaly", anomalyRouter);
// router.use("/finance", approvalRouter);
