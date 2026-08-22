import express, { type Request, type Response } from "express";
import { verifyFirebaseToken, requireRole } from "../../middleware/auth.middleware";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { approvalService } from "./approval.service";
import { invoiceDocumentService } from "../invoices/invoice.service";
import { auditService } from "../audit/audit.service";
import { approveInvoiceRequestSchema, rejectInvoiceRequestSchema } from "./approval.schema";
import type { ApprovalResponse } from "./approval.types";

export const approvalRouter = express.Router();

// GET /finance/review - List invoices awaiting Finance Manager review
approvalRouter.get(
  "/review",
  verifyFirebaseToken,
  requireRole("FINANCE_MANAGER", "CFO", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const invoices = await approvalService.listPendingReview(limit);

      return sendSuccess(res, {
        count: invoices.length,
        invoices
      });
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
  verifyFirebaseToken,
  requireRole("FINANCE_MANAGER", "CFO", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;

      const invoice = await invoiceDocumentService.getInvoiceDocument(documentId);
      if (!invoice) {
        return sendError(res, "NOT_FOUND", "Invoice not found", 404);
      }

      const approval = await approvalService.getApprovalDecision(documentId);

      return sendSuccess(res, {
        invoice,
        approval: approval || null,
        reviewPacket: {
          documentStatus: invoice.documentStatus,
          invoiceNumber: invoice.invoiceNumber,
          vendorId: invoice.vendorId,
          totalAmount: invoice.totalAmount,
          verificationResult: invoice.verificationResult || null,
          riskResult: invoice.riskResult || null,
          submittedAt: invoice.submittedAt
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("approval.get_invoice.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// POST /invoices/:documentId/approve - Approve an invoice for payment
approvalRouter.post(
  "/invoices/:documentId/approve",
  verifyFirebaseToken,
  requireRole("FINANCE_MANAGER", "CFO", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return sendError(res, "UNAUTHORIZED", "User context missing", 401);
      }

      const bodyValidation = approveInvoiceRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return sendError(res, "VALIDATION_ERROR", bodyValidation.error.message, 400);
      }

      const approval = await approvalService.approveInvoice(
        documentId,
        userId,
        userRole,
        bodyValidation.data
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
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// POST /invoices/:documentId/reject - Reject an invoice
approvalRouter.post(
  "/invoices/:documentId/reject",
  verifyFirebaseToken,
  requireRole("FINANCE_MANAGER", "CFO", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return sendError(res, "UNAUTHORIZED", "User context missing", 401);
      }

      const bodyValidation = rejectInvoiceRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return sendError(res, "VALIDATION_ERROR", bodyValidation.error.message, 400);
      }

      const approval = await approvalService.rejectInvoice(
        documentId,
        userId,
        userRole,
        bodyValidation.data
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
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// GET /finance/stats - Get approval stats (for dashboard)
approvalRouter.get(
  "/stats",
  verifyFirebaseToken,
  requireRole("FINANCE_MANAGER", "CFO", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const stats = await approvalService.getApprovalStats();
      return sendSuccess(res, stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("approval.stats.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);
