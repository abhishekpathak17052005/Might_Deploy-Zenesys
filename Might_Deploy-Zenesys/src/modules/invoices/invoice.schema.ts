import { z } from "zod";

// ============================================================================
// ORIGINAL INVOICE SCHEMA (Preserved for backward compatibility)
// ============================================================================

export const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  vendorId: z.string(),
  poId: z.string().nullable(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  subtotal: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  currency: z.string().default("INR"),
  status: z.enum(["RECEIVED", "IN_REVIEW", "APPROVED", "REJECTED", "PAID"]),
  validationStatus: z.enum(["PENDING", "PASSED", "FAILED"]),
  approvalStatus: z.enum(["NOT_STARTED", "PENDING", "APPROVED", "REJECTED"]),
  exceptionStatus: z.enum(["NONE", "OPEN", "RESOLVED"]),
  createdAt: z.unknown(),
  updatedAt: z.unknown()
});

// ============================================================================
// NEW UNIFIED SCHEMAS (Complete Workflow)
// ============================================================================

export const verificationResultSchema = z.object({
  gstFormatValid: z.boolean().optional(),
  gstVendorMatch: z.boolean().optional(),
  vendorExists: z.boolean().optional(),
  vendorActive: z.boolean().optional(),
  poFound: z.boolean().optional(),
  poVendorMatch: z.boolean().optional(),
  errors: z.array(z.string()).optional()
});

export const riskResultSchema = z.object({
  riskScore: z.number(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  decision: z.enum(["ELIGIBLE_FOR_AUTO_PROCESSING", "REVIEW_REQUIRED", "BLOCKED"]),
  signals: z.array(z.object({
    type: z.string(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    message: z.string()
  }))
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  approverUserId: z.string(),
  approverRole: z.string(),
  comments: z.string().optional(),
  timestamp: z.unknown()
});

export const lineItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  total: z.number().optional()
});

export const invoiceDocumentSchema = z.object({
  // Document metadata
  id: z.string(),
  documentStatus: z.enum([
    "SUBMITTED",
    "EXTRACTION_PENDING",
    "EXTRACTION_IN_PROGRESS",
    "EXTRACTION_COMPLETE",
    "EXTRACTION_FAILED",
    "VERIFICATION_PENDING",
    "VERIFICATION_COMPLETE",
    "RISK_EVALUATED",
    "FINANCE_REVIEW_PENDING",
    "APPROVED",
    "REJECTED"
  ]),
  storagePath: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number(),

  // Submission tracking
  uploaderUserId: z.string(),
  submittedAt: z.unknown(),
  invoiceType: z.enum(["PO_BASED", "NON_PO"]),

  // Structured invoice data (from extraction)
  invoiceNumber: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
  poId: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  invoiceDate: z.unknown().optional().nullable(),
  dueDate: z.unknown().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  subtotal: z.number().optional().nullable(),
  taxAmount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).optional(),

  // Verification results
  verificationResult: verificationResultSchema.optional(),
  verificationCompleteAt: z.unknown().optional().nullable(),

  // Risk & anomaly results
  riskResult: riskResultSchema.optional(),
  riskEvaluatedAt: z.unknown().optional().nullable(),

  // Finance approval
  approvalDecision: approvalDecisionSchema.optional().nullable(),

  // Metadata
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
  metadata: z.object({
    extractionAttempts: z.number().optional(),
    lastExtractionError: z.string().optional(),
    verificationAttempts: z.number().optional(),
    lastVerificationError: z.string().optional()
  }).optional()
});

// ============================================================================
// API SCHEMAS
// ============================================================================

export const uploadInvoiceDocumentRequestSchema = z.object({
  vendorId: z.string().optional(),
  invoiceType: z.enum(["PO_BASED", "NON_PO"])
});

export const submissionStatusResponseSchema = z.object({
  id: z.string(),
  documentStatus: z.string(),
  invoiceNumber: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  verificationResult: verificationResultSchema.optional(),
  riskResult: riskResultSchema.optional(),
  approvalDecision: approvalDecisionSchema.optional().nullable(),
  updatedAt: z.string()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type InvoiceDocumentDto = z.infer<typeof invoiceDocumentSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type RiskResult = z.infer<typeof riskResultSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type SubmissionStatusResponse = z.infer<typeof submissionStatusResponseSchema>;
