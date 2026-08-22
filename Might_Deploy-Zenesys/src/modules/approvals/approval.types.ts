// ============================================================================
// APPROVAL TYPES
// ============================================================================

/**
 * Approval decision — represents a Finance Manager's decision on an invoice.
 */
export interface ApprovalDecision {
  id: string;
  invoiceId: string;
  decision: "APPROVED" | "REJECTED";
  approverUserId: string;
  approverRole: string;
  comments?: string;
  decisionTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to approve an invoice.
 */
export interface ApproveInvoiceRequest {
  comments?: string;
}

/**
 * Request to reject an invoice.
 */
export interface RejectInvoiceRequest {
  reason: string; // Required reason for rejection
  comments?: string;
}

/**
 * Response from approval endpoint.
 */
export interface ApprovalResponse {
  invoiceId: string;
  decision: "APPROVED" | "REJECTED";
  approverUserId: string;
  decisionTimestamp: string;
  documentStatus: string; // Updated document status after approval
}
