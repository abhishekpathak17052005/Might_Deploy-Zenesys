/**
 * Approval Service - MongoDB implementation
 * Replaces the previous Firestore-based implementation.
 * All reads/writes go through Mongoose/MongoDB.
 */
import { Invoice, IInvoice } from "../../models/Invoice";
import { AuditLog } from "../../models/AuditLog";
import { Types } from "mongoose";
import type { ApprovalDecision, ApproveInvoiceRequest, RejectInvoiceRequest } from "./approval.types";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// MongoDB Approval Decision Model (embedded in Invoice + standalone AuditLog)
// ============================================================================

class ApprovalService {
  /**
   * Approve an invoice (Finance Manager decision).
   * Uses atomic conditional update to prevent duplicate approvals.
   */
  async approveInvoice(
    invoiceId: string,
    approverUserId: string,
    approverRole: string,
    request: ApproveInvoiceRequest,
    organizationId?: string
  ): Promise<ApprovalDecision> {
    const existing = await Invoice.findById(invoiceId);
    if (!existing) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Tenant isolation: verify organization match
    if (organizationId && existing.organizationId.toString() !== organizationId) {
      throw new Error("Unauthorized cross-organization access to invoice");
    }

    // Separation of duties: Prevent uploader from approving their own invoice
    const uploaderId = (existing.uploadedBy as any)?._id?.toString() || existing.uploadedBy?.toString();
    if (uploaderId && uploaderId === approverUserId) {
      throw new Error("Separation of duties violation: Invoice uploader cannot approve their own invoice");
    }

    const eligibleStatuses = ["FINANCE_REVIEW"];
    if (!eligibleStatuses.includes(existing.status)) {
      throw new Error(
        `Cannot approve invoice in '${existing.status}' status. Must be in one of: ${eligibleStatuses.join(", ")}`
      );
    }

    const now = new Date();
    const approvalId = uuidv4();

    // Atomic conditional update: only succeeds if invoice is in eligible status
    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invoiceId),
        ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
        status: { $in: eligibleStatuses },
      },
      {
        $set: {
          status: "APPROVED",
          approvedBy: new Types.ObjectId(approverUserId),
          "approvalDecision.decision": "APPROVED",
          "approvalDecision.approverUserId": approverUserId,
          "approvalDecision.approverRole": approverRole,
          "approvalDecision.comments": request.comments,
          "approvalDecision.timestamp": now,
          "approvalDecision.id": approvalId,
        },
      },
      { new: true }
    );

    if (!invoice) {
      throw new Error(`Invoice update conflict or invalid status during approval: ${invoiceId}`);
    }

    // Persist audit event
    await this._persistAuditEvent({
      organizationId: invoice.organizationId.toString(),
      actorId: approverUserId,
      action: "INVOICE_APPROVED",
      resourceId: invoiceId,
      previousState: { status: existing.status },
      newState: { status: "APPROVED", comments: request.comments },
    });

    console.info("invoice.approved", { invoiceId, approverUserId, approverRole, approvalId });

    return {
      id: approvalId,
      invoiceId,
      decision: "APPROVED",
      approverUserId,
      approverRole,
      comments: request.comments,
      decisionTimestamp: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Reject an invoice (Finance Manager decision).
   */
  async rejectInvoice(
    invoiceId: string,
    approverUserId: string,
    approverRole: string,
    request: RejectInvoiceRequest,
    organizationId?: string
  ): Promise<ApprovalDecision> {
    const existing = await Invoice.findById(invoiceId);
    if (!existing) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Tenant isolation: verify organization match
    if (organizationId && existing.organizationId.toString() !== organizationId) {
      throw new Error("Unauthorized cross-organization access to invoice");
    }

    const eligibleStatuses = ["FINANCE_REVIEW"];
    if (!eligibleStatuses.includes(existing.status)) {
      throw new Error(`Cannot reject invoice in '${existing.status}' status.`);
    }

    const now = new Date();
    const approvalId = uuidv4();
    const comments = request.comments || request.reason;

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invoiceId),
        ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
        status: { $in: eligibleStatuses },
      },
      {
        $set: {
          status: "REJECTED",
          approvedBy: new Types.ObjectId(approverUserId),
          rejectionReason: request.reason,
          "approvalDecision.decision": "REJECTED",
          "approvalDecision.approverUserId": approverUserId,
          "approvalDecision.approverRole": approverRole,
          "approvalDecision.comments": comments,
          "approvalDecision.timestamp": now,
          "approvalDecision.id": approvalId,
        },
      },
      { new: true }
    );

    if (!invoice) {
      throw new Error(`Invoice update conflict or invalid status during rejection: ${invoiceId}`);
    }

    await this._persistAuditEvent({
      organizationId: invoice.organizationId.toString(),
      actorId: approverUserId,
      action: "INVOICE_REJECTED",
      resourceId: invoiceId,
      previousState: { status: existing.status },
      newState: { status: "REJECTED", reason: request.reason },
    });

    console.info("invoice.rejected", { invoiceId, approverUserId, approverRole, reason: request.reason, approvalId });

    return {
      id: approvalId,
      invoiceId,
      decision: "REJECTED",
      approverUserId,
      approverRole,
      comments,
      decisionTimestamp: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get approval decision for an invoice (from embedded field).
   */
  async getApprovalDecision(invoiceId: string): Promise<ApprovalDecision | null> {
    const invoice = await Invoice.findById(invoiceId).select("approvalDecision status");
    if (!invoice) return null;
    const ad = (invoice as any).approvalDecision;
    if (!ad?.decision) return null;
    return {
      id: ad.id || "",
      invoiceId,
      decision: ad.decision,
      approverUserId: ad.approverUserId,
      approverRole: ad.approverRole,
      comments: ad.comments,
      decisionTimestamp: ad.timestamp,
      createdAt: ad.timestamp,
      updatedAt: ad.timestamp,
    };
  }

  /**
   * List invoices pending Finance Manager review (org-scoped via invoice lookup).
   */
  async listPendingReview(limit: number = 20, organizationId: string): Promise<IInvoice[]> {
    const reviewStatuses = ["FINANCE_REVIEW"];
    const query: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId), status: { $in: reviewStatuses } };

    return await Invoice.find(query)
      .populate("vendorId", "name gstin")
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /** List same-organization invoices visible to Finance but not yet forwarded by Procurement. */
  async listAwaitingProcurement(limit: number = 20, organizationId: string): Promise<IInvoice[]> {
    const statuses = ["SUBMITTED", "REVIEW_REQUIRED", "OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW", "RETURNED_TO_VENDOR", "ON_HOLD"];
    return Invoice.find({ organizationId: new Types.ObjectId(organizationId), status: { $in: statuses } })
      .populate("vendorId", "name gstin")
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get approval stats per organization.
   */
  async getApprovalStats(organizationId: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    totalValue: number;
  }> {
    const orgFilter = { organizationId: new Types.ObjectId(organizationId) };
    const reviewStatuses = ["FINANCE_REVIEW"];

    const [pending, approved, rejected, valueAgg] = await Promise.all([
      Invoice.countDocuments({ ...orgFilter, status: { $in: reviewStatuses } }),
      Invoice.countDocuments({ ...orgFilter, status: "APPROVED" }),
      Invoice.countDocuments({ ...orgFilter, status: "REJECTED" }),
      Invoice.aggregate([
        { $match: { ...orgFilter, status: { $in: reviewStatuses } } },
        { $group: { _id: null, totalValue: { $sum: "$totalAmount" } } },
      ]),
    ]);

    return {
      pending,
      approved,
      rejected,
      totalValue: valueAgg[0]?.totalValue || 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async _persistAuditEvent(params: {
    organizationId: string;
    actorId: string;
    action: string;
    resourceId: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        organizationId: new Types.ObjectId(params.organizationId),
        actorId: new Types.ObjectId(params.actorId),
        action: params.action,
        resourceType: "Invoice",
        resourceId: params.resourceId,
        previousState: params.previousState,
        newState: params.newState,
        timestamp: new Date(),
      });
    } catch (err) {
      // Log audit failures but do not roll back the financial decision
      console.error("audit.write.failed", {
        action: params.action,
        resourceId: params.resourceId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
}

export const approvalService = new ApprovalService();
