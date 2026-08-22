import { z } from "zod";
import { USER_ROLES } from "../../types/user.types";

export const approvalSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  approverId: z.string(),
  approverRole: z.enum(USER_ROLES),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  comments: z.string(),
  createdAt: z.unknown(),
  updatedAt: z.unknown()
});

export type ApprovalDocument = z.infer<typeof approvalSchema>;

// ============================================================================
// REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const approveInvoiceRequestSchema = z.object({
  comments: z.string().optional()
});

export const rejectInvoiceRequestSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
  comments: z.string().optional()
});

export const approvalResponseSchema = z.object({
  invoiceId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  approverUserId: z.string(),
  decisionTimestamp: z.string(),
  documentStatus: z.string()
});

export type ApproveInvoiceRequest = z.infer<typeof approveInvoiceRequestSchema>;
export type RejectInvoiceRequest = z.infer<typeof rejectInvoiceRequestSchema>;
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;
