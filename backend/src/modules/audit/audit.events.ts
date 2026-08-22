// ============================================================================
// AUDIT EVENTS HELPER
// ============================================================================
// Helper functions to create audit logs for financial actions.
// Decoupled from service logic to avoid modifying existing code.

import { auditService } from "./audit.service";

/**
 * Log invoice upload event.
 */
export async function logInvoiceUpload(
  userId: string,
  invoiceId: string,
  fileName: string,
  fileSize: number,
  invoiceType: string
): Promise<void> {
  try {
    await auditService.createAuditLog({
      userId,
      action: "UPLOAD_INVOICE",
      entityType: "INVOICE",
      entityId: invoiceId,
      details: {
        fileName,
        fileSize,
        invoiceType,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("audit.log_invoice_upload.failed", {
      userId,
      invoiceId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    // Don't throw — audit logging failures should not block main operations
  }
}

/**
 * Log invoice approval event.
 */
export async function logInvoiceApproval(
  userId: string,
  invoiceId: string,
  approvalId: string,
  comments?: string
): Promise<void> {
  try {
    await auditService.createAuditLog({
      userId,
      action: "APPROVE_INVOICE",
      entityType: "INVOICE",
      entityId: invoiceId,
      details: {
        approvalId,
        decision: "APPROVED",
        comments,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("audit.log_invoice_approval.failed", {
      userId,
      invoiceId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    // Don't throw — audit logging failures should not block main operations
  }
}

/**
 * Log invoice rejection event.
 */
export async function logInvoiceRejection(
  userId: string,
  invoiceId: string,
  approvalId: string,
  reason: string,
  comments?: string
): Promise<void> {
  try {
    await auditService.createAuditLog({
      userId,
      action: "REJECT_INVOICE",
      entityType: "INVOICE",
      entityId: invoiceId,
      details: {
        approvalId,
        decision: "REJECTED",
        reason,
        comments,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("audit.log_invoice_rejection.failed", {
      userId,
      invoiceId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    // Don't throw — audit logging failures should not block main operations
  }
}

/**
 * Log verification event.
 */
export async function logVerificationEvent(
  userId: string,
  invoiceId: string,
  verificationStatus: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await auditService.createAuditLog({
      userId,
      action: "VERIFY_INVOICE",
      entityType: "INVOICE",
      entityId: invoiceId,
      details: {
        verificationStatus,
        ...details,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("audit.log_verification.failed", {
      userId,
      invoiceId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    // Don't throw — audit logging failures should not block main operations
  }
}

/**
 * Log risk evaluation event.
 */
export async function logRiskEvaluationEvent(
  userId: string,
  invoiceId: string,
  riskLevel: string,
  riskScore: number
): Promise<void> {
  try {
    await auditService.createAuditLog({
      userId,
      action: "EVALUATE_RISK",
      entityType: "INVOICE",
      entityId: invoiceId,
      details: {
        riskLevel,
        riskScore,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("audit.log_risk_evaluation.failed", {
      userId,
      invoiceId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    // Don't throw — audit logging failures should not block main operations
  }
}
