import { Router, Request, Response, NextFunction } from "express";
import { invoiceService } from "../services/InvoiceService";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { verifyJWTToken, requireRole } from "../middleware/auth.middleware";
import { invoiceRouter as pipelineRouter } from "../modules/invoices/invoice.routes";

export const invoiceRouter = Router();

// Mount pipeline routes (/upload, /:documentId/extract, /:documentId/process, /:documentId/download)
invoiceRouter.use(pipelineRouter);

/**
 * POST /api/invoices
 * Create a new invoice (Procurement Officer only)
 */
invoiceRouter.post(
  "/",
  verifyJWTToken,
  requireRole("PROCUREMENT_OFFICER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);

      const { invoiceNumber, vendorId, vendorName, invoiceDate, dueDate, totalAmount, gstin, poNumber, description, attachmentUrl, lineItems } = req.body;

      if (!invoiceNumber || !vendorId || !invoiceDate || totalAmount === undefined || !lineItems) {
        return sendError(res, "VALIDATION_ERROR", "Missing required fields: invoiceNumber, vendorId, invoiceDate, totalAmount, lineItems", 400);
      }

      const invoice = await invoiceService.createInvoice(
        { invoiceNumber, vendorId, vendorName, invoiceDate: new Date(invoiceDate), dueDate: dueDate ? new Date(dueDate) : undefined, totalAmount: Number(totalAmount), gstin, poNumber, description, attachmentUrl, lineItems },
        req.user.uid
      );

      return sendSuccess(res, { invoice }, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/invoices
 * Get invoices with filters (scoped to requesting user's org and role)
 */
invoiceRouter.get("/", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
    const { vendorId, status, uploadedBy, page = 1, limit = 20 } = req.query;
    const skip = ((Number(page) || 1) - 1) * Number(limit);

    const result = await invoiceService.getInvoices(
      { vendorId: vendorId as string, status: status as string, uploadedBy: uploadedBy as string, skip, limit: Number(limit) },
      req.user.uid
    );

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

// GET /api/invoices/procurement/pending - Procurement inbox
invoiceRouter.get(
  "/procurement/pending",
  verifyJWTToken,
  requireRole("PROCUREMENT_OFFICER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) return sendError(res, "FORBIDDEN", "User is not associated with an organization", 403);
      const result = await invoiceService.getOrganizationInvoices(req.user.organizationId, {
        status: req.query.status as string || "SUBMITTED",
        limit: Number(req.query.limit) || 20,
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/invoices/:id/procurement/verify - Forward to Finance
invoiceRouter.post(
  "/:id/procurement/verify",
  verifyJWTToken,
  requireRole("PROCUREMENT_OFFICER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
      const invoice = await invoiceService.verifyForFinance(req.params.id, req.user.uid, req.user.organizationId);
      return sendSuccess(res, { invoice });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/invoices/:id/procurement/return - Return to Vendor
invoiceRouter.post(
  "/:id/procurement/return",
  verifyJWTToken,
  requireRole("PROCUREMENT_OFFICER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!reason) return sendError(res, "VALIDATION_ERROR", "A return reason is required", 400);
      const invoice = await invoiceService.returnToVendor(req.params.id, req.user.uid, reason, req.user.organizationId);
      return sendSuccess(res, { invoice });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/invoices/status/pending
 * Get pending invoices for finance review (Finance Manager only)
 */
invoiceRouter.get(
  "/status/pending",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
      const { page = 1, limit = 20 } = req.query;
      const skip = ((Number(page) || 1) - 1) * Number(limit);
      const result = await invoiceService.getPendingInvoices(req.user.uid, skip, Number(limit));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/invoices/:id
 * Get invoice by ID (org-scoped)
 */
invoiceRouter.get("/:id", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.user.uid);
    if (!invoice) return sendError(res, "NOT_FOUND", "Invoice not found", 404);
    return sendSuccess(res, { invoice });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/invoices/:id/status
 * Update invoice status (Finance Manager only)
 */
invoiceRouter.put(
  "/:id/status",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
      const { status, rejectionReason } = req.body;

      if (!status || !["APPROVED", "REJECTED", "ON_HOLD"].includes(status)) {
        return sendError(res, "VALIDATION_ERROR", "Invalid status. Allowed: APPROVED, REJECTED, ON_HOLD", 400);
      }

      const invoice = await invoiceService.updateInvoiceStatus(req.params.id, status, req.user.uid, rejectionReason);
      if (!invoice) return sendError(res, "NOT_FOUND", "Invoice not found", 404);
      return sendSuccess(res, { invoice });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/invoices/:id
 * Delete invoice (uploader or org admin only)
 */
invoiceRouter.delete(
  "/:id",
  verifyJWTToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return sendError(res, "UNAUTHORIZED", "User not found", 401);
      await invoiceService.deleteInvoice(req.params.id, req.user.uid);
      return sendSuccess(res, { message: "Invoice deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default invoiceRouter;
