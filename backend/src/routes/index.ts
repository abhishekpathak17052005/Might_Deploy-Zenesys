import { Router } from "express";
import { sendSuccess } from "../utils/apiResponse";
import authRouter from "./auth.routes";
import invoiceRouter from "./invoice.routes";
import organizationRouter from "./organization.routes";
import vendorRouter from "./vendor.routes";
import { approvalRouter } from "../modules/approvals";
import { auditRouter } from "../modules/audit/audit.routes";
import { anomalyRouter } from "../modules/anomaly/anomaly.routes";
import { verifyJWTToken, requireRole } from "../middleware/auth.middleware";

export const router = Router();

router.get("/health", (_req, res) => {
  return sendSuccess(res, {
    message: "InvoiceFlow backend running — MongoDB mode",
    timestamp: new Date().toISOString()
  });
});

// MongoDB Authentication Routes
router.use("/auth", authRouter);

// Organization Management Routes
router.use("/organizations", organizationRouter);

// Invoice Management Routes
router.use("/invoices", invoiceRouter);

// Vendor Routes
router.use("/vendor", vendorRouter);

// Finance / Approval Routes
router.use("/finance", approvalRouter);

// Audit Routes
router.use("/audit", auditRouter);
router.use("/anomaly", verifyJWTToken, requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"), anomalyRouter);

// API v1 Compatibility Aliases
router.use("/v1/vendors", vendorRouter);
router.use("/v1/vendor", vendorRouter);
router.use("/v1/invoices", invoiceRouter);
router.use("/v1/auth", authRouter);
router.use("/v1/organizations", organizationRouter);
router.use("/v1/finance", approvalRouter);

