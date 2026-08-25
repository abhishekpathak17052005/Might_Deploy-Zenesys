import { Router, Request, Response, NextFunction } from "express";
import { invoiceService } from "../services/InvoiceService";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { verifyJWTToken, requireRole } from "../middleware/auth.middleware";

export const invoiceRouter = Router();

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
      if (!req.user) {
        return sendError(res, "UNAUTHORIZED", "User not found", 401);
      }

      const { invoiceNumber, vendorId, vendorName, invoiceDate, dueDate, totalAmount, gstin, poNumber, description, attachmentUrl, lineItems } = req.body;

      // Validate required fields
      if (!invoiceNumber || !vendorId || !invoiceDate || !totalAmount || !lineItems) {
        return sendError(res, "VALIDATION_ERROR", "Missing required fields", 400);
      }

      const invoice = await invoiceService.createInvoice(
        {
          invoiceNumber,
          vendorId,
          vendorName,
          invoiceDate: new Date(invoiceDate),
          dueDate: dueDate ? new Date(dueDate) : undefined,
          totalAmount,
          gstin,
          poNumber,
          description,
          attachmentUrl,
          lineItems,
        },
        req.user.uid
      );

      return sendSuccess(res, { invoice }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create invoice";
      return sendError(res, "CREATE_ERROR", message, 400);
    }
  }
);

/**
 * GET /api/invoices
 * Get all invoices with filters
 */
invoiceRouter.get("/", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendorId, status, uploadedBy, page = 1, limit = 20 } = req.query;

    const skip = ((Number(page) || 1) - 1) * Number(limit);

    const result = await invoiceService.getInvoices({
      vendorId: vendorId as string,
      status: status as string,
      uploadedBy: uploadedBy as string,
      skip,
      limit: Number(limit),
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id
 * Get invoice by ID
 */
invoiceRouter.get("/:id", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const invoice = await invoiceService.getInvoiceById(id);

    if (!invoice) {
      return sendError(res, "NOT_FOUND", "Invoice not found", 404);
    }

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
  requireRole("FINANCE_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return sendError(res, "UNAUTHORIZED", "User not found", 401);
      }

      const { id } = req.params;
      const { status, rejectionReason } = req.body;

      // Validate status
      if (!status || !["APPROVED", "REJECTED", "ON_HOLD"].includes(status)) {
        return sendError(res, "VALIDATION_ERROR", "Invalid status", 400);
      }

      const invoice = await invoiceService.updateInvoiceStatus(id, status, req.user.uid, rejectionReason);

      if (!invoice) {
        return sendError(res, "NOT_FOUND", "Invoice not found", 404);
      }

      return sendSuccess(res, { invoice });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update invoice";
      return sendError(res, "UPDATE_ERROR", message, 400);
    }
  }
);

/**
 * DELETE /api/invoices/:id
 * Delete invoice (Procurement Officer can delete own invoices, Admin can delete any)
 */
invoiceRouter.delete(
  "/:id",
  verifyJWTToken,
  requireRole("PROCUREMENT_OFFICER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return sendError(res, "UNAUTHORIZED", "User not found", 401);
      }

      const { id } = req.params;

      const invoice = await invoiceService.getInvoiceById(id);

      if (!invoice) {
        return sendError(res, "NOT_FOUND", "Invoice not found", 404);
      }

      // Check authorization
      if (
        req.user.role !== "ADMIN" &&
        invoice.uploadedBy.toString() !== req.user.uid
      ) {
        return sendError(res, "FORBIDDEN", "You can only delete your own invoices", 403);
      }

      await invoiceService.deleteInvoice(id);

      return sendSuccess(res, { message: "Invoice deleted successfully" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete invoice";
      return sendError(res, "DELETE_ERROR", message, 400);
    }
  }
);

/**
 * GET /api/invoices/pending
 * Get pending invoices (Finance Manager only)
 */
invoiceRouter.get("/status/pending", verifyJWTToken, requireRole("FINANCE_MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = ((Number(page) || 1) - 1) * Number(limit);

    const result = await invoiceService.getPendingInvoices(skip, Number(limit));

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

export default invoiceRouter;
