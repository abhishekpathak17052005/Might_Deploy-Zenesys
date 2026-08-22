import { firestore } from "../../config/firebase";
import type { InvoiceDocument } from "../invoices/invoice.types";
import { invoiceDocumentService } from "../invoices/invoice.service";
import { auditService } from "../audit/audit.service";
import type { ApprovalDecision, ApproveInvoiceRequest, RejectInvoiceRequest } from "./approval.types";
import { v4 as uuidv4 } from "uuid";

const COLLECTIONS = {
  approvalDecisions: "approvalDecisions",
  invoiceDocuments: "invoiceDocuments"
};

class ApprovalService {
  /**
   * Approve an invoice (Finance Manager decision).
   * Updates invoice status to APPROVED and stores approval decision.
   */
  async approveInvoice(
    invoiceId: string,
    approverUserId: string,
    approverRole: string,
    request: ApproveInvoiceRequest
  ): Promise<ApprovalDecision> {
    // Verify invoice exists and is in FINANCE_REVIEW_PENDING status
    const invoice = await invoiceDocumentService.getInvoiceDocument(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.documentStatus !== "FINANCE_REVIEW_PENDING") {
      throw new Error(
        `Cannot approve invoice in ${invoice.documentStatus} status. Expected FINANCE_REVIEW_PENDING.`
      );
    }

    const now = new Date();
    const approvalId = uuidv4();

    const approval: ApprovalDecision = {
      id: approvalId,
      invoiceId,
      decision: "APPROVED",
      approverUserId,
      approverRole,
      comments: request.comments,
      decisionTimestamp: now,
      createdAt: now,
      updatedAt: now
    };

    // Store approval decision
    await firestore.collection(COLLECTIONS.approvalDecisions).doc(approvalId).set(approval);

    // Update invoice status to APPROVED
    await firestore.collection(COLLECTIONS.invoiceDocuments).doc(invoiceId).update({
      documentStatus: "APPROVED",
      approvalDecision: {
        decision: "APPROVED",
        approverUserId,
        approverRole,
        comments: request.comments,
        timestamp: now
      },
      updatedAt: now
    });

    console.info("invoice.approved", {
      invoiceId,
      approverUserId,
      approverRole,
      approvalId
    });

    return approval;
  }

  /**
   * Reject an invoice (Finance Manager decision).
   * Updates invoice status to REJECTED and stores rejection decision.
   */
  async rejectInvoice(
    invoiceId: string,
    approverUserId: string,
    approverRole: string,
    request: RejectInvoiceRequest
  ): Promise<ApprovalDecision> {
    // Verify invoice exists and is in FINANCE_REVIEW_PENDING status
    const invoice = await invoiceDocumentService.getInvoiceDocument(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.documentStatus !== "FINANCE_REVIEW_PENDING") {
      throw new Error(
        `Cannot reject invoice in ${invoice.documentStatus} status. Expected FINANCE_REVIEW_PENDING.`
      );
    }

    const now = new Date();
    const approvalId = uuidv4();

    const approval: ApprovalDecision = {
      id: approvalId,
      invoiceId,
      decision: "REJECTED",
      approverUserId,
      approverRole,
      comments: request.comments || request.reason,
      decisionTimestamp: now,
      createdAt: now,
      updatedAt: now
    };

    // Store approval decision
    await firestore.collection(COLLECTIONS.approvalDecisions).doc(approvalId).set(approval);

    // Update invoice status to REJECTED
    await firestore.collection(COLLECTIONS.invoiceDocuments).doc(invoiceId).update({
      documentStatus: "REJECTED",
      approvalDecision: {
        decision: "REJECTED",
        approverUserId,
        approverRole,
        comments: request.comments || request.reason,
        timestamp: now
      },
      updatedAt: now
    });

    console.info("invoice.rejected", {
      invoiceId,
      approverUserId,
      approverRole,
      reason: request.reason,
      approvalId
    });

    return approval;
  }

  /**
   * Get approval decision for an invoice.
   */
  async getApprovalDecision(invoiceId: string): Promise<ApprovalDecision | null> {
    const snapshot = await firestore
      .collection(COLLECTIONS.approvalDecisions)
      .where("invoiceId", "==", invoiceId)
      .orderBy("decisionTimestamp", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as ApprovalDecision;
  }

  /**
   * List invoices pending Finance Manager review.
   */
  async listPendingReview(limit: number = 20): Promise<InvoiceDocument[]> {
    const snapshot = await firestore
      .collection(COLLECTIONS.invoiceDocuments)
      .where("documentStatus", "==", "FINANCE_REVIEW_PENDING")
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as InvoiceDocument);
  }

  /**
   * Get approval stats (for dashboard/reporting).
   */
  async getApprovalStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    const [pendingSnap, approvedSnap, rejectedSnap] = await Promise.all([
      firestore
        .collection(COLLECTIONS.invoiceDocuments)
        .where("documentStatus", "==", "FINANCE_REVIEW_PENDING")
        .count()
        .get(),
      firestore
        .collection(COLLECTIONS.invoiceDocuments)
        .where("documentStatus", "==", "APPROVED")
        .count()
        .get(),
      firestore
        .collection(COLLECTIONS.invoiceDocuments)
        .where("documentStatus", "==", "REJECTED")
        .count()
        .get()
    ]);

    return {
      pending: pendingSnap.data().count,
      approved: approvedSnap.data().count,
      rejected: rejectedSnap.data().count
    };
  }
}

export const approvalService = new ApprovalService();
