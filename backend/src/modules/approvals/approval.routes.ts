import express, { type Request, type Response } from "express";
import { verifyJWTToken, requireRole } from "../../middleware/auth.middleware";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { approvalService } from "./approval.service";
import { Invoice } from "../../models/Invoice";
import { approveInvoiceRequestSchema, rejectInvoiceRequestSchema } from "./approval.schema";
import type { ApprovalResponse } from "./approval.types";

export const approvalRouter = express.Router();

approvalRouter.get("/stats", verifyJWTToken, requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"), async (req: Request, res: Response): Promise<Response> => {
  try {
    const match: Record<string, unknown> = {};
    if (req.user?.organizationId) match.organizationId = req.user.organizationId;
    const rows = await Invoice.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$totalAmount" } } }
    ]);
    const totals = rows.reduce((out, row) => {
      if (row._id === "APPROVED") out.approved = row.count;
      else if (row._id === "REJECTED") out.rejected = row.count;
      else { out.pending += row.count; out.totalValue += row.value; }
      return out;
    }, { pending: 0, approved: 0, rejected: 0, totalValue: 0 });
    return sendSuccess(res, totals);
  } catch {
    return sendError(res, "INTERNAL_ERROR", "Unable to load finance statistics", 500);
  }
});

// GET /finance/review - List invoices awaiting Finance Manager review
approvalRouter.get(
  "/review",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const organizationId = req.user?.organizationId;
      const invoices = await approvalService.listPendingReview(limit, organizationId);

      return sendSuccess(res, { count: invoices.length, invoices });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("approval.list_pending.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// GET /finance/invoices/:documentId - Get full review packet for an invoice
approvalRouter.get(
  "/invoices/:documentId",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;

      const invoice = await Invoice.findById(documentId)
        .populate("vendorId", "name gstin")
        .populate("uploadedBy", "name email");

      if (!invoice) return sendError(res, "NOT_FOUND", "Invoice not found", 404);

      // Enforce org isolation
      if (req.user?.organizationId && invoice.organizationId.toString() !== req.user.organizationId) {
        return sendError(res, "FORBIDDEN", "You do not have access to this invoice", 403);
      }

      const approval = await approvalService.getApprovalDecision(documentId);

      return sendSuccess(res, {
        invoice,
        approval: approval || null,
        reviewPacket: {
          status: invoice.status,
          invoiceNumber: invoice.invoiceNumber,
          vendorId: invoice.vendorId,
          totalAmount: invoice.totalAmount,
          riskScore: invoice.riskScore,
          riskLevel: invoice.riskLevel,
          anomalies: invoice.anomalies,
          ocrResult: invoice.ocrResult,
          submittedAt: invoice.createdAt,
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// POST /finance/invoices/:documentId/approve
approvalRouter.post(
  "/invoices/:documentId/approve",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;
      const userRole = req.user?.role;

      if (!userId || !userRole) return sendError(res, "UNAUTHORIZED", "User context missing", 401);

      const bodyValidation = approveInvoiceRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return sendError(res, "VALIDATION_ERROR", bodyValidation.error.message, 400);
      }

      const approval = await approvalService.approveInvoice(
        documentId,
        userId,
        userRole,
        bodyValidation.data,
        req.user?.organizationId
      );

      const response: ApprovalResponse = {
        invoiceId: approval.invoiceId,
        decision: "APPROVED",
        approverUserId: approval.approverUserId,
        decisionTimestamp: approval.decisionTimestamp.toISOString(),
        documentStatus: "APPROVED"
      };

      return sendSuccess(res, response, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("approval.approve.failed", { error: message });
      if (message.includes("Unauthorized") || message.includes("Separation of duties")) {
        return sendError(res, "FORBIDDEN", message, 403);
      }
      if (message.includes("not found")) {
        return sendError(res, "NOT_FOUND", message, 404);
      }
      return sendError(res, "INTERNAL_ERROR", message, 400);
    }
  }
);

// POST /finance/invoices/:documentId/reject
approvalRouter.post(
  "/invoices/:documentId/reject",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;
      const userRole = req.user?.role;

      if (!userId || !userRole) return sendError(res, "UNAUTHORIZED", "User context missing", 401);

      const bodyValidation = rejectInvoiceRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return sendError(res, "VALIDATION_ERROR", bodyValidation.error.message, 400);
      }

      const approval = await approvalService.rejectInvoice(
        documentId,
        userId,
        userRole,
        bodyValidation.data,
        req.user?.organizationId
      );

      const response: ApprovalResponse = {
        invoiceId: approval.invoiceId,
        decision: "REJECTED",
        approverUserId: approval.approverUserId,
        decisionTimestamp: approval.decisionTimestamp.toISOString(),
        documentStatus: "REJECTED"
      };

      return sendSuccess(res, response, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("approval.reject.failed", { error: message });
      if (message.includes("Unauthorized")) {
        return sendError(res, "FORBIDDEN", message, 403);
      }
      if (message.includes("not found")) {
        return sendError(res, "NOT_FOUND", message, 404);
      }
      return sendError(res, "INTERNAL_ERROR", message, 400);
    }
  }
);

// GET /finance/stats
approvalRouter.get(
  "/stats",
  verifyJWTToken,
  requireRole("FINANCE_MANAGER", "ORGANIZATION_ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const stats = await approvalService.getApprovalStats(req.user?.organizationId);
      return sendSuccess(res, stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);
